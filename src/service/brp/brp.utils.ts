import {resolve} from "path";
import config from "../../lib/Config.js";
import {ensureDir} from "fs-extra";
import {IIIFPresV3} from "./brp.types";
import {EXT_BASE_URL, EXT_LANG_ARR, EXT_LANG_DESCRIPTION, LANGUAGE_IDENTIFIERS, OCR_LABELS} from "./i18n.utils.js";
import Rendering = IIIFPresV3.Rendering;
import {AisLookup} from "../../lib/AisLookup.js";
import {AdsLookupMetadataTable} from "../../lib/AdsLookupMetadataTable.js";
import {TitlePageLookup} from "../../lib/TitlePageLookup.js";
import lodash from "lodash";
import {use} from "chai";
import {BrpOdditiesLogger} from "../../lib/BrpOdditiesLogger.js";

//import {romanToArab, arabToRoman, isValidArab, isValidRoman} from "roman-numbers";
import romanNumbers from "roman-numbers";
//const {romanToArab, arabToRoman, isValidArab, isValidRoman} = require('roman-numbers')


export namespace IIIFUtils {
    import Label4Lang = IIIFPresV3.Label4Lang;
    import LabelNoLang = IIIFPresV3.LabelNoLang;
    import Service = IIIFPresV3.Service;

    export function buildLabel(deVal: string, frVal: string, itVal: string, enVal: string): Label4Lang {
        return {
            de: [deVal],
            fr: [frVal],
            it: [itVal],
            en: [enVal]
        } as Label4Lang;
    }

    export function buildLocalisedSingleLabel(value: string): Label4Lang {
        return {
            de: [value],
            fr: [value],
            it: [value],
            en: [value]
        }
    }

    export function buildAllRenderings(id: string, useGermanArchiveLabel = false){
        return pdfPlainRendering(id)
            .concat(
                ocrPlainRendering(id),
                useGermanArchiveLabel ? archiveRenderingDeLink(id) : archiveRenderings(id, true),
                // archiveRenderings(id, useSignatureAsArchiveLabel) // Disabled, see comment on BBI-4
            );
    }

    export function archiveRenderings(id: string, useSignatureAsLabel = false){
        const r = [] as Rendering[];

        for(let i=0; i<EXT_LANG_ARR.length; i++){
            const rendering = {
                id: EXT_BASE_URL + EXT_LANG_ARR[i] + id,
                type: "Text",
                /*label: IIIFUtils.buildLabel(
                    EXT_LANG_DESCRIPTION[0] + " auf " + EXT_LANG_MAP[i][0],
                    EXT_LANG_DESCRIPTION[1] + " en " + EXT_LANG_MAP[i][1],
                    EXT_LANG_DESCRIPTION[2] + " in " + EXT_LANG_MAP[i][2],
                    EXT_LANG_DESCRIPTION[3] + " in " + EXT_LANG_MAP[i][3]
                    ),*/
                label: useSignatureAsLabel ? buildSignatureLabel(id) : {
                    none: [EXT_LANG_DESCRIPTION[i]]
                } as LabelNoLang,
                format: "application/pdf",
                language: [LANGUAGE_IDENTIFIERS[i]]
            } as Rendering;

            r.push(rendering);
        }

        return r;
    }

    export function archiveRenderingDeLink(id: string){
        return {
            id: EXT_BASE_URL + EXT_LANG_ARR[0] + id, // 0 is german
            type: "Text",
            label:  buildSignatureLabel(id),
            format: "application/pdf"
        } as Rendering;
    }

    export function buildSignatureLabel(ais: string){
        return {
            none: [AIS_LOOKUP.record(ais)!.Signatur]
        } as IIIFPresV3.LabelNoLang
    }

    export function ocrPlainRendering(id: string){
        return [
            {
                id: UriGenerator.ocrPlainUri(id),
                type: "Text",
                // label: IIIFUtils.buildLabel(OCR_LABELS[0], OCR_LABELS[1], OCR_LABELS[2], OCR_LABELS[3]),
                label: IIIFUtils.buildLocalisedSingleLabel("Download OCR"),
                format: "text/plain"
            }
        ] as Rendering[];
    }

