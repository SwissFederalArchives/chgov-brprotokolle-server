import config from './Config.js';

interface Service {
    type: string;
    runAs: 'worker' | 'lib' | 'standalone' | 'cron';
    implementations: ImplementationService[];
}

export interface ImplementationService {
    name: string;
    loadService: () => Promise<any>;
}

export interface CronImplementationService extends ImplementationService {
    cron: string;
}

export interface ImplementationService {
    name: string;
    loadService: () => Promise<any>;
}

export const allServices: Service[] = [{
    type: 'index',
    runAs: 'worker',
    implementations: [{
        name: 'iish-index',
        loadService: async () => (await import('../service/iish/index.js')).default
    }, {
        name: 'ecodices-index',
        loadService: async () => (await import('../service/ecodices/index.js')).default
    }]
}, {
    type: 'text',
    runAs: 'worker',
    implementations: [{
        name: 'text-index',
        loadService: async () => (await import('../service/text_index.js')).default
    }]
}, {
    type: 'metadata',
    runAs: 'worker',
    implementations: [{
        name: 'iish-metadata',
        loadService: async () => (await import('../service/iish/metadata.js')).default
    }, {
        name: 'ecodices-metadata',
        loadService: async () => (await import('../service/ecodices/metadata.js')).default
    }]
}, {
    type: 'reindex',
    runAs: 'worker',
    implementations: [{
        name: 'archivematica-reindex',
        loadService: async () => (await import('../service/archivematica_reindex.js')).default
    }]
}, {
    type: 'process-update',
    runAs: 'worker',
    implementations: [{
        name: 'process-update',
        loadService: async () => (await import('../service/process_update.js')).default
    }]
}, {
    type: 'all-metadata-update',
    runAs: 'worker',
    implementations: [{
        name: 'all-metadata-update',
        loadService: async () => (await import('../service/all_metadata_update.js')).default
    }]
}, {
    type: 'waveform',
    runAs: 'worker',
    implementations: [{
        name: 'waveform',
        loadService: async () => (await import('../service/waveform.js')).default
    }]
}, {
    type: 'pdf-image',
    runAs: 'worker',
    implementations: [{
        name: 'pdf-image',
        loadService: async () => (await import('../service/pdf_image.js')).default
    }]
}, {
    type: 'video-image',
    runAs: 'worker',
    implementations: [{
        name: 'video-image',
        loadService: async () => (await import('../service/video_image.js')).default
    }]
}, {
    type: 'access',
    runAs: 'lib',
    implementations: [{
        name: 'default-access',
        loadService: async () => (await import('../service/access.js')).default
    }, {
        name: 'iish-access',
        loadService: async () => (await import('../service/iish/access.js')).default
    }, {
        name: 'niod-access',
        loadService: async () => (await import('../service/niod/access.js')).default
    }]
}, {
    type: 'auth-texts',
    runAs: 'lib',
    implementations: [{
        name: 'default-auth-texts',
        loadService: async () => (await import('../service/auth_texts.js')).default
    }, {
        name: 'iish-auth-texts',
        loadService: async () => (await import('../service/iish/auth_texts.js')).default
    }]
}, {
    type: 'basic-iiif-metadata',
    runAs: 'lib',
    implementations: [{
        name: 'default-basic-iiif-metadata',
        loadService: async () => (await import('../service/basic_iiif_metadata.js')).default
    }, {
        name: 'iish-basic-iiif-metadata',
        loadService: async () => (await import('../service/iish/basic_iiif_metadata.js')).default
    }, {
        name: 'ecodices-basic-iiif-metadata',
        loadService: async () => (await import('../service/ecodices/basic_iiif_metadata.js')).default
    }]
}, {
    type: 'canvas-iiif-metadata',
    runAs: 'lib',
    implementations: [{
        name: 'default-canvas-iiif-metadata',
        loadService: async () => (await import('../service/basic_iiif_metadata.js')).default
    }, {
        name: 'ecodices-canvas-iiif-metadata',
        loadService: async () => (await import('../service/ecodices/canvas_iiif_metadata.js')).default
    }]
}, {
    type: 'root-file-item',
    runAs: 'lib',
    implementations: [{
        name: 'default-root-file-item',
        loadService: async () => (await import('../service/root_file_item.js')).default
    }, {
        name: 'iish-root-file-item',
        loadService: async () => (await import('../service/iish/root_file_item.js')).default
    }, {
        name: 'ecodices-root-file-item',
        loadService: async () => (await import('../service/ecodices/root_file_item.js')).default
    }]
}, {
    type: 'top-collections',
    runAs: 'lib',
    implementations: [{
        name: 'default-top-collections',
        loadService: async () => (await import('../service/top_collections.js')).default
    }, {
        name: 'iish-top-collections',
        loadService: async () => (await import('../service/iish/top_collections.js')).default
    }]
}, {
    type: 'watcher',
    runAs: 'standalone',
    implementations: [{
        name: 'directory-watcher-changes',
        loadService: async () => (await import('../service/directory_watcher_changes.js')).default
    }, {
        name: 'directory-watcher-file-trigger',
        loadService: async () => (await import('../service/directory_watcher_file_trigger.js')).default
    }]
}, {
    type: 'metadata-update',
    runAs: 'cron',
    implementations: [{
        name: 'iish-metadata-update',
        cron: '58 11 * * *',
        loadService: async () => (await import('../service/iish/metadata_update.js')).default
    } as CronImplementationService]
},  {
    type: 'watcher',
    runAs: 'standalone',
    implementations: [{
        name: 'neat-directory-watcher-changes',
        loadService: async () => (await import('../service/neat_directory_watcher_changes.js')).default
    }]
}, {
    type: 'file-extract',
    runAs: 'worker',
    implementations: [{
        name: 'neat-file-extractor',
        loadService: async () => (await import('../service/neat_file_extractor.js')).default
    }]
}, {
    type: 'manifest',
    runAs: 'worker',
    implementations: [{
        name: 'neat-manifest-creator',
        loadService: async () => (await import('../service/neat_manifest_create.js')).default
    }]
}, {
    type: 'ocr-index',
    runAs: 'worker',
    implementations: [{
    name: 'neat-ocr-index',
    loadService: async () => (await import('../service/neat_ocr_index.js')).default
    }]
}, {
    type: 'metadata',
    runAs: 'worker',
    implementations: [{
    name: 'neat-metadata',
    loadService: async () => (await import('../service/neat_metadata.js')).default
    }]
}, {
    type: 'brp-watcher',
    runAs: 'standalone',
    implementations: [{
        name: 'brp-dir-watcher',
        loadService: async () => (await import('../service/brp_directory_watcher_changes.standalone.js')).default
    }]
}, {
    type: 'brp-builder',
    runAs: 'worker',
    implementations: [{
        name: 'brp-collection-builder',
        loadService: async () => (await import('../service/brp_collection_builder.task.js')).default
    }]
},{
    type: 'brp-ocr-indexer',
    runAs: 'worker',
    implementations: [{
        name: 'brp-ocr-indexer',
        loadService: async () => (await import('../service/brp_ocr_indexer.task.js')).default
    }]
},{
    type: 'brp-manifest',
    runAs: 'worker',
    implementations: [{
        name: 'brp-manifest-creater',
        loadService: async () => (await import('../service/brp_manifest_creater.task.js')).default
    }]
},/*{ // Deprecated since brp_root_collection_manifest_builder
    name: 'brp-root-manifest-creater',
    type: 'brp-root-manifest',
    runAs: 'worker',
    getService: () => require('../service/brp_collection_manifest_builder.task').default
},*/{
    type: 'brp-image-extract',
    runAs: 'worker',
    implementations: [{
        name: 'brp-pdf-to-image-extracter',
        loadService: async () => (await import('../service/brp_pdf_to_images_extractor.task.js')).default
    }]
},{
    type: 'brp-ocr-extract',
    runAs: 'worker',
    implementations: [{
        name: 'brp-ocr-extracter',
        loadService: async () => (await import('../service/brp_ocr_extracter.task.js')).default
    }]

},{
    type: 'brp-root-manifest',
    runAs: 'standalone',
    implementations: [{
        name: 'brp-root-manifest-creater',
        loadService: async () => (await import('../service/brp_root_collection_manifest_builder.standalone.js')).default
    }]
},{
    type: 'brp-hocr-plaintext-extract',
    runAs: 'worker',
    implementations: [{
        name: 'brp-hocr-to-plaintext-extracter',
        loadService: async () => (await import('../service/brp_hocr_to_plaintext_extractor.task.js')).default
    }]
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

export let isRunningWeb: boolean = config.services.find(name => name.toLowerCase() === 'web') != undefined;
export let workersRunning: { [type: string]: ImplementationService } = {};
export let libsRunning: { [type: string]: ImplementationService } = {};
export let standalonesRunning: { [type: string]: ImplementationService } = {};
export let cronsRunning: { [type: string]: CronImplementationService } = {};

for (const name of config.services.filter(name => name.toLowerCase() != 'web')) {
    const serviceFound = allServices.find(service =>
        service.implementations.find(impl =>
            impl.name.toLowerCase() === name.toLowerCase()));
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);

    const implementation = serviceFound.implementations
        .find(impl => impl.name.toLowerCase() === name.toLowerCase());
    if (!implementation)
        throw new Error(`No implementation found with the name ${name}!`);

    switch (serviceFound.runAs) {
        case 'worker':
            if (serviceFound.type in workersRunning)
                throw new Error(`There is more than one worker of type '${serviceFound.type}' configured!`);
            workersRunning[serviceFound.type] = {name: implementation.name, loadService: implementation.loadService};
            break;
        case 'lib':
            if (serviceFound.type in libsRunning)
                throw new Error(`There is more than one lib of type '${serviceFound.type}' configured!`);
            libsRunning[serviceFound.type] = implementation;
            break;
        case 'standalone':
            if (serviceFound.type in standalonesRunning)
                throw new Error(`There is more than one standalone of type '${serviceFound.type}' configured!`);
            standalonesRunning[serviceFound.type] = implementation;
            break;
        case 'cron':
            if (serviceFound.type in cronsRunning)
                throw new Error(`There is more than one cron of type '${serviceFound.type}' configured!`);
            cronsRunning[serviceFound.type] = implementation as CronImplementationService;
            break;
    }
}

for (const libService of allServices.filter(service => service.runAs === 'lib')) {
    if (!(libService.type in libsRunning)) {
        libsRunning[libService.type] = libService.implementations[0];
    }
}

// for testing purposes
export function setLibsRunning(services: { [type: string]: ImplementationService }) {
    if (config.env === 'test')
        libsRunning = services;
}

// for testing purposes
export function setWorkersRunning(services: { [type: string]: ImplementationService }) {
    if (config.env === 'test')
        workersRunning = services;
}
