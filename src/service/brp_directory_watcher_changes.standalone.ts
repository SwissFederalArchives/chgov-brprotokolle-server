/**
 * Watches on a directory for changes and starts the manifest creation process for IIIF
 */


import config from "../lib/Config.js";
import {existsSync, lstatSync} from 'fs';
import {resolve, parse, relative, dirname} from 'path';
import logger from "../lib/Logger.js";
import * as chokidar from 'chokidar';
import fsExtra from "fs-extra";
import moment from 'moment';
import {AdsLookupMetadataTable} from "../lib/AdsLookupMetadataTable.js";
import {BrpBaseCollectionIndexParam, BrpCollectionIndexParam, BrpExpandedCollectionIndexParam} from "./brp/brp.types";
import {runTask} from "../lib/Task.js";
import * as path from "path";
import {AisLookup} from "../lib/AisLookup.js";
import {ADS_LOOKUP, AIS_LOOKUP, BRP_LOGGER, pageNoOf, TITLE_LOOKUP} from "./brp/brp.utils.js";

/**
 * Master directory for collection watching.
 * A map with path<->datetime of last seen
 */
const collectionsWatching: {
    [path: string]: Date | null
} = {};

/**
 * Master directory for MBRP collection watching.
 * A map with path<->datetime of last seen
 */
const mbrpCollectionsWatching: {
    [path: string]: Date | null
} = {};

/**
 * Master directory for collections that are being updated with external update script
 */
const updateCollectionsWatching: {
    [path: string]: Date | null
} = {};

/**
 * Watches a directory for changes and kickstarts the process.
 * Uses the IIIF_SERVER_HOT_FOLDER config to get the dir to watch on
 *
 * Service name: brp-dirwatcher
 * Service type: task
 * Service successor:
 */
