import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {existsSync, readFileSync, lstatSync} from "fs";
import fsExtra from "fs-extra";
import {resolve} from "path";
import {
    ADS_ADS_TAG,
    ADS_BOOKLET_ATTR,
    ADS_DS_TYPE_ATTR,
    ADS_DS_TYPE_TAG,
    ADS_LANG_ATTR,
    ADS_PAGES_ATTR,
    ADS_PUB_DATE_ATTR,
    ADS_ROOT_TAG,
    ADS_SRC_TYPE_ATTR,
    ADS_TXT_LANG_ATTR,
    ADS_TXT_PAGES_ATTR,
    ADS_TXT_PDF_ATTR,
    ADS_TXT_SUP_ATTR,
    ADS_TXT_SUP_ID_ATTR,
    ADS_TXT_TAG,
    ADS_TXT_TITLE_DE,
    ADS_TXT_TITLE_FR,
    ADS_TXT_TITLE_IT,
    ADS_VOL_ISSUE_ATTR,
    ADS_VOL_NO_ATTR,
    ADS_VOL_PAGES_ATTR,
    ADS_VOL_TAG,
    ADS_YEAR_ATTR,
    AdsMetadata
} from "./brp/brp.types";
import parse, {XmlDocument, XmlNode} from "fsp-xml-parser";
import {AdsCsvStreamWriter} from "../lib/AdsLookupStreamWriter.js";
import {CsvStreamWriter} from "../lib/CsvStreamWriter.js";
import {applyFix, MANUAL_FIX_ADS_ID} from "./brp/index-fixes.utils.js";
import {AIS_LOOKUP} from "./brp/brp.utils.js";

let brokenFileWriter: CsvStreamWriter;

/**
 * Simple standalone service building an index for ADS ID to Signature.
 *
 * Requires the ADS data to be  at the location specified in "brpFullAdsDirectory" config (or env)
 * The ADS data is a folder containing folders for the years, each with sub-folders with the ADS 700* IDS
 * each of these sub-folders has three files, named like the folder: *.db, *.pdf, *.xml - we only read the xml file.
 *
 * The output of this service is a CSV file with the following columns:
 * - ADS - The ADS ID of the entry
 * - SID - The Signature of the entry
 * The metadata available:
 * - HEFT_SITZUNGS_NR
 * - JAHR
 * - PUBLIKATIONS_DATUM
 * - QUELLEN_TYPE
 * - SEITE_ANZ
 * - SPRACHE
 * - DRUCKSCHRIFTTYP_ABK
 * - BAND_NR
 * - JAHRGANG
 * - SEITE_ANZ
 * - FILE_PDF
 * - TITEL_ORIGINAL_DE
 * - TITEL_ORIGINAL_FR
 * - TITEL_ORIGINAL_IT
 *
 * ---
 *
 */