    export function pdfPlainRendering(id: string){
        return [
            {
                id: pdfUrl(AIS_LOOKUP.ads(id)),
                type: "Text",
                // label: IIIFUtils.buildLabel("PDF", "PDF", "PDF", "PDF"),
                label: IIIFUtils.buildLocalisedSingleLabel("Download PDF"),
                format: "text/plain"
            }
        ] as Rendering[];
    }

    export function createSearchService(id: string){
        return {
            id: config.manifestSearchUrl + id,
            profile: 'http://iiif.io/api/search/1/search',
            type: 'SearchService1'
        } as Service;
    }
}

/**
 * Utility for IIIF manifest ID (i.e. URI) generation.
 */
export class UriGenerator {
    private static host() {
        return `${config.manifestServerUrl!.substring(0, config.manifestServerUrl!.lastIndexOf('manifests'))}`;
    }
    private static base() {
        return `${config.manifestServerUrl}`
    }

    static collectionId(name: string) {
        return `${UriGenerator.base()}/${name}/manifest.json`;
    }

    static manifestId(name: string) {
        return `${UriGenerator.base()}/${name}/${name}.json`;
    }

    static canvasId(name: string, pageNo: string) {
        return `${UriGenerator.base()}/${name}/canvasses/${name}-${pageNo}`
    }

    static annotationPageIdEmbedded(base: string, name: string, pageNo: string, type: string, format?: string) {
        const _f = format ? format + '-' : '';
        return `${base}#annotations-page-${type}-${_f}${name}-${pageNo}`;
    }

    static annotationPageId(name: string, pageNo: string, type: string, format?: string) {
        const _format = format ? format + '/' : '';
        return `${UriGenerator.base()}/${name}/annotations/page/${type}/${_format}${name}-${pageNo}`
    }

    static paintingPageIdEmbedded(base: string, name: string, pageNo: string) {
        return UriGenerator.annotationPageIdEmbedded(base, name, pageNo, 'painting');
    }

    static paintingPageId(name: string, pageNo: string) {
        return UriGenerator.annotationPageId(name, pageNo, 'painting');
    }

    static supplementingPageIdEmbedded(base: string, name: string, pageNo: string, format?: string) {
        return UriGenerator.annotationPageIdEmbedded(base, name, pageNo, 'supplementing', format);
    }

    static supplementingPageId(name: string, pageNo: string, format?: string) {
        return UriGenerator.annotationPageId(name, pageNo, 'supplementing', format);
    }

    static annotationId(name: string, pageNo: string, type: string, format?: string) {
        const _format = format ? format + '/' : '';
        return `${UriGenerator.base()}/${name}/annotations/content/${type}/${_format}${name}-${pageNo}`
    }

    static annotationIdEmbedded(base: string, name: string, pageNo: string, type: string, format?: string) {
        const _f = format ? format + '-' : '';
        return `${base}#annotations-content-${type}-${_f}${name}-${pageNo}`;
    }

    static paintingAnnotationIdEmbedded(base: string, name: string, pageNo: string) {
        return UriGenerator.annotationIdEmbedded(base, name, pageNo, 'painting');
    }

    static paintingAnnotationId(name: string, pageNo: string) {
        return UriGenerator.annotationId(name, pageNo, 'painting');
    }

    static supplementingAnnotationIdEmbedded(base: string, name: string, pageNo: string, format?: string) {
        return UriGenerator.annotationIdEmbedded(base, name, pageNo, 'supplementing', format);
    }

    static supplementingAnnotationId(name: string, pageNo: string, format?: string) {
        return UriGenerator.annotationId(name, pageNo, 'supplementing', format)
    }

    static rootCollectionId() {
        return `${UriGenerator.base()}/root.json`;
    }

    static yearCollectionId(year: number) {
        return `${UriGenerator.base()}/yearly/${year}/manifest.json`;
    }

    static monthCollectionId(year: number, month: number) {
        return `${UriGenerator.base()}/yearly/${year}/${month}.json`;
    }

    static ocrBaseUri(){
        return `${UriGenerator.host()}/ocr`;
    }

    static ocrCollectionUri(name: string){
        return `${UriGenerator.ocrBaseUri()}/${name}`
    }

    static ocrPlainUri(name: string){
        return `${UriGenerator.ocrCollectionUri(name)}/${name}.txt`
    }
}

/**
 * Utility for paths
 */
export class PathUtils {