export default async function watchDirectoryForChanges() {
    // Sanity check regarding hot folder (i.e. folder to watch)
    if (!config.hotFolderPath || !existsSync(config.hotFolderPath) || !lstatSync(config.hotFolderPath).isDirectory()) {
        // no folder to watch, aborting
        throw new Error(`No folder given, folder not existing or not a folder: ${config.hotFolderPath}`);
    }
    // sanity check if master index exists
    if (!config.brpAdsIndexFile || !existsSync(config.brpAdsIndexFile) || !lstatSync(config.brpAdsIndexFile).isFile()) {
        // no master index existing :(
        throw new Error(`Master index (ADS-Signature) not given, file inexistent or not a file: ${config.brpAdsIndexFile}`);
    }

    logger.info(`Watching for changes at: ${config.hotFolderPath}`);

    // chokidar copied and adopted from neat_directory_watcher_changes.ts
    chokidar.watch(
        config.hotFolderPath,
        {
            usePolling: true,
            ignorePermissionErrors: true,
            followSymlinks: true
        }
    ).on('addDir', async path => {
        logger.info('add event on ' + path);
        path = relative(config.hotFolderPath!, path);
        logger.info(`Relative to hotfolder: ${path}`);
        // TODO Allow single nontranskribus, pre 1904 protocols to be indexed
        /**
         * Allowed setups:
         * - a single 4xxxxxx or 5xxxxx transkribus id folder --> hand written brp
         * - a single 700xxxxx ADS ID pre 1904 --> hand written brp
         * - a single 700xxxxx ADS ID post 1903 --> machine written brp
         * - a year (19xx) folder with 700 subfolders --> bunch of machine written brp
         * - a folder with subfolders (one of the above)
         */
        if(path.startsWith('_') || path.startsWith('.')){
            /* Since the add event also fires for the entire tree to be added,
             * the following logging statement is only for debugging this service.
             */
            // logger.debug(`Ignoring something that is marked to ignore ${path}`)
            return;
        }
        if(config.brpUpdateProcessOngoing && validateAdsIdFormally(path)){
            /*
             * Currently, IIIF Server is in update mode and thus, we expect <adsid>/<aisid>-<pageno>.jpg files. ocr and images are present in datafolder
             */
            if(!updateCollectionsWatching.hasOwnProperty(path)){
                logger.info(`Found new TO BE UPDATED collection in hot folder: ${path}`);
            }
            updateCollectionsWatching[path] = new Date();
        }
        if (validateTranskribusIdFormally(path)) {
            // It's a single 4xxxxxx or 5xxxxx transkribus id OR a transkribus-indicating ADS ID 700*
            if (!collectionsWatching.hasOwnProperty(path)) {
                logger.info(`Found a new collection in the hot folder: ${path}`);
            }
            collectionsWatching[path] = new Date();
        } else if(validateMBRPAdsId(path) || validateMBRPYear(path)) {
            // It's a single 700xxxxx ADS ID post 1903 --> machine written brp
            if(!mbrpCollectionsWatching.hasOwnProperty(path)){
                logger.info(`Found a new mbrp collection in the hot folder: ${path}`);
            }
            mbrpCollectionsWatching[path] = new Date();
        } else {
            logger.info(``)
            // It's a folder, we'll move on with indexing each subfolder
            const subfolders = await fsExtra.readdir(resolve(<string>config.hotFolderPath, path));
            for (let i = 0; i < subfolders.length; i++) {
                if (lstatSync(resolve(<string>config.hotFolderPath, path, subfolders[i])).isDirectory()) {
                    // subdir is a dir, let's see whether it fits the transkribus ids
                    const _subdir = resolve(path, subfolders[i]);
                    if(subfolders.length === 0){
                        logger.debug('Ignoring FAULTY subfolder '+_subdir);
                        continue;
                    }
                    if (validateTranskribusIdFormally(subfolders[i])) {
                        // it does! add it to the watchlist
                        if (!collectionsWatching.hasOwnProperty(_subdir)) {
                            logger.info(`Found new collection as subfolder of hot folder: ${_subdir}`);
                        }
                        collectionsWatching[_subdir] = new Date();
                    }else if(validateMBRPAdsId(subfolders[i]) || validateMBRPYear(subfolders[i])){
                        // mbrp year or ads id
                        if(!mbrpCollectionsWatching.hasOwnProperty(_subdir)){
                            logger.info(`Found new mbrp collection as subfolder of hotfolder: ${_subdir}` );
                        }
                        mbrpCollectionsWatching[_subdir] = new Date();
                    }
                } else {
                    // no, not for us to consider
                }
            }
        }
    });

    // Periodically check for changes
    // Basically copy of neat_dir_watcher
    setInterval(() => {
        logger.debug('Looking for changes...');
        const maxAgeLastChanges = moment().subtract(config.waitingMinutesBeforeIndexing, 'minutes');

        /* Hand written brp */
        Object.keys(collectionsWatching).forEach(path => {
            if (collectionsWatching[path]) {
                const lastChange = moment(collectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChanges)) {
                    logger.info(`No changes since ${config.indexingInterval}. Start indexing ${path}...`);
                    startIndexForNewCollection(path);
                }
            }
        });
        /* Updating ... */
        Object.keys(updateCollectionsWatching).forEach(path => {
            if (updateCollectionsWatching[path]) {
                const lastChange = moment(updateCollectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChanges)) {
                    logger.info(`No changes since ${config.indexingInterval}. Start indexing ${path}...`);
                    startIndexForUpdate(path);
                }
            }
        });
        /* Machine written brp */
        Object.keys(mbrpCollectionsWatching).forEach(path => {
            if(mbrpCollectionsWatching[path]){
                const lastChange = moment(mbrpCollectionsWatching[path] as Date);
                if(lastChange.isBefore(maxAgeLastChanges)){
                    logger.info(`No changes since ${config.indexingInterval}. Starting to index MBRP ${path}...`);
                    startIndexForMbrp(path);
                }
            }
        })

    }, config.indexingInterval);
}

/**
 * Checks whether the given string is of length 6 and starts either with a 4 or a 5
 * @param str
 */
function validateTranskribusIdFormally(str: string) {
    return str.length === 6 && (str.startsWith('4') || str.startsWith('5'));
}


/**
 * Starts the index process for a new collection (i.e. a new "Bundesratprotokoll")
 * @param path
 */