export default async function buildIndexFromDirectory() {
    if (config.brpFullAdsDirectory && existsSync(config.brpFullAdsDirectory)) {
        logger.info("Full ADS Directory provided at: " + config.brpFullAdsDirectory);
    } else {
        const exists = existsSync(config.brpFullAdsDirectory!);
        throw new Error('Full ADS Directory not specified in config (or not a directory: ' + exists + '): ' + config.brpFullAdsDirectory);
    }
    if (config.brpAdsIndexFile) {
        logger.info("Resulting ADS Index file location: " + config.brpAdsIndexFile);
    } else {
        throw new Error('Index output file not specified in config (or invalid): ' + config.brpAdsIndexFile);
    }
    const outfileSuffix = config.brpAdsIndexFile.substring(config.brpAdsIndexFile.lastIndexOf('.'));
    const outfileName = config.brpAdsIndexFile.substring(0, config.brpAdsIndexFile.lastIndexOf('.'));
    const outfile = `${outfileName}-${Math.floor(new Date().getTime() / 1000)}${outfileSuffix}`;
    const writer = new AdsCsvStreamWriter(outfile);
    if(config.brpAdsIndexBrokenDateFile){
        brokenFileWriter = new CsvStreamWriter(config.brpAdsIndexBrokenDateFile, ['id', 'year', 'pubdate', 'fixed', 'title'])
    }
    logger.info('Starting to build ADS index at ' + config.brpFullAdsDirectory);
    const folders = await fsExtra.readdir(config.brpFullAdsDirectory);
    logger.info(`Found ${folders.length} entries`);
    logger.info(`Entries: ${JSON.stringify(folders)}`)
    for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        logger.info("Processing currently: " + folder);
        const currentFolder = resolve(config.brpFullAdsDirectory, folder);
        logger.info("Current folder: " + currentFolder);
        if (!existsSync(currentFolder)) {
            // don't care if entry doesn't exist
            continue;
        }
        // Check if it actually is a folder
        if (lstatSync(currentFolder).isDirectory()) {
            const subfolders = await fsExtra.readdir(currentFolder);
            for (let j = 0; j < subfolders.length; j++) {
                const subfolder = subfolders[j];
                const xmlFile = resolveAdsMetadataFile(folder, subfolder);
                if (!existsSync(xmlFile)) {
                    //throw new Error('There is no ADS XML Metadata file at ' + xmlFile);
                    logger.warn('There is no ADS XML Metadata file at ' + xmlFile);
                }
                const xmlDoc = readAdsMeta(xmlFile);
                const meta = parseAdsMeta(xmlDoc, xmlFile);
                let ais = "";
                try{
                    ais = AIS_LOOKUP.get(meta.ADS);
                }catch(e){
                    ais = "ERROR: NO LOOKUP FOR ADS "+meta.ADS;
                }
                writer.write(meta, ais);
                logger.info("Finished adding to index " + xmlFile);
            }

        } else {
            logger.info("Ignoring non-dir entry: " + currentFolder);
        }
    }
    await writer.close();
    logger.info("Finished index building");
}


/**
 * Parses the ADS XML file to an internal object
 * @param xml
 * @param file
 */