    static async manifestContainer() {
        const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests');
        await ensureDir(manifestContainerPath);
        return manifestContainerPath;
    }

    static async imagesContainer(collectionName: string){
        const containerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'images', collectionName);
        await ensureDir(containerPath);
        return containerPath;
    }

    static async rootCollectionFile() {
        return resolve(await PathUtils.manifestContainer(), 'root.json');
    }

    static async yearCollectionContainer(year: number) {
        const c = resolve(await PathUtils.manifestContainer(), 'yearly', '' + year);
        await ensureDir(c);
        return c;
    }

    static async yearCollectionFile(year: number) {
        // It might be more declarative to use 'collection.json' or '$year.json'
        return resolve(await PathUtils.yearCollectionContainer(year), 'manifest.json');
    }

    static async monthCollectionFile(year: number, month: number) {
        return resolve(await PathUtils.yearCollectionContainer(year), `${month}.json`);
    }

    static async minutesCollectionContainer(collectionName: string) {
        const c = resolve(await PathUtils.manifestContainer(), collectionName);
        await ensureDir(c);
        return c;
    }

    static async annotationsContainer(collectionName: string) {
        const c = resolve(await PathUtils.manifestContainer(), collectionName, 'annotations');
        await ensureDir(c);
        return c;
    }

    static async canvassesContainer(collectionName: string) {
        const c = resolve(await PathUtils.manifestContainer(), collectionName, 'canvasses');
        await ensureDir(c);
        return c;
    }

    static async minutesCollectionFile(collectionName: string) {
        return resolve(await PathUtils.minutesCollectionContainer(collectionName), 'manifest.json');
    }

    static async minutesManifestFile(collectionName: string) {
        return resolve(await PathUtils.minutesCollectionContainer(collectionName), `${collectionName}.json`);
    }

    static async canvasManifestFile(collectionName: string, pageNo: string) {
        return resolve(await PathUtils.canvassesContainer(collectionName), `${collectionName}-${pageNo}.json`);
    }

    static async ocrContainer(collectionName: string){
        const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', collectionName);
        await ensureDir(manifestContainerPath);
        return manifestContainerPath;
    }

    /**
     * @deprecated Decision to use hOCR throughout the project
     */
    static async altoContainer(collectionName: string){
        return PathUtils.typedOcrContainer(collectionName, 'alto');
    }

    /**
     * @deprecated Decision to use hOCR throughout the project
     */
    static async pageContainer(collectionName: string){
        return PathUtils.typedOcrContainer(collectionName, 'page');
    }

    static async hocrContainer(collectionName: string){
        return PathUtils.typedOcrContainer(collectionName, 'hocr');
    }

    private static async typedOcrContainer(collectionName: string, ocrType: string){
        const containerPath = resolve(await PathUtils.ocrContainer(collectionName), ocrType);
        await ensureDir(containerPath);
        return containerPath;
    }

    static async plainOcrTextFile(collectionName: string){
        return resolve(await PathUtils.ocrContainer(collectionName), `${collectionName}.txt`);
    }
}

/**
 * Extracts the page number of a image name like structure. Expects to be suffix free
 * @param imageName A extension free image name e.g. myfile-0
 */
export function pageNoOfName(imageName: string){
    return imageName.substring(imageName.lastIndexOf('-')+1);
}

/**
 * Extracts the page number of an imageUrl with a suffix.
 * @param imageUrl The image url to extract from. e.g. http://example.com/images/myimage-0.jpg
 */
export function pageNoOfUrl(imageUrl: string){
    return imageUrl.substring(imageUrl.lastIndexOf('-') + 1, imageUrl.lastIndexOf('.'));
}
export function pageNoOf(fileLike: string, nullIfNotFound = false) {
    const regex = /((?:-)(\d*)(?=\.)|(?:-)(\d*)$)/g
    const match = regex.exec(fileLike);
    if(match !== null){
        const arr = match.filter(Boolean);
        return arr[arr.length-1];
    } else {
        return nullIfNotFound ? null : '0' // Signature named title pages have no page number and need 0 (to become 0+1>roman = i)
    }
}

function pageNoOfSafe(fileLikeNoSuffix: string){
    return fileLikeNoSuffix.substring(fileLikeNoSuffix.lastIndexOf('-') + 1)
}

export function pageNumber(imageUrl: string){
    return Number(pageNoOf(imageUrl)!);
}

