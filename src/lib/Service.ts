import config from './Config';
import {Item} from './ItemInterfaces';
import {TextItem} from '../service/util/types';
import {CollectionMetadata} from "../service/neat_metadata";

export interface Service {
    name: string;
    type: string;

    [propName: string]: any;
}

export interface WebService extends Service {
    runAs: 'web';
}

export interface ArgService extends Service {
    runAs: 'worker' | 'lib';
    getService: () => <P, R>(params: P) => Promise<R>;
}

export interface StandaloneService extends Service {
    runAs: 'standalone' | 'cron';
    getService: () => <R>() => Promise<R>;
}

export interface CronService extends StandaloneService {
    runAs: 'cron';
    cron: string;
}

export type IndexParams = { collectionPath: string };
export type ImageExtractParams = { collectionPath: string, metadata: CollectionMetadata };
export type ManifestParams = { collectionPath: string, metadata: CollectionMetadata, fileStats: any[] };
export type OcrIndexParams = { collectionPath: string, metadata: CollectionMetadata, docId: string, imageFilesPath: string};
export type TextParams = { collectionId: string, items: TextItem[] };
export type MetadataParams = { oaiIdentifier?: string | null, collectionId?: string };
export type WaveformParams = { collectionId: string };
export type AccessParams = { item: Item, ip?: string, identities?: string[] };
export type AuthTextsParams = { item: Item };
export type IIIFMetadataParams = { item: Item };

export const IMAGE_REGEX = '\.(pdf|jpe?g|tiff|png|jp2)$';
export const AUDIO_REGEX = '\.(mp3|wav|ogg|m4a)$';

export const allServices: Service[] = [{
    name: 'web',
    type: 'web',
    runAs: 'web',
}, {
    name: 'image',
    type: 'image',
    runAs: 'image',
}, {
    name: 'directory-watcher-changes',
    type: 'watcher',
    runAs: 'standalone',
    getService: () => require('../service/directory_watcher_changes').default
}, {
    name: 'directory-watcher-file-trigger',
    type: 'watcher',
    runAs: 'standalone',
    getService: () => require('../service/directory_watcher_file_trigger').default
}, {
    name: 'iish-archivematica-index',
    type: 'index',
    runAs: 'worker',
    getService: () => require('../service/iish_archivematica_index').default
}, {
    name: 'text-index',
    type: 'text',
    runAs: 'worker',
    getService: () => require('../service/text_index').default
}, {
    name: 'iish-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: () => require('../service/iish_metadata').default
}, {
    name: 'waveform',
    type: 'waveform',
    runAs: 'worker',
    getService: () => require('../service/waveform').default
}, {
    name: 'iish-metadata-update',
    type: 'metadata-update',
    runAs: 'cron',
    cron: '58 11 * * *',
    getService: () => require('../service/iish_metadata_update').default
}, {
    name: 'iish-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/iish_access').default
}, {
    name: 'iish-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: () => require('../service/iish_auth_texts').default
}, {
    name: 'iish-iiif-metadata',
    type: 'iiif-metadata',
    runAs: 'lib',
    getService: () => require('../service/iish_iiif_metadata').default
}, {
    name: 'neat-directory-watcher-changes',
    type: 'watcher',
    runAs: 'standalone',
    getService: () => require('../service/neat_directory_watcher_changes').default
}, {
    name: 'neat-file-extractor',
    type: 'file-extract',
    runAs: 'worker',
    getService: () => require('../service/neat_file_extractor').default
}, {
    name: 'neat-manifest-creator',
    type: 'manifest',
    runAs: 'worker',
    getService: () => require('../service/neat_manifest_create').default
}, {
    name: 'neat-ocr-index',
    type: 'ocr-index',
    runAs: 'worker',
    getService: () => require('../service/neat_ocr_index').default
}, {
    name: 'neat-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: () => require('../service/neat_metadata').default
}, {
    name: 'brp-dir-watcher',
    type: 'brp-watcher',
    runAs: 'standalone',
    getService: () => require('../service/brp_directory_watcher_changes.standalone').default
}, {
    name: 'brp-collection-builder',
    type: 'brp-builder',
    runAs: 'worker',
    getService: () => require('../service/brp_collection_builder.task').default
},{
    name: 'brp-ocr-indexer',
    type: 'brp-ocr-indexer',
    runAs: 'worker',
    getService: () => require('../service/brp_ocr_indexer.task').default
},{
    name: 'brp-manifest-creater',
    type: 'brp-manifest',
    runAs: 'worker',
    getService: () => require('../service/brp_manifest_creater.task').default
},/*{ // Deprecated since brp_root_collection_manifest_builder
    name: 'brp-root-manifest-creater',
    type: 'brp-root-manifest',
    runAs: 'worker',
    getService: () => require('../service/brp_collection_manifest_builder.task').default
},*/{
    name: 'brp-pdf-to-image-extracter',
    type: 'brp-image-extract',
    runAs: 'worker',
    getService: () => require('../service/brp_pdf_to_images_extractor.task').default
},{
    name: 'brp-ocr-extracter',
    type: 'brp-ocr-extract',
    runAs: 'worker',
    getService: () => require('../service/brp_ocr_extracter.task').default
},{
    name: 'brp-root-manifest-creater',
    type: 'brp-root-manifest',
    runAs: 'standalone',
    getService: () => require('../service/brp_root_collection_manifest_builder.standalone').default
},{
    name: 'brp-hocr-to-plaintext-extracter',
    type: 'brp-hocr-plaintext-extract',
    runAs: 'worker',
    getService: () => require('../service/brp_hocr_to_plaintext_extractor.task').default
}
    /*
    * Definition of brp-ads-indexer service Single use, produces ads-index.csv
    * disabled here, to prevent unnecessary rewrites
    */
    /*
    {
        name: 'brp-ads-indexer',
        type: 'ads-indexer',
        runAs: 'standalone',
        getService: () => require('../service/brp_ads_signature_indexer.standalone').default
    }*/
];

export let servicesRunning: Service[] = config.services.map(name => {
    const serviceFound = allServices.find(service => service.name.toLowerCase() === name.toLowerCase());
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);
    return {...serviceFound};
});

servicesRunning.reduce<string[]>((acc, service) => {
    if (acc.includes(service.type))
        throw new Error(`There is more than one service of type '${service.type}' configured!`);
    acc.push(service.type);
    return acc;
}, []);

if (servicesRunning.find(service => service.runAs === 'web'))
    servicesRunning = servicesRunning.map(
        service => service.runAs === 'worker' ? <Service>{...service, runAs: 'lib'} : {...service});

// for testing purposes
export function setServicesRunning(services: Service[]) {
    if (config.env === 'test')
        servicesRunning = services;
}
