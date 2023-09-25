import {
    BrpRootCollectionIndexParam, IIIFPresV3
} from "./brp/brp.types";

import {parse, resolve} from 'path';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';

import {promises as fsPromises, Dirent, statSync, existsSync, readFileSync, writeFile} from 'fs';
import {ensureDir, writeJson} from "fs-extra";
import * as _ from "lodash";
import * as sizeOf from "image-size";
import {promisify} from "util";
import {asyncForEach} from "../lib/Utils.js";
import AsyncLock  from "async-lock";
import Label4Lang = IIIFPresV3.Label4Lang;
import {englishifyTitle, EXT_BASE_URL, EXT_LANG_ARR, EXT_LANG_MAP, LANGUAGE_IDENTIFIERS} from "./brp/i18n.utils.js";
import {extractNavDate} from "./brp/brp.utils.js";

const COLLECTION_TEMPLATE = {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        id: config.manifestServerUrl + '/manifest.json',
        type: 'Collection',
        label: {
            de: ['Bundesratsprotokolle 1848 - 1903'],
            fr: ['Procès-verbal(-aux) du conceil fédéral 1848 - 1903'],
            it: ['Protocollo di consiglio federale 1848 - 1903'],
            en: ['Minutes of Swiss Federal Council 1848 - 1903']
        } as unknown as IIIFPresV3.Label4Lang,
        items: [] as unknown as IIIFPresV3.ManifestEntry[]
    } as unknown as IIIFPresV3.Collection,
    MANIFEST_TEMPLATE = {
        id: '',
        type: 'Manifest',
        label: {
            de: [''],
            fr: [''],
            it: [''],
            en: ['']
        } as unknown as IIIFPresV3.Label4Lang,
        thumbnail: {
            id: '',
            format: 'image/jpeg',
            type: 'Image'
        } as unknown as IIIFPresV3.Thumbnail,
        rendering: [{
            id: '',
            type: 'Text',
            format: 'application/pdf',
            label: {
                de: [''],
                fr: [''],
                it: [''],
                en: ['']
            } as unknown as IIIFPresV3.Label4Lang
        }] as unknown as IIIFPresV3.Rendering[],
        navDate: '' // YYYY-MM-DDT00:00:00Z
    } as unknown as IIIFPresV3.ManifestEntry,
    RENDERING_TEMPLATE = {
        id: '',
        type: 'Text',
        format: 'application/pdf',
        label: {
            de: [''],
            fr: [''],
            it: [''],
            en: ['']
        } as unknown as IIIFPresV3.Label4Lang
    } as unknown as IIIFPresV3.Rendering;

/**
 * Creates IIIF manifest for the entire collection, all of them. Always appends!
 * @deprecated Replaced by standalone service.
 */
export default async function createRootManifest(param: BrpRootCollectionIndexParam) {
    logger.info('Running service Root Manifest Create for entry: ' + param.name);

    const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests');

    await ensureDir(manifestContainerPath);

    const rootManifest = resolve(manifestContainerPath, 'manifest.json');
    const rootManifestLock = resolve(manifestContainerPath, 'manifest.lock');

    let collectionManifest: IIIFPresV3.Collection;

    const manifestEntry = createManifestEntry(param);

    const lock = new AsyncLock();
    lock.acquire(rootManifestLock, async () => {
        if (existsSync(rootManifest)) {
            // it already exists, read, parse and add
            const contents = readFileSync(rootManifest, 'utf8');
            collectionManifest = JSON.parse(contents) as IIIFPresV3.Collection;
        } else {
            // Create new
            collectionManifest = _.cloneDeep(COLLECTION_TEMPLATE);
        }

        collectionManifest.items.push(manifestEntry);

        await fsPromises.writeFile(rootManifest, JSON.stringify(collectionManifest, null, 2));
        return true;
    }, {timeout: 10000}).then(function () {
        // lock released
    });

}

function createManifestEntry(param: BrpRootCollectionIndexParam): IIIFPresV3.ManifestEntry {
    const manifest = _.cloneDeep(MANIFEST_TEMPLATE) as IIIFPresV3.ManifestEntry;
    manifest.id = param.manifestUri;
    manifest!.thumbnail!.id = param.thumbnailUri;
    manifest.navDate = extractNavDate(param.navDate);
    manifest.rendering = createRenderingEntries(param);
    const label = manifest.label as Label4Lang;
    label.de[0] = param.metadata.titleDE;
    label.fr[0] = param.metadata.titleFR;
    label.it[0] = param.metadata.titleIT;
    label.en[0] = englishifyTitle(param.metadata.titleDE); // Experimental

    return manifest;
}

function createRenderingEntries(param: BrpRootCollectionIndexParam): IIIFPresV3.Rendering[]{
    const renderings: IIIFPresV3.Rendering[] = [];
    for(let i=0; i<4; i++){
        const rendering = _.cloneDeep(RENDERING_TEMPLATE) as IIIFPresV3.Rendering;
        rendering.id = EXT_BASE_URL + EXT_LANG_ARR[i] + param.name;
        const label = rendering.label as Label4Lang;
        label.de[0] = 'Originaldokument von ' + param.metadata.titleDE + ' in ' + EXT_LANG_MAP[i][0];
        label.fr[0] = 'Document original de ' + param.metadata.titleFR + ' en ' + EXT_LANG_MAP[i][1];
        label.it[0] = 'Documento originale di ' + param.metadata.titleIT + ' in ' + EXT_LANG_MAP[i][2];
        label.en[0] = 'Original document of ' + 'Minutes of decision(s) ' + param.metadata.titleDE.substring(param.metadata.titleDE.indexOf(' ')) + ' in ' + EXT_LANG_MAP[i][3];
        rendering.language = [LANGUAGE_IDENTIFIERS[i]];
        renderings.push(rendering);
    }
    return renderings;
}