async function startIndexForNewCollection(path: string) {
    logger.info('Starting index for collection at ' + path);
    // Reset "lastChanges"
    collectionsWatching[path] = null;
    // Be aware, either way, the actual data is two layers deeper than path
    const subdirs = await fsExtra.readdir(resolve(config.hotFolderPath!, path));
    if (subdirs.length < 1) {
        logger.error(`Ignoring ${path} as it has no subfolder (which is expected)`);
        delete collectionsWatching[path];
        return;
    }
    // Fight against .DS_Store files
    let issueName = '';
    subdirs.forEach(sub => {
        if (sub.startsWith('Band')) {
            issueName = sub;
        }
    })
    // We now have the full path to the 'root' of the collection
    // this might be:
    // <hotFolderPath>/484077/Band_194_1898/CH-BAR#1004.1#1000 ... (including alto/, page/, metadata.xml, mets.xml)
    // or
    // <hotFolderPath>/514180/Band_120_1880/700... (including alto/, page/, metadata.xml, mets.xml) BE AWARE: some of the files have the ADS ID 700... twice (separated by _)
    const issueRoot = resolve(config.hotFolderPath!, path, issueName);
    logger.debug('BRP Issue found at ' + issueRoot);
    const issueRootRelative = resolve('.', path, issueName);
    // BE AWARE: Here, we are in an issue ("Band"), however, we will have ONE collection PER minutes ("Protokoll")
    const entries = await fsExtra.readdir(issueRoot);
    const adsId2IndexParamMap = new Map<string, BrpCollectionIndexParam>();
    logger.debug('Found ' + entries.length + ' entries in issue ' + issueRoot);
    logger.debug('Lookup ready: ' + ADS_LOOKUP.isReady());
    for (let i = 0; i < entries.length; i++) {
        const entryPath = resolve(issueRoot, entries[i]);
        const entry = entries[i];
        logger.debug(`Processing: ${entry} (from parent ${dirname(entry)})`);
        if (entry.startsWith('700') || entry.startsWith('CH-BAR')) {
            if(!ADS_LOOKUP.contains(entry)){
                BRP_LOGGER.log(`${entry},LIKELY_TRANSKRIBUS_BUT_NO_ADS_LOOKUP`);
                continue;
            }
            const adsId = ADS_LOOKUP.getAdsId(entry);
            logger.debug('Lookup produced for entry ' + entry + ' the id=' + adsId);
            if (adsId2IndexParamMap.has(adsId)) {
                // ADS ID exists, just add the file
                adsId2IndexParamMap.get(adsId)!.files.push(entryPath);
            } else {
                logger.debug('New entry, add it to the list');
                // Here we check if the current document is a title page (pre 1904)
                // New entry, let's add all the things
                const params = {
                    name: adsId, // keep adsId for now (will be replaced anyways later)
                    absoluteRoot: issueRoot,
                    metadata: ADS_LOOKUP.get(adsId),
                    transkribusId: path,
                    files: [entryPath]
                } as BrpCollectionIndexParam;
                const isTitlePage = TITLE_LOOKUP.isTitlePageAds(adsId);

                // Sanity checks & logging
                if(!AIS_LOOKUP.contains(adsId) && !isTitlePage){
                    BRP_LOGGER.log(`${adsId},NO_AIS_LOOKUP_AND_NOT_TITLEPAGE`);
                    continue;
                }else if(!AIS_LOOKUP.contains(adsId) && !isTitlePage && pageNoOf(entry, true) === null){
                    BRP_LOGGER.log(`${adsId},NO_AIS_LOOKUP_AND_NOT_TITLEPAGE_AND_NO_PAGENO`);
                    continue;
                } else if(isTitlePage && !AIS_LOOKUP.contains(TITLE_LOOKUP.getTarget(adsId))){
                    BRP_LOGGER.log(`${adsId},TITLEPAGE_BUT_NO_AIS_LOOKUP_FOR_TARGET`);
                    continue;
                }else if(!isTitlePage && pageNoOf(entry, true) === null){
                    BRP_LOGGER.log(`${adsId},NOT_TITLEPAGE_AND_NO_PAGENO`);
                    continue;
                }

                if(isTitlePage){
                    // This is a titlepage and its contents have to be migrated to the corresponding minutes
                    const targetAds = TITLE_LOOKUP.getTarget(adsId);
                    params.name = AIS_LOOKUP.get(targetAds);
                    params.targetId = AIS_LOOKUP.get(targetAds);
                    params.isTitlePageDocument = true;
                }else{
                    params.name = AIS_LOOKUP.get(adsId); // Mapping of ads to ais id happens here
                }

                adsId2IndexParamMap.set(adsId, params);
            }
        } else {
            logger.debug('Entry ' + entry + ' did not match expectation. Ignoring!');
        }
    }
    logger.debug('Completed early parsing and id mapping (' + adsId2IndexParamMap.size + ' unique ADS ids)');
    // adsId2IndexParamMap is properly filled now: each entry is what we consider a collection
    adsId2IndexParamMap.forEach(async function (param: BrpCollectionIndexParam, adsId: string, map: Map<string, BrpCollectionIndexParam>) {
        logger.info('Starting to build collection for ' + adsId);
        const ocrContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', param.name)
        const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', param.name)
        if (fsExtra.pathExistsSync(manifestContainerPath) && fsExtra.pathExistsSync(ocrContainerPath)) {
            logger.warn(`Collection ${adsId} already indexed. Delete indexed data and re-add to re-start indexing process.`)
        } else {
            await runTask<BrpCollectionIndexParam>('brp-builder', param);
        }
    });

    // All the collections of an issue are processed
    delete collectionsWatching[path];

}

