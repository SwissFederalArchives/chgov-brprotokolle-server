import {
    AdsMetadata, IIIFPresV3
} from "./brp/brp.types";

import {resolve} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';

import {existsSync, promises as fsPromises} from 'fs';
import {ensureDir} from "fs-extra";
import * as _ from "lodash";
import Label4Lang = IIIFPresV3.Label4Lang;
import LabelNoLang = IIIFPresV3.LabelNoLang;
import {asyncForEach, asyncForEachM} from "../lib/Utils";
import {englishifyTitle, LANGUAGE_IDENTIFIERS} from "./brp/i18n.utils";
import {
    extractNavDate,
    UriGenerator,
    IIIFUtils,
    monthOf,
    PathUtils,
    yearOf,
    AIS_LOOKUP,
    ADS_LOOKUP
} from "./brp/brp.utils";

/**
 * A standalone component to build the root / yearly / monthly collection manifests
 */
export default async function buildRootCollectionManifest() {
    logger.info('[Standalone] Running service Root Manifest Create');
    const rootUri = UriGenerator.rootCollectionId();
    const rootFile = await PathUtils.rootCollectionFile();

    if(existsSync(rootFile)){
        logger.warning("Skipping root collection creation, as it already exists. Please delete the files beforehand to regenerate");
    }

    const index: Map<string, Map<string, string[]>> = new Map();

    // Build year>month>minutes structure beforehand

    // Iterate over all AIS entries (in order to prevent "Register" to be suddenly an unwanted key)
    for(const ais of AIS_LOOKUP.listAisIds()){
        if(ais === AIS_LOOKUP.AIS_ID_KEY || ais === AIS_LOOKUP.ADS_KEY){
            // Ignore header
            continue;
        }
        const ads = AIS_LOOKUP.ads(ais);
        const meta = ADS_LOOKUP.get(ads);
        const navDate = extractNavDate(meta.publicationDate);
        const year = yearOf(navDate);
        const month = monthOf(navDate);

        if(index.has(''+year)){
            // year already exists
            if(index.get(''+year)!.has(''+month)){
                // year and month exist
                index.get(''+year)!.get(''+month)!.push(ais);
            }else{
                // year exists, month not yet
                index.get(''+year)!.set(''+month, [ais]);
            }
        }else{
            // year does not yet exist, add it and month
            index.set(''+year, createMonthMapWith(''+month, ais));
        }
    }
    logger.debug("Finished root collection index buildup")

    // Building of collection(s)

    const rootManifest = _.cloneDeep(COLLECTION_TEMPLATE);
    rootManifest.id = rootUri;

    await asyncForEachM(index, async (monthMap: Map<string, string[]>, year: string) => {
        // for each year
        const _year = Number(year);
        const yearCollectionManifest = createYearCollection(_year);
        const yearCollectionUri = UriGenerator.yearCollectionId(_year);
        const yearCollectionFile = await PathUtils.yearCollectionFile(_year);
        yearCollectionManifest.id = yearCollectionUri;

        await asyncForEachM(monthMap, async (ids: string[], month: string) => {
            // for each month
            const _month = Number(month);
            const monthCollectionManifest = createMonthCollection(_year, _month);
            const monthCollectionUri = UriGenerator.monthCollectionId(_year, _month);
            monthCollectionManifest.id = monthCollectionUri;
            const monthCollectionFile = await PathUtils.monthCollectionFile(_year, _month);

            await asyncForEach(ids, async (id: string) => {
                // for each minutes
                const meta = ADS_LOOKUP.get(AIS_LOOKUP.ads(id));
                const navDate = extractNavDate(meta.publicationDate)
                const manifest = createManifestEntry(id, navDate, meta);
                manifest.rendering = IIIFUtils.buildAllRenderings(id);
                monthCollectionManifest.items.push(manifest);
            });

            // Write manifest + add to parent collection
            await fsPromises.writeFile(monthCollectionFile, JSON.stringify(monthCollectionManifest, null, 2));
            yearCollectionManifest.items.push(createMonthCollectionEntry(_year, _month));
        });
        // Write manifest + add to parent collection
        await fsPromises.writeFile(yearCollectionFile, JSON.stringify(yearCollectionManifest, null, 2));
        rootManifest.items.push(createYearCollectionEntry(_year));
    });

    await fsPromises.writeFile(rootFile, JSON.stringify(rootManifest, null, 2));
    logger.info("[Standalone] Finished root collection creation");
}

