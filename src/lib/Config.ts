require('dotenv').config();

export interface Config {
    env?: string;
    appInstance?: string;
    attribution?: string;
    universalViewerPath?: string;
    archivalViewerPath?: string;
    universalViewerConfigPath?: string;
    hotFolderPath?: string;
    hotFolderPattern?: string;
    imageServerUrl?: string;
    audioVideoServerUrl?: string;
    manifestServerUrl?: string;
    manifestSearchUrl?: string;
    iconsServerUrl?: string;
    imageServerName?: 'loris' | 'sharp';
    metadataOaiUrl?: string;
    metadataSrwUrl?: string;
    logoRelativePath?: string;
    logoDimensions?: [number, number],
    imageTierSeparator: string;
    cacheDisabled: boolean;
    maxTasksPerWorker: number;
    waitingMinutesBeforeIndexing: number;
    indexingInterval: number;
    services: string[];
    secret: string;
    accessToken: string;
    port: number;
    logLevel: string;
    baseUrl: string;
    dataRootPath: string;
    collectionsRelativePath: string;
    internalIpAddresses: string[];
    loginDisabled: boolean;
    extractOnly: boolean;
    skipExistingFileCheck: boolean;
    filesAlreadyExtracted: boolean;
    forceHocrToPlaintext: boolean;
    elasticSearchUrl: string;
    redis: null | {
        host: string;
        port: number;
    };
    solr: null | {
        host: string;
        port: number;
        delay: number;
    };
    mysql: {
        host: string;
        port: number;
        user: string;
        pass: string;
        db: string;
    };
    brpFullAdsDirectory?: string;
    brpAdsIndexFile?: string;
    brpAdsIndexBrokenDateFile?:string;
    brpAisIndexFile?: string;
    brpOcr?: string;
    brpSolrUpdate: boolean;
    brpTitleLookup?: string;
    brpOverrideManifests: boolean;
    brpUpdateProcessOngoing: boolean;
}

