await import('dotenv/config');

const isEnabled = (value?: string): boolean => !value || value === '1' || value.toLowerCase() === 'true';

export interface Config {
    env?: string;
    appInstance?: string;
    attribution?: string;
    hotFolderPath?: string;
    hotFolderPattern?: string;
    metadataOaiUrl?: string;
    metadataSrwUrl?: string;
    metadataPath?: string;
    logoRelativePath?: string;
    audioRelativePath?: string;
    elasticSearchUser?: string;
    elasticSearchPassword?: string;
    ipAddressHeader?: string;
    imageServerUrl: string;
    imageServerName: 'loris' | 'sharp';
    audioVideoServerUrl?: string;
    manifestServerUrl?: string;
    manifestSearchUrl?: string;
    iconsServerUrl?: string;
    logoDimensions?: [number, number];
    audioDimensions?: [number, number];
    viewerUrl: string;
    pdfPagesThreshold?: number;
    pdfSessionSeconds?: number;
    pdfImageSize: string;
    videoMosaicWidth: number,
    videoTilesRows: number,
    videoTilesColumns: number,
    imageTierSeparator: string;
    maxTasksPerWorker: number;
    maxSearchResults: number;
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
    derivativeRelativePath: string;
    internalIpAddresses: string[];
    loginEnabled: boolean;
    extractOnly: boolean;
    skipExistingFileCheck: boolean;
    filesAlreadyExtracted: boolean;
    forceHocrToPlaintext: boolean;
    externalEnabled: boolean;
    dnsCacheEnabled: boolean;
    accessTtl: number;
    elasticSearchUrl: string;
    elasticSearchIndexItems: string;
    elasticSearchIndexTexts: string;
    redisVolatile: null | {
        host: string;
        port: number;
    };
    redisPersistent: null | {
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
    brpOcrExtractionMode: string,
    brpOcrAltoExtractionMaxParallelProcesses: number,
}

const config: Config = {
    env: process.env.NODE_ENV,
    appInstance: process.env.NODE_APP_INSTANCE,
    attribution: process.env.IIIF_SERVER_ATTRIBUTION,
    hotFolderPath: process.env.IIIF_SERVER_HOT_FOLDER_PATH,
    hotFolderPattern: process.env.IIIF_SERVER_HOT_FOLDER_PATTERN,
    metadataOaiUrl: process.env.IIIF_SERVER_METADATA_OAI_URL,
    metadataSrwUrl: process.env.IIIF_SERVER_METADATA_SRW_URL,
    metadataPath: process.env.IIIF_SERVER_METADATA_PATH,
    logoRelativePath: process.env.IIIF_SERVER_LOGO_REL_PATH,
    audioRelativePath: process.env.IIIF_SERVER_AUDIO_REL_PATH,
    elasticSearchUser: process.env.IIIF_SERVER_ELASTICSEARCH_USER,
    elasticSearchPassword: process.env.IIIF_SERVER_ELASTICSEARCH_PASSWORD,
    ipAddressHeader: process.env.IIIF_SERVER_IP_ADDRESS_HEADER,
    brpFullAdsDirectory: process.env.BRP_FULL_ADS_DIRECTORY,
    brpAdsIndexFile: process.env.BRP_ADS_INDEX_FILE,
    brpAisIndexFile: process.env.BRP_AIS_INDEX_FILE,
    brpAdsIndexBrokenDateFile: process.env.BRP_ADS_INDEX_BROKEN_DATE_FILE,
    brpOcr: process.env.BRP_OCR,
    brpTitleLookup: process.env.BRP_TITLE_LOOKUP_FILE,

    loginEnabled: isEnabled(process.env.IIIF_SERVER_LOGIN_ENABLED),
    externalEnabled: isEnabled(process.env.IIIF_SERVER_EXTERNAL_ENABLED),
    dnsCacheEnabled: isEnabled(process.env.IIIF_SERVER_DNS_CACHE_ENABLED),
    // if set to true only images and hocr are extracted, but no indexing to solr and manifest is performed
    extractOnly: isEnabled(process.env.IIIF_SERVER_EXTRACT_ONLY),
    skipExistingFileCheck: isEnabled(process.env.IIIF_SERVER_SKIP_EXISTING_FILE_CHECK),
    filesAlreadyExtracted: isEnabled(process.env.IIIF_SERVER_FILES_ALREADY_EXTRACTED),
    forceHocrToPlaintext: isEnabled(process.env.IIIF_SERVER_FORCE_HOCR_TO_PLAINTEXT),
    brpSolrUpdate: isEnabled(process.env.BRP_SOLR_UPDATE),
    // if set to true mock transkribus (with ADS id) brps are being parsed by the dir watcher and manifests & solr indexing is performed
    brpUpdateProcessOngoing: isEnabled(process.env.BRP_UPDATE_PROCESS_ONGOING),
    brpOverrideManifests: isEnabled(process.env.BRP_OVERRIDE_MANIFESTS),

    brpOcrExtractionMode: (_ => {
        if (!process.env.BRP_OCR_EXTRACTION_MODE || (process.env.BRP_OCR_EXTRACTION_MODE === 'null'))
            throw new Error('BRP ocr extraction mode is not defined');
        return process.env.BRP_OCR_EXTRACTION_MODE;
    })(),

    brpOcrAltoExtractionMaxParallelProcesses: (_ => {
        if (!process.env.BRP_OCR_ALTO_EXTRACTION_MAX_PARALLEL_PROCESSES || (process.env.BRP_OCR_ALTO_EXTRACTION_MAX_PARALLEL_PROCESSES === 'null'))
            throw new Error('BRP ocr alto extraction max parallel processes is not defined');
        return Number(process.env.BRP_OCR_ALTO_EXTRACTION_MAX_PARALLEL_PROCESSES);
    })(),

    imageServerUrl: (_ => {
        if (!process.env.IIIF_SERVER_IMAGE_SERVER_URL || (process.env.IIIF_SERVER_IMAGE_SERVER_URL === 'null'))
            throw new Error('Image server url is not defined');
        return process.env.IIIF_SERVER_IMAGE_SERVER_URL;
    })(),

    imageServerName: (_ => {
        if (!process.env.IIIF_SERVER_IMAGE_SERVER_NAME ||
            !['loris', 'sharp'].includes(process.env.IIIF_SERVER_IMAGE_SERVER_NAME))
            throw new Error('Image server name should either be \'loris\' or \'sharp\'');
        return process.env.IIIF_SERVER_IMAGE_SERVER_NAME as 'loris' | 'sharp';
    })(),
    
    audioVideoServerUrl: (_ => {
        if (!process.env.IIIF_SERVER_AUDIOVIDEO_SERVER_URL || (process.env.IIIF_SERVER_AUDIOVIDEO_SERVER_URL === 'null'))
            throw new Error('Audio/Video server url is not defined');
        return process.env.IIIF_SERVER_AUDIOVIDEO_SERVER_URL;
    })(),
    
    manifestServerUrl: (_ => {
        if (!process.env.IIIF_SERVER_MANIFEST_SERVER_URL || (process.env.IIIF_SERVER_MANIFEST_SERVER_URL === 'null'))
            throw new Error('Manifest server url is not defined');
        return process.env.IIIF_SERVER_MANIFEST_SERVER_URL;
    })(),
    
    manifestSearchUrl: (_ => {
        if (!process.env.IIIF_SERVER_MANIFEST_SEARCH_URL || (process.env.IIIF_SERVER_MANIFEST_SEARCH_URL === 'null'))
            throw new Error('Manifest search url is not defined');
        return process.env.IIIF_SERVER_MANIFEST_SEARCH_URL;
    })(),

    iconsServerUrl: (_ => {
        if (!process.env.IIIF_SERVER_ICONS_SERVER_URL || (process.env.IIIF_SERVER_ICONS_SERVER_URL === 'null'))
            throw new Error('Icons server url is not defined');
        return process.env.IIIF_SERVER_ICONS_SERVER_URL;
    })(),

    logoDimensions: (_ => {
        if (!process.env.IIIF_SERVER_LOGO_DIM || (process.env.IIIF_SERVER_LOGO_DIM === 'null'))
            return undefined;

        const dimensions = process.env.IIIF_SERVER_LOGO_DIM.split(':');
        return [parseInt(dimensions[0]), parseInt(dimensions[1])] as [number, number];
    })(),

    audioDimensions: (_ => {
        if (!process.env.IIIF_SERVER_AUDIO_DIM || (process.env.IIIF_SERVER_AUDIO_DIM === 'null'))
            return undefined;

        const dimensions = process.env.IIIF_SERVER_AUDIO_DIM.split(':');
        return [parseInt(dimensions[0]), parseInt(dimensions[1])] as [number, number];
    })(),

    viewerUrl: (_ => {
        // UniversalViewer URL: https://www.universalviewer.dev/uv.html#?manifest=
        if (!process.env.IIIF_SERVER_VIEWER_URL || (process.env.IIIF_SERVER_VIEWER_URL === 'null'))
            return 'https://projectmirador.org/embed/?iiif-content=';

        return process.env.IIIF_SERVER_VIEWER_URL;
    })(),

    pdfPagesThreshold: (_ => {
        if (!process.env.IIIF_SERVER_PDF_PAGES_THRESHOLD || (process.env.IIIF_SERVER_PDF_PAGES_THRESHOLD === 'null'))
            return undefined;

        return parseInt(process.env.IIIF_SERVER_PDF_PAGES_THRESHOLD);
    })(),

    pdfSessionSeconds: (_ => {
        if (!process.env.IIIF_SERVER_PDF_SESSION_SECONDS || (process.env.IIIF_SERVER_PDF_SESSION_SECONDS === 'null'))
            return undefined;

        return parseInt(process.env.IIIF_SERVER_PDF_SESSION_SECONDS);
    })(),

    pdfImageSize: (_ => {
        return process.env.IIIF_SERVER_PDF_IMAGE_SIZE || 'max';
    })(),

    videoMosaicWidth: (_ => {
        const width = process.env.IIIF_SERVER_VIDEO_MOSAIC_WIDTH
            ? parseInt(process.env.IIIF_SERVER_VIDEO_MOSAIC_WIDTH) : 0;
        return width > 0 ? width : 500;
    })(),

    videoTilesRows: (_ => {
        const rows = process.env.IIIF_SERVER_VIDEO_TILES_ROWS
            ? parseInt(process.env.IIIF_SERVER_VIDEO_TILES_ROWS) : 0;
        return rows > 0 ? rows : 6;
    })(),

    videoTilesColumns: (_ => {
        const columns = process.env.IIIF_SERVER_VIDEO_TILES_COLUMNS
            ? parseInt(process.env.IIIF_SERVER_VIDEO_TILES_COLUMNS) : 0;
        return columns > 0 ? columns : 5;
    })(),

    imageTierSeparator: (_ => {
        if (!process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR || (process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR === 'null'))
            throw new Error('Image tier separator is not defined');
        return process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR;
    })(),

    maxTasksPerWorker: (_ => {
        const maxTasksPerWorker = process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER
            ? parseInt(process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER) : 0;
        return (maxTasksPerWorker > 0) ? maxTasksPerWorker : 5;
    })(),

    maxSearchResults: (_ => {
        const maxSearchResults = process.env.IIIF_SERVER_MAX_SEARCH_RESULTS
            ? parseInt(process.env.IIIF_SERVER_MAX_SEARCH_RESULTS) : 0;
        return (maxSearchResults > 0) ? maxSearchResults : 5000;
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

    services: (_ => {
        if (!process.env.IIIF_SERVER_SERVICES || (process.env.IIIF_SERVER_SERVICES === 'null'))
            throw new Error('Services to run are not defined');
        return process.env.IIIF_SERVER_SERVICES.split(',');
    })(),

    secret: (_ => {
        if (!process.env.IIIF_SERVER_SECRET || (process.env.IIIF_SERVER_SECRET === 'null'))
            throw new Error('Secret is not defined');
        return process.env.IIIF_SERVER_SECRET;
    })(),

    accessToken: (_ => {
        if (!process.env.IIIF_SERVER_ACCESS_TOKEN || (process.env.IIIF_SERVER_ACCESS_TOKEN === 'null'))
            throw new Error('The access token is not defined');
        return process.env.IIIF_SERVER_ACCESS_TOKEN;
    })(),

    port: (_ => {
        const port = process.env.IIIF_SERVER_PORT ? parseInt(process.env.IIIF_SERVER_PORT) : 0;
        return (port > 0) ? port : 3333;
    })(),

    logLevel: (_ => {
        return (process.env.IIIF_SERVER_LOG_LEVEL && (process.env.IIIF_SERVER_LOG_LEVEL !== 'null'))
            ? process.env.IIIF_SERVER_LOG_LEVEL : 'debug';
    })(),

    baseUrl: (_ => {
        if (!process.env.IIIF_SERVER_BASE_URL || (process.env.IIIF_SERVER_BASE_URL === 'null'))
            throw new Error('The base url is not defined');
        return process.env.IIIF_SERVER_BASE_URL;
    })(),

    dataRootPath: (_ => {
        if (!process.env.IIIF_SERVER_DATA_ROOT_PATH || (process.env.IIIF_SERVER_DATA_ROOT_PATH === 'null'))
            throw new Error('The data root path is not defined');
        return process.env.IIIF_SERVER_DATA_ROOT_PATH;
    })(),

    collectionsRelativePath: (_ => {
        if (!process.env.IIIF_SERVER_COLLECTIONS_REL_PATH || (process.env.IIIF_SERVER_COLLECTIONS_REL_PATH === 'null'))
            throw new Error('The collections relative path is not defined');
        return process.env.IIIF_SERVER_COLLECTIONS_REL_PATH;
    })(),

    derivativeRelativePath: (_ => {
        if (!process.env.IIIF_SERVER_DERIVATIVE_REL_PATH || (process.env.IIIF_SERVER_DERIVATIVE_REL_PATH === 'null'))
            throw new Error('The derivative relative path is not defined');
        return process.env.IIIF_SERVER_DERIVATIVE_REL_PATH;
    })(),

    internalIpAddresses: (_ => {
        if (!process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES || (process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES === 'null'))
            return [];
        return process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES.split(',');
    })(),

    accessTtl: (_ => {
        const accessTtl = process.env.IIIF_SERVER_ACCESS_TTL ? parseInt(process.env.IIIF_SERVER_ACCESS_TTL) : 0;
        return (accessTtl > 0) ? accessTtl : 3600;
    })(),

    elasticSearchUrl: (_ => {
        if (!process.env.IIIF_SERVER_ELASTICSEARCH_URL || (process.env.IIIF_SERVER_ELASTICSEARCH_URL === 'null'))
            throw new Error('The ElasticSearch URL is not defined');
        return process.env.IIIF_SERVER_ELASTICSEARCH_URL;
    })(),

    elasticSearchIndexItems: (_ => {
        return (!process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX || (process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX === 'null'))
            ? 'items'
            : process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX.concat('_', 'items');
    })(),

    elasticSearchIndexTexts: (_ => {
        return (!process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX || (process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX === 'null'))
            ? 'texts'
            : process.env.IIIF_SERVER_ELASTICSEARCH_INDEX_PREFIX.concat('_', 'texts');
    })(),

    redisVolatile: (_ => {
        if (!isEnabled(process.env.IIIF_SERVER_REDIS_VOLATILE_ENABLED))
            return null;

        const host = (process.env.IIIF_SERVER_REDIS_VOLATILE_HOST && (process.env.IIIF_SERVER_REDIS_VOLATILE_HOST !== 'null'))
            ? process.env.IIIF_SERVER_REDIS_VOLATILE_HOST : 'localhost';
        const port = process.env.IIIF_SERVER_REDIS_VOLATILE_PORT && parseInt(process.env.IIIF_SERVER_REDIS_VOLATILE_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_REDIS_VOLATILE_PORT) : 6379;

        return {host, port};
    })(),

    redisPersistent: (_ => {
        if (!isEnabled(process.env.IIIF_SERVER_REDIS_PERSIST_ENABLED))
            return null;

        const host = (process.env.IIIF_SERVER_REDIS_PERSIST_HOST && (process.env.IIIF_SERVER_REDIS_PERSIST_HOST !== 'null'))
            ? process.env.IIIF_SERVER_REDIS_PERSIST_HOST : 'localhost';
        const port = process.env.IIIF_SERVER_REDIS_PERSIST_PORT && parseInt(process.env.IIIF_SERVER_REDIS_PERSIST_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_REDIS_PERSIST_PORT) : 6379;

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
