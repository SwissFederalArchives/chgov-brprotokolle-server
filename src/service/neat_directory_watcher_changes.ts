import {existsSync} from 'fs';
import {resolve, parse} from 'path';

import {pathExistsSync} from 'fs-extra';
import moment from 'moment';
import * as chokidar from 'chokidar';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {runTask} from '../lib/Task.js';
import {CollectionPathParams} from '../lib/ServiceTypes.js';

const collectionsWatching: { [path: string]: Date | null } = {};

export default function watchDirectoryForChanges(): void {
    if (!config.hotFolderPath || !existsSync(config.hotFolderPath))
        throw new Error('No hot folder or incorrect hot folder to watch!' + config.hotFolderPath + '!');

    if (!config.hotFolderPattern)
        throw new Error('No hot folder root pattern configured!');
    const hotFolderPattern = new RegExp(config.hotFolderPattern);

    logger.info(`Watching hot folder ${config.hotFolderPath} for new collections`);

    chokidar.watch(
        config.hotFolderPath,
        {
            usePolling: true,
            //ignoreInitial: true
            ignorePermissionErrors: true,
            followSymlinks: true
        }
    ).on('addDir', path => {
        if (hotFolderPattern.exec(path)) {
            if (!collectionsWatching.hasOwnProperty(path)) {
                collectionsWatching[path] = new Date();
                logger.info(`Found a new collection in the hot folder: ${path}`);
            } else {
                collectionsWatching[path] = new Date();
            }
        }
    });

    setInterval(() => {
        const maxAgeLastChange = moment().subtract(config.waitingMinutesBeforeIndexing, 'minutes');

        Object.keys(collectionsWatching).forEach(path => {
            if (collectionsWatching[path]) {
                const lastChange = moment(collectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChange)) {
                    logger.info(`No changes since ${config.indexingInterval}. Start indexing ${path}`);
                    startIndexForNewCollection(path);
                }
            }
        });
    }, config.indexingInterval);
}

async function startIndexForNewCollection(path: string): Promise<void> {
    collectionsWatching[path] = null;

    const relativePath = path.replace(config.hotFolderPath as string, '.'),
        collectionName = parse(path).name.replace(/[#]/g, '_'),
        manifestContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'manifests', collectionName),
        ocrContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', collectionName);

    try {
        // check if data already exists
        if(pathExistsSync(manifestContainerPath) && pathExistsSync(ocrContainerPath)) {
            logger.info('collection ' + collectionName + ' already indexed. Delete indexed data and readd the dossier to start indexing again');
        } else {
            await runTask<CollectionPathParams>('metadata', {collectionPath: path});
        }

        delete collectionsWatching[path];
    } catch (error) {
        logger.error((error as any).stack);
    }
}