function parseAdsMeta(xml: XmlDocument, file: string): AdsMetadata {
    let sid = queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_SUP_ID_ATTR);
    if (!sid) {
        sid = "";
    }
    let sup = queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_SUP_ATTR);
    if (!sup) {
        sup = "";
    }
    const meta = {
        ADS: file.substring(file.lastIndexOf('/') + 1, file.lastIndexOf('.')),
        SID: sid,
        bookletMeetingNo: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_BOOKLET_ATTR),
        year: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_YEAR_ATTR),
        publicationDate: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_PUB_DATE_ATTR),
        sourceType: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_SRC_TYPE_ATTR),
        adsPages: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_PAGES_ATTR),
        adsLanguage: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}`, ADS_LANG_ATTR),
        letterTypeABK: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_DS_TYPE_TAG}`, ADS_DS_TYPE_ATTR),
        volumeNo: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_VOL_TAG}`, ADS_VOL_NO_ATTR),
        volumeIssue: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_VOL_TAG}`, ADS_VOL_ISSUE_ATTR),
        volumePages: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_VOL_TAG}`, ADS_VOL_PAGES_ATTR),
        supplier: sup,
        language: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_LANG_ATTR),
        pagesNo: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_PAGES_ATTR),
        filePDF: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_PDF_ATTR),
        titleDE: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_TITLE_DE),
        titleFR: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_TITLE_FR),
        titleIT: queryXml(xml, `${ADS_ROOT_TAG}.${ADS_ADS_TAG}.${ADS_TXT_TAG}`, ADS_TXT_TITLE_IT)
    } as AdsMetadata;
    applyManualFixesIfNeeded(meta);
    validateAndFixPublicationDate(meta);
    return meta;
}

function applyManualFixesIfNeeded(meta: AdsMetadata){
    if(MANUAL_FIX_ADS_ID.has(meta.ADS)){
        applyFix(meta);
    }
}

function writeBrokenDateLog(row: string[]){
    if(brokenFileWriter){
        brokenFileWriter.write(row);
    }
}

/**
 * In-place validation (and if necessary fix) of publication date, based on the title.
 * See https://jira.4eyes.ch/browse/BBI-47
 */
function validateAndFixPublicationDate(meta: AdsMetadata) {
    // Only check minutes, as there are other documents in the index
    if (!meta.titleDE.startsWith('Beschlussprotokoll')) {
        return;
    }
    const pubDate = meta.publicationDate;
    const [startDate, _] = extractDates(meta);
    if (pubDate.substr(0,10) !== startDate) {
        writeBrokenDateLog([meta.ADS, meta.year, meta.publicationDate, startDate, meta.titleDE])
        meta.publicationDate = startDate + " 00:00"; // To conform used format
    }
}


function extractDates(meta: AdsMetadata): [string, string | undefined] {
    // Case 1: Beschlussprotokoll(-e) 21.11.1848
    // Case 2: Beschlussprotokoll(-e) 18.05.-19.05.1849
    const parts = meta.titleDE.split(' ');
    const lastPartsIdx = parts.length-1;
    if (parts[lastPartsIdx].includes('-')) {
        const dates = parts[lastPartsIdx].split('-');
        const lastDatesIdx = dates.length -1;
        const endDate = convertDateToISODay(dates[lastDatesIdx]);
        const startDate = convertDateToISODay(dates[0].length < 10 ? dates[0] + meta.year : dates[0]);
        // no dot in-between as format is dd.mm., <10: fixing 1854 different format
        return [startDate, endDate];
    } else {
        return [convertDateToISODay(parts[lastPartsIdx]), undefined];
    }
}

function convertDateToISODay(date: string) {
    const parts = date.split('.');
    return parts.reverse().join('-');
}


/**
 * Simply reads the ADS XML file
 * @param file The path to the xml file to read (& parse)
 */

function readAdsMeta(file: string): XmlDocument {
    const textdata = readFileSync(file, "latin1");
    return parse(textdata);
}

/**
 * Queries an XML document for the given tag / attribute combination.
 * Internal usage only! Relies on findXmlNode
 * @param xml The xml document to query
 * @param path The dot separated path of tags
 * @param attr The attribute
 */
function queryXml(xml: XmlDocument, path: string, attr?: string): string | undefined {
    const node = findXmlNode(xml, path);
    if (node) {
        if (attr && node.attributes) {
            return node.attributes[attr] as string;
        } else if (attr === undefined) {
            return node.content;
        }
    } else {
        return undefined;
    }
}

/**
 * Finds a xml node given by a dot separated path of tags (i.e. <root-tag>.<child>.<grandchild>)
 * BEWARE this is based on the assumption, that there are no two identical tags as siblings
 * @param xml The xml document to search in
 * @param path The dot separated path of children.
 */
function findXmlNode(xml: XmlDocument, path: string): XmlNode | null | undefined {
    // first split path and reverse
    const pathrev = path.split(".").reverse();
    if (pathrev.length < 1) {
        return null; // path not properly specified
    }
    const depth = pathrev.length;
    var nodename: string = pathrev.pop() as string;
    var node = xml.root as XmlNode;
    var children = node.children;
    for (var i = 0; i < depth; i++) {
        // is current node and nodename a match?
        if (node.name == nodename) {
            // current node and nodename match!
            // check if we need to go deeper and whether children exist
            if (children && pathrev.length > 0) {
                // we need to go deeper
                for (var j = 0; j < children.length; j++) {
                    // check if the names match
                    const child = children[j] as XmlNode;
                    if (child.name === pathrev[pathrev.length - 1]) {
                        // found the correct next node!
                        nodename = pathrev.pop() as string;
                        node = child;
                        children = node.children;
                        break;
                    }
                }
            } else if (children === undefined && pathrev.length > 0) {
                // no children, but we should go deeper
                return undefined;
            }
            // we don't need to go deeper
        }
    }
    return node;
}

/**
 * Resolves the ADS metadata XML file, given the two direct parents in the filetree
 *
 * Basically resolves the given year, adsFolder to yearFolder/adsFolder/adsFolder.xml,
 * prefixed with the config brpFullAdsDirectory
 * @param yearFolder
 * @param adsFolder
 */
function resolveAdsMetadataFile(yearFolder: string, adsFolder: string): string {
    return resolve(config.brpFullAdsDirectory!, yearFolder, adsFolder, adsFolder + '.xml');
}



