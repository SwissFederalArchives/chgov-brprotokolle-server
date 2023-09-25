import {Item, RootItem} from './ItemInterfaces.js';
import {AuthTexts} from '@archival-iiif/presentation-builder/v2';
import {ManifestBehavior, CanvasBehavior} from '@archival-iiif/presentation-builder/v3';
import {CollectionMetadata} from "../service/neat_metadata.js";

export type EmptyParams = {};
export type ItemParams = { item: Item };
export type RootItemChildItemsParams = { rootItem: RootItem, childItems: Item[] };
export type CollectionIdParams = { collectionId: string };
export type CollectionPathParams = { collectionPath: string };
export type ProcessUpdateParams = { type: string, query: string };
export type TextParams = { item: TextItem };
export type ImageExtractParams = { collectionPath: string, metadata: CollectionMetadata };
export type ManifestParams = { collectionPath: string, metadata: CollectionMetadata, fileStats: any[] };
export type OcrIndexParams = { collectionPath: string, metadata: CollectionMetadata, docId: string, imageFilesPath: string};
export type ReindexParams = { collectionIds?: string[], query?: string };
export type AccessParams = { item: Item, ip?: string, identities?: string[] };
export type MetadataParams = { metadataId?: string | null, rootId?: string, collectionId?: string };

export const IMAGE_REGEX = '\.(pdf|jpe?g|tiff|png|jp2)$';
export const AUDIO_REGEX = '\.(mp3|wav|ogg|m4a)$';

export type TextItem = {
    id: string,
    itemId: string,
    collectionId: string,
    type: 'transcription' | 'translation',
    language: string | null,
    encoding: string | null,
    uri: string
};

export interface BasicIIIFMetadata {
    rights?: string;
    behavior?: ManifestBehavior;
    homepage: IIIFMetadataHomepage;
    metadata: IIIFMetadataPairs;
    seeAlso: IIIFMetadataSeeAlso;
}

export interface CanvasIIIFMetadata {
    label?: string;
    behavior?: CanvasBehavior;
}


export interface TopCollection {
    urlPattern: string;
    getId: (params: Record<string, string>) => string;
    getLabel: (params: Record<string, string>) => string;
    getChildren: (params: Record<string, string>) => Promise<Item[]>;
}

export type IIIFMetadataHomepage = { id: string; label: string; }[];
export type IIIFMetadataPairs = { label: string; value: string; }[];
export type IIIFMetadataSeeAlso = { id: string; format: string; profile: string; label: string; }[];

export type AuthTextsByType = { [type: string]: AuthTexts; };