async function startIndexForMbrp(path: string) {
    const fullPath = resolve(config.hotFolderPath!, path);
    logger.info(`Starting MBRP index on ${fullPath}`);
    mbrpCollectionsWatching[path] = null; // Reset time
    /* Notable difference: we always operate on ADS IDs within the context of mbrp */
    const adsId2IndexMap = new Map<string, BrpBaseCollectionIndexParam>();
    /* Decide what 'type' this is: single minutes, year of minutes, folder of years? */
    if(validateMBRPAdsId(path)){
        /* we know its a single minutes */
        try {
            const params2add = buildMbrpParametersFor(fullPath);
            adsId2IndexMap.set(params2add.name, params2add);
        } catch (e) {
            logger.error(`Error while building parameters for ${fullPath}: ${e}`);
        }
    }else if(validateMBRPYear(path)){
        /* we know its a year of minutes */
        (await buildMbrpParametersForYear(fullPath)).forEach(x => adsId2IndexMap.set(x.name, x));
    }else{
        /* its a folder of years */
    }
    adsId2IndexMap.forEach(async (param: BrpBaseCollectionIndexParam) => {
        /* Do sanity check before override */
        const ocrContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', param.name)
        const manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', param.name)
        if (fsExtra.pathExistsSync(manifestContainerPath) && fsExtra.pathExistsSync(ocrContainerPath)) {
            logger.warn(`Collection ${param.name} already indexed. Delete indexed data and re-add to re-start indexing process.`)
        } else {
            await runTask<BrpBaseCollectionIndexParam>('brp-image-extract', param);
        }
    });
    delete mbrpCollectionsWatching[path];
}

/**
 * Starts indexing for an update process.
 * Update expects <adsid> at path and just the image files (0 byte in size) within the flder at path.
 * @param path
 */
async function startIndexForUpdate(path: string){
    const fullPath = resolve(config.hotFolderPath!, path);
    logger.info(`Starting UPDATE process on ${fullPath}`)
    updateCollectionsWatching[path] = null;
    const adsId = ADS_LOOKUP.getAdsId(path);
    const params = {
        name: AIS_LOOKUP.get(adsId),
        absoluteRoot: fullPath,
        metadata: ADS_LOOKUP.get(adsId),
        transkribusId: "UPDATING",
        files: []
    } as BrpCollectionIndexParam;
    const mockFiles = await fsExtra.readdir(params.absoluteRoot);
    mockFiles.filter(f => f.endsWith('.jpg'))
        .forEach(f => params.files.push(f));
    logger.info(`Created UPDATE ${JSON.stringify(params)}`)
    await runTask<BrpCollectionIndexParam>('brp-builder', params);
    delete updateCollectionsWatching[path];
}

