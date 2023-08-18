import {
    AdsMetadata,
    BrpCollectionPage,
    BrpExpandedCollectionIndexParam,
    BrpRootCollectionIndexParam,
    IIIFPresV3
} from "./brp/brp.types";

import {resolve} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';

import {promises as fsPromises} from 'fs';
import {ensureDir} from "fs-extra";
import * as sizeOf from "image-size";
import {promisify} from "util";
import {asyncForEach} from "../lib/Utils";
import {runTask} from "../lib/Task";
import {
    DATE_LABEL_DE, DATE_LABEL_EN, DATE_LABEL_FR, DATE_LABEL_IT,
    englishifyTitle,
    EXT_BASE_URL,
    EXT_LANG_ARR,
    EXT_LANG_DESCRIPTION,
    LANGUAGE_IDENTIFIERS,
    OCR_LABELS,
    PUBLISHED_LABEL_DE,
    PUBLISHED_LABEL_EN,
    PUBLISHED_LABEL_FR,
    PUBLISHED_LABEL_IT,
    TITLE_LABEL_DE,
    TITLE_LABEL_EN,
    TITLE_LABEL_FR,
    TITLE_LABEL_IT
} from "./brp/i18n.utils";
import {
    extractNavDate,
    getOcrMime,
    getOcrProfile,
    IIIFUtils,
    monthOf,
    pageNoOf,
    pageNoOfUrl,
    pageNumberCompare,
    UriGenerator,
    yearOf
} from "./brp/brp.utils";
import Annotation = IIIFPresV3.Annotation;
import AnnotationBody = IIIFPresV3.AnnotationBody;
import Canvas = IIIFPresV3.Canvas;
import CanvasLabel = IIIFPresV3.LabelNoLang;
import AnnotationPage = IIIFPresV3.AnnotationPage;
import Rendering = IIIFPresV3.Rendering;
import Thumbnail = IIIFPresV3.Thumbnail;
import Collection = IIIFPresV3.Collection;
import ManifestEntry = IIIFPresV3.ManifestEntry;
import Manifest = IIIFPresV3.Manifest;
import Service = IIIFPresV3.Service;
import SeeAlso = IIIFPresV3.SeeAlso;
import LabelNoLang = IIIFPresV3.LabelNoLang;
import PartOf = IIIFPresV3.PartOf;
import createSearchService = IIIFUtils.createSearchService;

const sizeOfAsync = promisify(sizeOf.imageSize);
const {writeFile} = fsPromises;


export default async function createManifest(param: BrpExpandedCollectionIndexParam) {
    await createManifestV3(param);
}


/**
 * A small helper utility which writes a JSONified variant of the second argument at the path of the first.
 * @param path The path to the file, if it exists it will be overwritten
 * @param manifest What to write, i.e. the content.
 */
async function writeJsonifiedManifest(path: string, manifest: any) {
    await writeFile(path, JSON.stringify(manifest, null, 2));
}


async function createManifestV3(param: BrpExpandedCollectionIndexParam) {
    logger.info("Running service IIIF3 Manifest create for collection: " + param.name);

    const collectionName = param.name;
    const rootCollectionParams = {
        name: collectionName
    } as BrpRootCollectionIndexParam
    const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', collectionName);
    const annotationContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', collectionName, "annotations");
    const collectionManifestPath = resolve(manifestContainerPath, 'manifest.json');
    const collectionManifestUrl = UriGenerator.collectionId(collectionName);

    await ensureDir(manifestContainerPath);

    const documentManifestPath = resolve(manifestContainerPath, collectionName + '.json'); // /manifests/<collectionName>/<collectionName>.json
    const documentManifestUrl = UriGenerator.manifestId(collectionName);

    const collectionManifest = buildCollection(param, collectionManifestUrl, documentManifestUrl);

    const thumbnail = config.imageServerUrl + '/iiif/2/' + encodeURIComponent(collectionName + '/' + collectionName + '-0.jpg') + '/full/!100,100/0/default.jpg';

    rootCollectionParams.manifestUri = documentManifestUrl;
    rootCollectionParams.thumbnailUri = thumbnail;
    rootCollectionParams.metadata = param.basicParams.metadata;
    rootCollectionParams.navDate = param.basicParams.metadata.publicationDate;


    const documentManifest = buildManifest(param, documentManifestUrl, collectionManifestUrl);

    let index = 0;
    await asyncForEach(param.collectionFiles, async (file: BrpCollectionPage) => {
        const imgFileOnly = file.imgFile.substring(file.imgFile.lastIndexOf('/'));
        const imageUrl = config.imageServerUrl + '/iiif/2/' + encodeURIComponent(collectionName + imgFileOnly);
        const ocrManifestFilename = file.base + '.json';
        /* Config based OCR setup */
        const ocrAnnotationUrl = config.manifestServerUrl + '/' + collectionName + '/' + 'annotations' + '/' + config.brpOcr + '/' + ocrManifestFilename;
        const ocrContainer = resolve(annotationContainerPath, config.brpOcr!);

        await ensureDir(ocrContainer);


        const ocrExtension = config.brpOcr === 'hocr' ? '.hocr' : '.xml'
        const actualOcrFile = config.manifestServerUrl!.substring(0, config.manifestServerUrl!.lastIndexOf('manifests')) + 'ocr/' + collectionName + '/' + config.brpOcr + '/' + file.base + ocrExtension;
        const canvasUrl = UriGenerator.canvasId(collectionName, pageNoOf(imageUrl)!);
        const canvasManifest = await buildCanvas(canvasUrl, collectionName, imageUrl, file.imgFile, ocrAnnotationUrl, actualOcrFile, documentManifestUrl);

        documentManifest.items.push(canvasManifest);


        index++;
    });

    // Experimentally found, that the canvases are displayed in order (and are out of order, since 0,1,10,11,...,2,3
    const imageManifests = documentManifest.items;
    documentManifest.items = imageManifests.sort((c1: any, c2: any) => pageNumberCompare(c1.label.none[0], c2.label.none[0]));

    await writeJsonifiedManifest(documentManifestPath, documentManifest);
    await writeJsonifiedManifest(collectionManifestPath, collectionManifest);

    logger.info('Finished manifest building for ' + collectionName);
    await runTask<BrpRootCollectionIndexParam>('brp-root-manifest', rootCollectionParams);
}

