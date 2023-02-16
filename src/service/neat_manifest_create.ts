import {parse, resolve} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';

import {AUDIO_REGEX, IMAGE_REGEX, ImageExtractParams, IndexParams, ManifestParams} from "../lib/Service";
import {promises as fsPromises, Dirent, statSync} from 'fs';
import {ensureDir} from "fs-extra";
import * as _ from "lodash";
import * as sizeOf from "image-size";
import {promisify} from "util";

const sizeOfAsync = promisify(sizeOf.imageSize);
const { readdir, writeFile } = fsPromises;

const COLLECTION_TEMPLATE = {
    '@id': '',
    '@type': 'sc:Collection',
    label: '',
    '@context': 'http://iiif.io/api/collection/2/context.json',
    manifests: [] as any
},
FILE_TEMPLATE = {
    '@id': '',
    '@type': 'sc:Manifest',
    label: '',
    '@context': 'http://iiif.io/api/collection/2/context.json',
    within: '',
    thumbnail: {
        '@id': '',
        format: 'image/jpeg'
    },
    metadata: [] as any,
    service: {
        '@context': 'http://iiif.io/api/search/0/context.json',
        '@id': '',
        profile: 'http://iiif.io/api/search/0/search'
    },
    sequences: [
        {
            "@type": "sc:Sequence",
            canvases: [] as any
        }
    ]
},
IMAGE_TEMPLATE = {
    '@id': '',
    '@type': 'sc:Canvas',
    width: 100,
    height: 100,
    images: [
        {
            '@context': 'http://iiif.io/api/presentation/2/context.json',
            '@type': 'oa:Annotation',
            on: '',
            motivation: 'sc:painting',
            resource: {
                '@id': '',
                '@type': 'dctypes:Image',
                format: 'image/jpeg',
                service: {
                    '@context': 'http://iiif.io/api/image/2/context.json',
                    '@id': '',
                    protocol: 'http://iiif.io/api/image',
                    width: 100,
                    height: 100,
                    sizes: [],
                    profile: 'http://iiif.io/api/image/2/level2.json'
                }
            }
        }
    ]
},
AUDIO_TEMPLATE = {
    '@id': '',
    '@type': 'sc:Manifest',
    label: '',
    '@context': 'http://iiif.io/api/collection/2/context.json',
    within: '',
    thumbnail: {
        '@id': '',
        format: 'image/svg+xml'
    },
    metadata: [] as any,
    mediaSequences: [
        {
            "@type": "ixif:MediaSequence",
            elements: [
                {
                    "@id": '',
                    "@type": "dctypes:Sound",
                    format: "audio/mpeg",
                    rendering: {
                        "@id": config.audioVideoServerUrl + '/txt/original',
                        label: "Original copy",
                        format: "text/plain"
                    }
                }
            ]
        }
    ]
};

export default async function createManifest({collectionPath, metadata, fileStats}: ManifestParams) {
    logger.info(`running service manifest create for collection ${collectionPath}`);

    const collectionName = parse(collectionPath).name.replace(/[#]/g, '_'),
        imagesFoldersPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'images', collectionName),
        manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', collectionName),
        collectionManifestPath = resolve(manifestContainerPath, 'manifest.json'),
        collectionManifestUrl = config.manifestServerUrl + '/' + collectionName + '/manifest.json';

    logger.debug('new collection manifest: ' + collectionManifestPath);

    const imageRegex = new RegExp(IMAGE_REGEX, 'i'),
        audioRegex = new RegExp(AUDIO_REGEX, 'i');

    // create new manifest directory
    await ensureDir(manifestContainerPath);

    // create collection manifest from template
    const collectionManifest = await getCollectionManifest(collectionManifestUrl, metadata.title);

    const documentEnts : Dirent [] = await readdir(collectionPath, {withFileTypes: true});
    const documents: string[] = documentEnts
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name)
        .sort(function(a, b){
            const aWithoutExt = a.split(".")[0],
                bWithoutExt = b.split(".")[0];

            // move main pdf to front as it wont have a number and is probably placed last
            if(aWithoutExt === collectionName) return -1;
            if(bWithoutExt === collectionName) return 1;

            return Number(aWithoutExt.split('-').pop()) - Number(bWithoutExt.split('-').pop());
        });

    await asyncForEach (documents, async (doc: string) => {
        const document = doc.split(".")[0];

        const documentManifestPath = resolve(manifestContainerPath, document + '.json');
        const documentManifestUrl = config.manifestServerUrl + '/' + collectionName + '/' + document + '.json';
        logger.info('Document manifest path: ' + documentManifestPath);

        let documentManifest = {} as any;

        if (imageRegex.test(doc)) {
            logger.debug('create manifest for document ' + document);
            const imagesFilesPath = resolve(imagesFoldersPath, document);

            const imagesEnts: Dirent [] = await readdir(imagesFilesPath, {withFileTypes: true});
            const images: string[] = imagesEnts
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name)
                .sort(function (a, b) {
                    return Number(a.split(".")[0].split('-').pop()) - Number(b.split(".")[0].split('-').pop());
                });

            const thumbnail = config.imageServerUrl + '/iiif/2/' + encodeURIComponent(collectionName + '/' + document + '/' + document + '-0.jpg') + '/full/!100,100/0/default.jpg';

            documentManifest = await getDocumentManifest(
                documentManifestUrl,
                document,
                collectionManifestUrl,
                thumbnail,
                await formatMetadata(metadata, document, fileStats)
            );

            await asyncForEach (images, async (image: string) => {
                const imageUrl = config.imageServerUrl + '/iiif/2/' + encodeURIComponent(collectionName + '/' + document + '/' + image);

                documentManifest.sequences[0].canvases.push(await getImageManifest(imageUrl, resolve(imagesFilesPath, image)));
            });

            collectionManifest.manifests.push(
                {
                    '@id': documentManifestUrl,
                    '@type': 'sc:Manifest',
                    label: document,
                    thumbnail: {
                        '@id': thumbnail,
                        format: 'image/jpeg'
                    },
                }
            );
        } else if (audioRegex.test(doc)) {
            logger.debug('create manifest for audio file ' + document);

            const fileStat = fileStats.find(f => f.name === document );
            documentManifest = await getAudioManifest(
                documentManifestUrl,
                document,
                collectionName,
                collectionManifestUrl,
                fileStat.extension,
                await formatMetadata(metadata, document, fileStats)
            );

            collectionManifest.manifests.push(
                {
                    '@id': documentManifestUrl,
                    '@type': 'sc:Manifest',
                    label: document,
                    thumbnail: {
                        '@id': config.iconsServerUrl + '/' + fileStat.extension + '.svg',
                        format: 'image/svg+xml'
                    },
                }
            );
        } else {
            logger.warn('not a valid type. no manifest created for ' + document);
            return;
        }

        // write image file
        await writeFile(documentManifestPath, JSON.stringify(documentManifest, null, 2));
    });

    await writeFile(collectionManifestPath, JSON.stringify(collectionManifest, null, 2));
}