export function toTitlePageNo(pageNumber: number){
    return romanNumbers.arabToRoman(pageNumber).toLowerCase();
}

export function titlePageNumber(titlePageNo: string){
    return romanNumbers.romanToArab(titlePageNo);
}

export function pageNoComp(aFile: string, bFile:string, safe=false): number{
    // compare(a,b) returns >0 if b befora a, returns <0 if a before b
    const aPageNo = safe ? pageNoOfSafe(aFile): pageNoOf(aFile)!;
    const bPageNo = safe ? pageNoOfSafe(bFile) : pageNoOf(bFile)!;
    return pageNumberCompare(aPageNo, bPageNo);
}

export function pageNumberCompare(aLabel: string, bLabel: string): number {
    // isNaN == isString and !isNaN == isNumeric
    if(isRomanNumber(aLabel) && isRomanNumber(bLabel)){
        // Both title pages, sort according to number
        return romanNumbers.romanToArab(aLabel) - romanNumbers.romanToArab(bLabel);
    }else if(isRomanNumber(aLabel) && !lodash.isNaN(bLabel)){
        // A is a title page, sort it before
        return -1;
    }else if(!lodash.isNaN(aLabel) && isRomanNumber(bLabel)){
        // B is a title page, sort it before
        return 1;
    }else if(!lodash.isNaN(aLabel) && !lodash.isNaN(bLabel)){
        // both normal pages
        return Number(aLabel) - Number(bLabel);
    }else{
        throw new Error("Cannot compare "+aLabel+" vs. "+bLabel);
    }
}


function isRomanNumber(str:string){
    str = str.toUpperCase(); // regex is upper case, otherwise we use lowercase
    if(str && str.length > 0){
        const regex = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/;
        return regex.test(str);
    }else{
        return false;
    }
}

/**
 * Utility to extract the navDate format from a given metadata 'published' field.
 * The navDate is in format YYYY-MM-DDTHH:mm:ssZ (time information is always set to 0)
 * @param metaDate
 */
export function extractNavDate(metaDate: string) {
    let date = metaDate;
    if (metaDate.length > 'YYYY-MM-DD'.length && metaDate.indexOf(' ') > 0) {
        date = metaDate.substring(0, metaDate.indexOf(' '))
    }
    return date + 'T00:00:00Z';
}

/** Extracts the year information of a given navDate string as a number
 */
export function yearOf(navDate: string) {
    return Number(navDate.substr(0, 4));
}

/**
 * Extracts the month information (1-indexed) of a given navDate string a s a number
 * @param navDate
 */
export function monthOf(navDate: string) {
    return Number(navDate.substr(5, 2));
}

/**
 * OCR Type ALTO
 */
export const ALTO_OCR_TYPE = 'alto';
/**
 * OCR type PAGE
 */
export const PAGE_OCR_TYPE = 'page';
/**
 * OCR type hocr
 */
export const HOCR_OCR_TYPE = 'hocr';

export function getOcrMime(ocr: string) {
    if (ocr === ALTO_OCR_TYPE) {
        return 'application/xml+alto';
    } else if (ocr === HOCR_OCR_TYPE) {
        return 'text/vnd.hocr+html';
    } else if (ocr === PAGE_OCR_TYPE) {
        return 'text/xml';
    }
}

export function getOcrProfile(ocr: string) {
    if (ocr === ALTO_OCR_TYPE) {
        return 'https://www.loc.gov/standards/alto/v4/alto.xsd';
    } else if (ocr === HOCR_OCR_TYPE) {
        return 'http://kba.cloud/hocr-spec/1.2/';
    } else if (ocr === PAGE_OCR_TYPE) {
        return ''; // Unknown
    }
}



function pdfUrl(adsId: string){
    return `https://www.amtsdruckschriften.bar.admin.ch/viewOrigDoc/${adsId}.pdf?id=${adsId}`;
}

export const AIS_LOOKUP = AisLookup.getInstance(config.brpAisIndexFile!);
export const ADS_LOOKUP = AdsLookupMetadataTable.getInstance(config.brpAdsIndexFile!);
export const TITLE_LOOKUP = TitlePageLookup.getInstance(config.brpTitleLookup!);
export const BRP_LOGGER = BrpOdditiesLogger.getInstance();