function createMonthMapWith(month: string, ais: string){
    const monthMap : Map<string, string[]> = new Map();
    monthMap.set(month, [ais]);
    return monthMap!;
}

async function mockRootCollection(){
    logger.info('Running service MOCK Root Manifest Create for entry: ');

    const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests');

    await ensureDir(manifestContainerPath);

    const rootManifest = resolve(manifestContainerPath, 'mock', 'year-collections.json');

    if (existsSync(rootManifest)) {
        logger.warn("Skipping creation of root manifest, as it already exists. Please delete before");
        return;
    }

    let collectionManifest = _.cloneDeep(COLLECTION_TEMPLATE);

    for (let year = 1848; year <= 1963; year++) {
        const yearlyContainerPath = resolve(manifestContainerPath, 'mock', '' + year);
        await ensureDir(yearlyContainerPath);
        const yearCollectionM = createYearCollection(year);
        const yearCollectionPath = resolve(yearlyContainerPath, 'manifest.json');
        for (let month = 0; month < 12; month++) {
            // 14631 minutes from 1848 til 1963, --> 11 manifest per month on average
            const monthCollectionM = createMonthCollection(year, month + 1);
            const monthCollectionPath = resolve(yearlyContainerPath, (month + 1) + '.json');
            for (let i = 0; i < 11; i++) {
                monthCollectionM.items.push(createMockManifestEntry(year, month + 1, i + 1));
            }
            fsPromises.writeFile(monthCollectionPath, JSON.stringify(monthCollectionM, null, 2));
            yearCollectionM.items.push(createMonthCollectionEntry(year, month + 1));
        }
        fsPromises.writeFile(yearCollectionPath, JSON.stringify(yearCollectionM, null, 2));
        collectionManifest.items.push(createYearCollectionEntry(year));
    }

    await fsPromises.writeFile(rootManifest, JSON.stringify(collectionManifest, null, 2));
    logger.info('FINISHED MOCK CREATER');

}

const MONTHS = [
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
];