async function getCollectionManifest(id: string, label: string) : Promise<any> {
    const collectionManifest = _.cloneDeep(COLLECTION_TEMPLATE);
    collectionManifest['@id'] = id;
    collectionManifest['label'] = label;

    return collectionManifest;
}

async function getDocumentManifest(id: string, label: string, collectionManifest: string, thumbnailId: string, metadata: object) : Promise<any> {
    const documentManifest = _.cloneDeep(FILE_TEMPLATE);
    documentManifest['@id'] = id;
    documentManifest['label'] = label;
    documentManifest['within'] = collectionManifest;
    documentManifest['thumbnail']['@id'] = thumbnailId;
    documentManifest['metadata'] = metadata;
    documentManifest['service']['@id'] = config.manifestSearchUrl + label;

    return documentManifest;
}

async function getImageManifest(imageUrl: string, imagePath: string) : Promise<any> {
    const size = await sizeOfAsync(imagePath),
        sequence = _.cloneDeep(IMAGE_TEMPLATE);

    const width = Number(size!.width),
        height = Number(size!.height);

    sequence['@id'] = imageUrl;
    sequence['width'] = width;
    sequence['height'] = height;
    sequence['images'][0]['on'] = imageUrl;
    sequence['images'][0]['resource']['@id'] = imageUrl + '/full/full/0/default.jpg';
    sequence['images'][0]['resource']['service']['@id'] = imageUrl;
    sequence['images'][0]['resource']['service']['width'] = width;
    sequence['images'][0]['resource']['service']['height'] = height;

    return sequence;
}

async function getAudioManifest(id: string, label: string, collectionName: string, collectionManifest: string, fileType: string, metadata: object) : Promise<any> {
    const audioManifest = _.cloneDeep(AUDIO_TEMPLATE);
    audioManifest['@id'] = id;
    audioManifest['label'] = label;
    audioManifest['within'] = collectionManifest;
    audioManifest['thumbnail']['@id'] = config.iconsServerUrl + '/' + fileType + '.svg';
    audioManifest['metadata'] = metadata;
    audioManifest['mediaSequences'][0]['elements'][0]['@id'] = config.audioVideoServerUrl + '/' + encodeURIComponent(collectionName + '/' + label + '.' + fileType);

    return audioManifest;
}

async function formatMetadata(metadata: any, filename: string, fileStats: any[]) : Promise<any[]>{
    const fileStat = fileStats.find(f => f.name === filename );

    return [
        {
            label: 'Titel',
            value: metadata.title
        },
        {
            label: 'Aktenzeichen',
            value: metadata.documentNumber
        },
        {
            label: 'Dateiname',
            value: filename
        },
        {
            label: 'Format',
            value:  fileStat.extension.toUpperCase()
        },
        {
            label: 'Dateigrösse',
            value: fileStat.size + ' MB'
        },
        {
            label: 'Quelle',
            value: metadata.referenceCode
        }
    ];
}

async function asyncForEach(array: any[], callback: any) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}