const config: Config = {
    env: process.env.NODE_ENV,
    appInstance: process.env.NODE_APP_INSTANCE,
    attribution: process.env.IIIF_SERVER_ATTRIBUTION,
    universalViewerPath: process.env.IIIF_SERVER_UNIVERSAL_VIEWER_PATH,
    archivalViewerPath: process.env.IIIF_SERVER_ARCHIVAL_VIEWER_PATH,
    universalViewerConfigPath: process.env.IIIF_SERVER_UNIVERSAL_VIEWER_CONFIG_PATH,
    hotFolderPath: process.env.IIIF_SERVER_HOT_FOLDER_PATH,
    hotFolderPattern: process.env.IIIF_SERVER_HOT_FOLDER_PATTERN,
    imageServerUrl: process.env.IIIF_SERVER_IMAGE_SERVER_URL,
    audioVideoServerUrl: process.env.IIIF_SERVER_AUDIOVIDEO_SERVER_URL,
    manifestServerUrl: process.env.IIIF_SERVER_MANIFEST_SERVER_URL,
    manifestSearchUrl: process.env.IIIF_SERVER_MANIFEST_SEARCH_URL,
    iconsServerUrl: process.env.IIIF_SERVER_ICONS_SERVER_URL,
    metadataOaiUrl: process.env.IIIF_SERVER_METADATA_OAI_URL,
    metadataSrwUrl: process.env.IIIF_SERVER_METADATA_SRW_URL,
    logoRelativePath: process.env.IIIF_SERVER_LOGO_REL_PATH,

    brpFullAdsDirectory: process.env.BRP_FULL_ADS_DIRECTORY,
    brpAdsIndexFile: process.env.BRP_ADS_INDEX_FILE,
    brpAisIndexFile: process.env.BRP_AIS_INDEX_FILE,
    brpAdsIndexBrokenDateFile: process.env.BRP_ADS_INDEX_BROKEN_DATE_FILE,
    brpOcr: process.env.BRP_OCR,
    brpTitleLookup: process.env.BRP_TITLE_LOOKUP_FILE,

    imageServerName: (() => {
        if (!process.env.IIIF_SERVER_IMAGE_SERVER_NAME)
            return undefined;

        if (!['loris', 'sharp'].includes(process.env.IIIF_SERVER_IMAGE_SERVER_NAME))
            throw new Error('Image server name should either be \'loris\' or \'sharp\'');
        return process.env.IIIF_SERVER_IMAGE_SERVER_NAME as 'loris' | 'sharp';
    })(),

    logoDimensions: (() => {
        if (!process.env.IIIF_SERVER_LOGO_DIM || (process.env.IIIF_SERVER_LOGO_DIM === 'null'))
            return undefined;

        const dimensions = process.env.IIIF_SERVER_LOGO_DIM.split(':');
        return [parseInt(dimensions[0]), parseInt(dimensions[1])] as [number, number];
    })(),

    imageTierSeparator: (() => {
        if (!process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR || (process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR === 'null'))
            throw new Error('Image tier separator is not defined');
        return process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR;
    })(),

    cacheDisabled: (() => {
        const cacheDisabled = process.env.IIIF_SERVER_CACHE_DISABLED;
        return (cacheDisabled !== undefined && (cacheDisabled.toLowerCase() === 'true' || cacheDisabled === '1'));
    })(),

    maxTasksPerWorker: (() => {
        const maxTasksPerWorker = process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER
            ? parseInt(process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER) : 0;
        return (maxTasksPerWorker >= 0) ? maxTasksPerWorker : 5;
    })(),

    waitingMinutesBeforeIndexing: (() => {
        const waitingTime = process.env.IIIF_SERVER_WAITING_MINUTES_BEFORE_INDEXING
            ? parseInt(process.env.IIIF_SERVER_WAITING_MINUTES_BEFORE_INDEXING) : 0;
        return (waitingTime >= 0) ? waitingTime : 1;
    })(),

    indexingInterval: (() => {
        const interval = process.env.IIIF_SERVER_INDEXING_INTERVAL_MS
            ? parseInt(process.env.IIIF_SERVER_INDEXING_INTERVAL_MS) : 0;
        return (interval >= 0) ? interval : 30000;
    })(),

    services: (() => {
        if (!process.env.IIIF_SERVER_SERVICES || (process.env.IIIF_SERVER_SERVICES === 'null'))
            throw new Error('Services to run are not defined');
        return process.env.IIIF_SERVER_SERVICES.split(',');
    })(),

    secret: (() => {
        if (!process.env.IIIF_SERVER_SECRET || (process.env.IIIF_SERVER_SECRET === 'null'))
            throw new Error('Secret is not defined');
        return process.env.IIIF_SERVER_SECRET;
    })(),

    accessToken: (() => {
        if (!process.env.IIIF_SERVER_ACCESS_TOKEN || (process.env.IIIF_SERVER_ACCESS_TOKEN === 'null'))
            throw new Error('The access token is not defined');
        return process.env.IIIF_SERVER_ACCESS_TOKEN;
    })(),

    port: (() => {
        const port = process.env.IIIF_SERVER_PORT ? parseInt(process.env.IIIF_SERVER_PORT) : 0;
        return (port >= 0) ? port : 3333;
    })(),

    logLevel: (() => {
        return (process.env.IIIF_SERVER_LOG_LEVEL && (process.env.IIIF_SERVER_LOG_LEVEL !== 'null'))
            ? process.env.IIIF_SERVER_LOG_LEVEL : 'debug';
    })(),

    baseUrl: (() => {
        if (!process.env.IIIF_SERVER_BASE_URL || (process.env.IIIF_SERVER_BASE_URL === 'null'))
            throw new Error('The base url is not defined');
        return process.env.IIIF_SERVER_BASE_URL;
    })(),

    dataRootPath: (() => {
        if (!process.env.IIIF_SERVER_DATA_ROOT_PATH || (process.env.IIIF_SERVER_DATA_ROOT_PATH === 'null'))
            throw new Error('The data root path is not defined');
        return process.env.IIIF_SERVER_DATA_ROOT_PATH;
    })(),

    collectionsRelativePath: (() => {
        if (!process.env.IIIF_SERVER_COLLECTIONS_REL_PATH || (process.env.IIIF_SERVER_COLLECTIONS_REL_PATH === 'null'))
            throw new Error('The collections relative path is not defined');
        return process.env.IIIF_SERVER_COLLECTIONS_REL_PATH;
    })(),

    internalIpAddresses: (() => {
        if (!process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES || (process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES === 'null'))
            return [];
        return process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES.split(',');
    })(),

    loginDisabled: (() => {
        const loginDisabled = process.env.IIIF_SERVER_LOGIN_DISABLED;
        return ((loginDisabled !== undefined) && (loginDisabled.toLowerCase() === 'true' || loginDisabled === '1'));
    })(),

    // if set to true only images and hocr are extracted, but no indexing to solr and manifest is performed
    extractOnly: (() => {
        const extractOnly = process.env.IIIF_SERVER_EXTRACT_ONLY;
        return ((extractOnly !== undefined) && (extractOnly.toLowerCase() === 'true' || extractOnly === '1'));
    })(),

    skipExistingFileCheck: (() => {
        const skipExistingFileCheck = process.env.IIIF_SERVER_SKIP_EXISTING_FILE_CHECK;
        return ((skipExistingFileCheck !== undefined) && (skipExistingFileCheck.toLowerCase() === 'true' || skipExistingFileCheck === '1'));
    })(),

    filesAlreadyExtracted: (() => {
        const filesAlreadyExtracted = process.env.IIIF_SERVER_FILES_ALREADY_EXTRACTED;
        return ((filesAlreadyExtracted !== undefined) && (filesAlreadyExtracted.toLowerCase() === 'true' || filesAlreadyExtracted === '1'));
    })(),

    forceHocrToPlaintext: (() => {
        const forceHocrToPlaintext = process.env.IIIF_SERVER_FORCE_HOCR_TO_PLAINTEXT;
        return ((forceHocrToPlaintext !== undefined) && (forceHocrToPlaintext.toLowerCase() === 'true' || forceHocrToPlaintext === '1'));
    })(),

    brpSolrUpdate : ( () => {
        const brpSolrUpdateDate = process.env.BRP_SOLR_UPDATE;
        return ((brpSolrUpdateDate !== undefined) && (brpSolrUpdateDate.toLowerCase() === 'true' || brpSolrUpdateDate === '1'));
    })(),
    // if set to true mock transkribus (with ADS id) brps are being parsed by the dir watcher and manifests & solr indexing is performed
    brpUpdateProcessOngoing : ( () => {
        const envFlag = process.env.BRP_UPDATE_PROCESS_ONGOING;
        return ((envFlag !== undefined) && (envFlag.toLowerCase() === 'true' || envFlag === '1'));
    })(),
    brpOverrideManifests : ( () => {
        const brpSolrUpdateDate = process.env.BRP_OVERRIDE_MANIFESTS;
        return ((brpSolrUpdateDate !== undefined) && (brpSolrUpdateDate.toLowerCase() === 'true' || brpSolrUpdateDate === '1'));
    })(),
    elasticSearchUrl: (() => {
        if (!process.env.IIIF_SERVER_ELASTICSEARCH_URL || (process.env.IIIF_SERVER_ELASTICSEARCH_URL === 'null'))
            throw new Error('The ElasticSearch URL is not defined');
        return process.env.IIIF_SERVER_ELASTICSEARCH_URL;
    })(),

    redis: (() => {
        const redisDisabled = process.env.IIIF_SERVER_REDIS_DISABLED;
        if (redisDisabled && (redisDisabled.toLowerCase() === 'true' || redisDisabled === '1'))
            return null;

        const host = (process.env.IIIF_SERVER_REDIS_HOST && (process.env.IIIF_SERVER_REDIS_HOST !== 'null'))
            ? process.env.IIIF_SERVER_REDIS_HOST : 'localhost';
        const port = process.env.IIIF_SERVER_REDIS_PORT && parseInt(process.env.IIIF_SERVER_REDIS_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_REDIS_PORT) : 6379;

        return {host, port};
    })(),
    solr: (() => {
        const host = (process.env.IIIF_SERVER_SOLR_HOST && (process.env.IIIF_SERVER_SOLR_HOST !== 'null'))
            ? process.env.IIIF_SERVER_SOLR_HOST : 'localhost';
        const port = process.env.IIIF_SERVER_SOLR_PORT && parseInt(process.env.IIIF_SERVER_SOLR_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_SOLR_PORT) : 8983;
        const delay = process.env.IIIF_SERVER_SOLR_DELAY && parseInt(process.env.IIIF_SERVER_SOLR_DELAY) > 0
            ? parseInt(process.env.IIIF_SERVER_SOLR_DELAY) : 100;

        return {host, port, delay};
    })(),
    mysql: (() => {
        const host = (process.env.IIIF_SERVER_MYSQL_HOST && (process.env.IIIF_SERVER_MYSQL_HOST !== 'null'))
            ? process.env.IIIF_SERVER_MYSQL_HOST : 'localhost';
        const user = (process.env.IIIF_SERVER_MYSQL_USER && (process.env.IIIF_SERVER_MYSQL_USER !== 'null'))
            ? process.env.IIIF_SERVER_MYSQL_USER : 'db';
        const pass = (process.env.IIIF_SERVER_MYSQL_PASS && (process.env.IIIF_SERVER_MYSQL_PASS !== 'null'))
            ? process.env.IIIF_SERVER_MYSQL_PASS : 'db';
        const db = (process.env.IIIF_SERVER_MYSQL_DB && (process.env.IIIF_SERVER_MYSQL_DB !== 'null'))
            ? process.env.IIIF_SERVER_MYSQL_DB : 'olr';
        const port = process.env.IIIF_SERVER_MYSQL_PORT && parseInt(process.env.IIIF_SERVER_MYSQL_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_MYSQL_PORT) : 3306;

        return {host, port, user, pass, db};
    })()
};

// For test purposes
export function setConfig<P extends keyof Config, V extends Config[P]>(property: P, value: V): void {
    if (config.env === 'test')
        config[property] = value;
}

export default config;