const COLLECTION_TEMPLATE = {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        id: config.manifestServerUrl + '/mock/year-collections.json',
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
        id: 'https://chgov.bar.admin.ch.ddev.local/manifests/32321128/32321128.json',
        type: 'Manifest',
        label: {
            de: [''],
            fr: [''],
            it: [''],
            en: ['']
        } as unknown as IIIFPresV3.Label4Lang,
        thumbnail: {
            id: 'http://chgov.bar.admin.ch.ddev.local:8182/iiif/2/32321128%2F32321128-0.jpg/full/!100,100/0/default.jpg',
            format: 'image/jpeg',
            type: 'Image'
        } as unknown as IIIFPresV3.Thumbnail,
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

function createYearCollection(year: number) {
    const manifest = _.cloneDeep(COLLECTION_TEMPLATE);
    const label = manifest.label as Label4Lang;
    label.de[0] = "[DE] Minutes of year " + year;
    label.fr[0] = "[FR] Minutes of year " + year;
    label.it[0] = "[IT] Minutes of year " + year;
    label.en[0] = "[EN] Minutes of year " + year;
    manifest.items = [];
    return manifest;
}

function createMonthCollection(year: number, monthOneIndex: number) {
    const manifest = _.cloneDeep(COLLECTION_TEMPLATE);
    const label = manifest.label as Label4Lang;
    label.de[0] = "[DE] Minutes of year " + year + " and month " + monthOneIndex;
    label.fr[0] = "[FR] Minutes of year " + year + " and month " + monthOneIndex;
    label.it[0] = "[IT] Minutes of year " + year + " and month " + monthOneIndex;
    label.en[0] = "[EN] Minutes of year " + year + " and month " + monthOneIndex;
    manifest.items = [];
    return manifest;
}

function createYearCollectionEntry(year: number) {
    const manifest = _.cloneDeep(MANIFEST_TEMPLATE) as IIIFPresV3.ManifestEntry;
    manifest.id = UriGenerator.yearCollectionId(year);
    manifest.type = 'Collection';
    manifest.navDate = `${year}-01-01T00:00:00Z`; // month=01, dayOfMonth=01 is hardcoded
    const label = manifest.label as Label4Lang;
    label.de[0] = `[DE] Minutes:   ${year}`;
    label.fr[0] = `[FR] Minutes:   ${year}`;
    label.it[0] = `[IT] Minutes:  ${year}`;
    label.en[0] = `[EN] Minutes:   ${year}`;
    return manifest;
}


function createMonthCollectionEntry(year: number, monthOneIndex: number) {
    const manifest = _.cloneDeep(MANIFEST_TEMPLATE) as IIIFPresV3.ManifestEntry;
    manifest.id = UriGenerator.monthCollectionId(year, monthOneIndex);
    manifest.type = 'Collection';
    manifest.navDate = `${year}-${String(monthOneIndex).padStart(2, '0')}-01T00:00:00Z`; // dayOfMonth=01 is hardcoded
    const label = manifest.label as Label4Lang;
    label.de[0] = `[DE] Minutes:  ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.fr[0] = `[FR] Minutes:  ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.it[0] = `[IT] Minutes:  ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.en[0] = `[EN] Minutes:  ${MONTHS[monthOneIndex - 1]} ${year}`;
    return manifest;
}

function createMockManifestEntry(year: number, monthOneIndex: number, index: number): IIIFPresV3.ManifestEntry {
    const manifest = _.cloneDeep(MANIFEST_TEMPLATE) as IIIFPresV3.ManifestEntry;
    manifest.navDate = `${year}-${String(monthOneIndex).padStart(2, '0')}-${String(index).padStart(2, '0')}T00:00:00Z`;
    const label = manifest.label as Label4Lang;
    label.de[0] = `[DE] Minutes: ${index} ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.fr[0] = `[FR] Minutes: ${index} ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.it[0] = `[IT] Minutes: ${index} ${MONTHS[monthOneIndex - 1]} ${year}`;
    label.en[0] = `[EN] Minutes: ${index} ${MONTHS[monthOneIndex - 1]} ${year}`;
    return manifest;
}

function createManifestEntry(ais: string, navDate: string, meta: AdsMetadata){
    const manifest = _.cloneDeep(MANIFEST_TEMPLATE) as IIIFPresV3.ManifestEntry;
    manifest.id = UriGenerator.manifestId(ais);
    manifest.navDate = navDate;
    manifest.label = IIIFUtils.buildLabel(
        meta.titleDE,
        meta.titleFR,
        meta.titleIT,
        englishifyTitle(meta.titleDE)
    ); // For the root collection manifest, we want the human readable title
    /*manifest.label = {
        none: [AIS_LOOKUP.record(ais)!.Signatur]
    } as IIIFPresV3.LabelNoLang; */
    return manifest;
}


function createMockRenderingEntries(lbl: string): IIIFPresV3.Rendering[] {
    const renderings: IIIFPresV3.Rendering[] = [];
    for (let i = 0; i < 4; i++) {
        const rendering = _.cloneDeep(RENDERING_TEMPLATE) as IIIFPresV3.Rendering;
        rendering.id = 'https://www.recherche.bar.admin.ch/recherche/#/de/archiv/einheit/32321128'; // mock
        rendering.label = {none: [lbl]} as LabelNoLang;
        rendering.language = [LANGUAGE_IDENTIFIERS[i]];
        renderings.push(rendering);
    }
    return renderings;
}