/**
 * Builds the MBRP indexing parameters based on a given path
 * @param fullPath The path to an MBRP folder, absolute path
 */
function buildMbrpParametersFor(fullPath: string): BrpBaseCollectionIndexParam{
    /* Validate its a folder */
    if(existsSync(fullPath) && lstatSync(fullPath).isDirectory()){
        /* Re-validate its an ADS ID */
        const path = fullPath.substring(fullPath.lastIndexOf('/')+1);
        logger.debug(`Building index params for ${path} @ ${fullPath}`);
        if(validateMBRPAdsId(path)){ // Sanity check, should be fine
            const adsId = ADS_LOOKUP.getAdsId(path);
            const params = {
                name: adsId,
                absoluteRoot: fullPath,
                metadata: ADS_LOOKUP.get(adsId)
            } as BrpBaseCollectionIndexParam;
            if(TITLE_LOOKUP.isTitlePageAds(adsId)){
                // This is a titlepage and its contents have to be migrated to the corresponding minutes
                const targetAds = TITLE_LOOKUP.getTarget(adsId);
                params.targetId = AIS_LOOKUP.get(targetAds);
                params.isTitlePageDocument = true;
                logger.debug(`Found title (${adsId}) for ${params.name}`);
            }else{
                params.name = AIS_LOOKUP.get(adsId);
                logger.debug(`Found AIS ID (ADS ID) to build index for: ${params.name} (${adsId})`);
            }
            return params;
        }
    }
    throw new Error(`Given path ${fullPath} could not be used to build index params`);
}

async function buildMbrpParametersForYear(fullPathYear: string): Promise<Array<BrpBaseCollectionIndexParam>>{
    /* validate its a folder */
    if(existsSync(fullPathYear) && lstatSync(fullPathYear).isDirectory()){
        const pathYear = fullPathYear.substring(fullPathYear.lastIndexOf('/')+1);
        logger.debug(`Building index params for year ${pathYear} @ ${fullPathYear}`);
        if(validateMBRPYear(pathYear)){ // Sanity check
            const list: Array<BrpBaseCollectionIndexParam> = [];
            const entries = await fsExtra.readdir(fullPathYear);
            for(let i=0; i<entries.length; i++){
                const entry = entries[i];
                if(validateMBRPAdsId(entry)){ // Looking at YOU .DS_Store
                    try {
                        list.push(buildMbrpParametersFor(resolve(fullPathYear, entry)));
                    } catch (e) {
                        logger.error(`Error while building parameters for ${resolve(fullPathYear, entry)}: ${e}`);
                    }
                }
            }
            return list;
        }
    }
    throw new Error(`Given path ${fullPathYear} was not an MBRP Year Folder.`);
}

/**
 * Validates if the given path is likely a ADS ID (is 8 chars long and starts with 700)
 * @param name
 */
function validateAdsIdFormally(name: string) {
    return name.length === 8 && name.startsWith('700');
}

/**
 * Validates if the given path is likely a year name from the 20th century (is 4 chars long and starts with 19)
 * @param name
 */
function validateYearFormally(name: string) {
    return name.length === 4 && name.startsWith('19');
}

/**
 * Validates that the given name is an ADS ID that is form the period of handwritten BRPs
 * @param name
 */
function validateTranskribusAdsId(name: string){
    return Number(name) < 70009744;
}

/**
 * Validates that the given name is likely an ADS ID and is from the period of machine written BRPs (MBRP), i.e. post 1903
 * @param name
 */
function validateMBRPAdsId(name: string) {
    return validateAdsIdFormally(name) && Number(name) >= 70009744;
}

/**
 * Validates that the given name is likely a year from the period of machine written BRPs (MBRP), i.e. between 1903 and 1963
 * @param name
 */
function validateMBRPYear(name: string) {
    return validateYearFormally(name) && Number(name) >= 1904 && Number(name) <= 1963;
}