function buildTitleLabel(param: BrpExpandedCollectionIndexParam) {
    return IIIFUtils.buildLabel(
        param.basicParams.metadata.titleDE,
        param.basicParams.metadata.titleFR,
        param.basicParams.metadata.titleIT,
        englishifyTitle(param.basicParams.metadata.titleDE));
}

function buildCollection(param: BrpExpandedCollectionIndexParam, collectionUrl: string, manifestUrl: string): Collection {
    const label = buildTitleLabel(param);
    return {
        '@context': IIIFPresV3.CONTEXT,
        id: collectionUrl,
        type: "Collection",
        label: label,
        items: [
            {
                id: manifestUrl,
                type: "Manifest",
                label: label,
                thumbnail: buildThumbnail(param.name),
                rendering: buildRenderings(param.name),
                navDate: extractNavDate(param.basicParams.metadata.publicationDate)
            }
        ] as ManifestEntry[]
    } as Collection;
}

function buildManifest(param: BrpExpandedCollectionIndexParam, manifestUrl: string, collectionUrl: string): Manifest {
    return {
        '@context': IIIFPresV3.CONTEXT,
        id: manifestUrl,
        type: "Manifest",
        label: IIIFUtils.buildSignatureLabel(param.name),
        metadata: buildMetadata(param.basicParams.metadata),
        service: createSearchService(param.name),
        summary: buildTitleLabel(param), // TODO Better summary?
        thumbnail: [buildThumbnail(param.name)],
        rendering: IIIFUtils.buildAllRenderings(param.name, true),
        partOf: buildPartOf(param),
        items: [] as Canvas[]
    } as Manifest;
}

function buildPartOf(param: BrpExpandedCollectionIndexParam) {
    const navDate = extractNavDate(param.basicParams.metadata.publicationDate);
    return [
        // minimal setup:
        {id: UriGenerator.collectionId(param.name), type: 'Collection'} as PartOf, // Single minutes collection
        {id: UriGenerator.rootCollectionId(), type: 'Collection'} as PartOf, // Root collection
        {id: UriGenerator.yearCollectionId(yearOf(navDate)), type: 'Collection'} as PartOf, // Year
        {id: UriGenerator.monthCollectionId(yearOf(navDate), monthOf(navDate)), type: 'Collection'} as PartOf, // Month
    ] as PartOf[];
}

function buildThumbnail(collectionName: string): Thumbnail {
    return {
        id: config.imageServerUrl + '/iiif/2/' + encodeURIComponent(collectionName + '/' + collectionName + '-0.jpg') + '/full/!100,100/0/default.jpg',
        type: "Image",
        format: "image/jpeg"
    } as Thumbnail
}

function buildRenderings(id: string): Rendering[] {
    const r = [] as Rendering[];

    for (let i = 0; i < EXT_LANG_ARR.length; i++) {
        const rendering = {
            id: EXT_BASE_URL + EXT_LANG_ARR[i] + id,
            type: "Text",
            label: {
                none: [EXT_LANG_DESCRIPTION[i]]
            } as LabelNoLang,
            format: "application/pdf",
            language: [LANGUAGE_IDENTIFIERS[i]]
        } as Rendering;

        r.push(rendering);
    }

    return r;
}

function buildDownloadOcrRendering(id: string): Rendering[] {
    return [
        {
            id: UriGenerator.ocrPlainUri(id),
            type: "Text",
            label: IIIFUtils.buildLabel(OCR_LABELS[0], OCR_LABELS[1], OCR_LABELS[2], OCR_LABELS[3]),
            format: "text/plain"
        }
    ] as Rendering[];

}

async function buildCanvas(canvasId: string, collectionName: string, imageUrl: string, imagePath: string, ocrUrl: string, ocrPath: string, manifestUrl: string): Promise<Canvas> {
    const size = await sizeOfAsync(imagePath);
    const width = Number(size!.width);
    const height = Number(size!.height);
    const pageNo = pageNoOfUrl(imageUrl);
    return {
        id: imageUrl, // Example: https://example.org/iiif/book1/canvas/p2
        type: "Canvas",
        label: {none: [pageNo]} as CanvasLabel,
        width: width,
        height: height,
        items: [
            {
                id: UriGenerator.paintingPageIdEmbedded(manifestUrl, collectionName, pageNo), // Example: https://example.org/iiif/book1/page/p2/1
                type: "AnnotationPage",
                items: [
                    buildImageAnnotation(imageUrl, width, height, canvasId, collectionName, manifestUrl)
                ] as Annotation[]
            }
        ] as AnnotationPage[],
        annotations: [
            {
                // Currently here for completeness sake, but not supported by the OCR highlight plugin
                id: UriGenerator.supplementingPageIdEmbedded(manifestUrl, collectionName, pageNo), // Example: https://example.org/iiif/book1/comments/p1/1
                type: "AnnotationPage",
                items: [
                    buildOcrAnnotation(ocrUrl, ocrPath, canvasId, collectionName, pageNo, manifestUrl)
                ]
            } as AnnotationPage
        ] as AnnotationPage[],
        seeAlso: [
            // Essential for OCR to work, as above annotation is not supported by the OCR highlight plugin
            buildOcrSeeAlso(ocrUrl, ocrPath, canvasId, collectionName, pageNo, manifestUrl)
        ] as SeeAlso[],
        renderings: buildRenderings(collectionName)
    } as Canvas
}

function buildImageAnnotation(imageUrl: string, width: number, height: number, canvasUrl: string, collectionName: string, manifestUrl: string): Annotation {
    return {
        '@context': IIIFPresV3.CONTEXT,
        id: UriGenerator.paintingAnnotationIdEmbedded(manifestUrl, collectionName, pageNoOf(imageUrl)!), // unsure // Example: https://example.org/iiif/book1/annotation/p0002-image
        type: "Annotation",
        motivation: "painting",
        target: canvasUrl, // Example: https://example.org/iiif/book1/canvas/p2
        body: {
            id: imageUrl + '/full/full/0/default.jpg', // Example: https://example.org/iiif/book1/page2/full/max/0/default.jpg
            type: "Image",
            format: 'image/jpeg',
            service: [
                {
                    id: imageUrl, // Example: https://example.org/iiif/book1/page2
                    type: "ImageService2",
                    profile: "level2"
                } as Service
            ],
            width: width,
            height: height
        } as AnnotationBody,
    } as Annotation;
}

function buildOcrAnnotation(annotationUrl: string, ocrPath: string, canvasUrl: string, collectionName: string, pageNo: string, manifestUrl: string): Annotation {
    return {
        '@context': IIIFPresV3.CONTEXT,
        id: UriGenerator.supplementingAnnotationIdEmbedded(manifestUrl, collectionName, pageNo),
        type: "Annotation",
        motivation: "supplementing",
        target: canvasUrl,
        body: {
            id: ocrPath, // Not sure whether this is the same as the id above
            type: "Text",
            format: getOcrMime(config.brpOcr!)
        } as AnnotationBody
    } as Annotation;
}

function buildOcrSeeAlso(annotationUrl: string, ocrUrl: string, canvasUrl: string, collectionName: string, pageNo: string, manifestUrl: string) {
    return {
        id: ocrUrl,
        type: "Text",
        format: getOcrMime(config.brpOcr!),
        profile: getOcrProfile(config.brpOcr!)
    } as SeeAlso;
}

/**
 * Builds a IIIFv3 Metadata array for the given ADS metadata.
 * Currently this is very limited, as only the title and published date are used.
 * @param meta
 */
function buildMetadata(meta: AdsMetadata): IIIFPresV3.Metadata[] {
    const m = [] as IIIFPresV3.Metadata[];
    m.push({
            label: IIIFUtils.buildLabel(TITLE_LABEL_DE, TITLE_LABEL_FR, TITLE_LABEL_IT, TITLE_LABEL_EN),
            value: IIIFUtils.buildLabel(meta.titleDE, meta.titleFR, meta.titleIT, englishifyTitle(meta.titleDE))
        } as IIIFPresV3.Metadata
    );
    m.push(
        {
            label: IIIFUtils.buildLabel(DATE_LABEL_DE, DATE_LABEL_FR, DATE_LABEL_IT, DATE_LABEL_EN),
            value: IIIFUtils.buildLabel(meta.publicationDate, meta.publicationDate, meta.publicationDate, meta.publicationDate)
        } as IIIFPresV3.Metadata
    )
    return m;
}
