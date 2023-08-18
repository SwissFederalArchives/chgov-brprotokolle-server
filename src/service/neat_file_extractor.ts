import {parse, resolve} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';
import {runTask} from '../lib/Task';

import {AUDIO_REGEX, IMAGE_REGEX, ImageExtractParams, ManifestParams, OcrIndexParams} from "../lib/ServiceTypes";
import {ensureDir} from "fs-extra";
import {spawn} from "child_process";
import { promises as fsPromises } from 'fs';
import {CollectionMetadata} from "./neat_metadata";

const { readdir, stat } = fsPromises;

const _ = require('lodash');

export default async function extractFiles({collectionPath, metadata}: ImageExtractParams){
    logger.info(`running service extractor for collection ${collectionPath}`);

    const collectionName = parse(collectionPath).name.replace(/[#]/g, '_');
    const imagesContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'images', collectionName);
    const audioVideoContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'audiovideo', collectionName);

    const files = await readdir(collectionPath);
    const fileStats = [] as any;

    const imageRegex = new RegExp(IMAGE_REGEX, 'i'),
        audioRegex = new RegExp(AUDIO_REGEX, 'i');

    await asyncForEach(files, async (file: string) => {
        if (imageRegex.test(file)) {
            await extractImages(file, collectionPath, imagesContainerPath, metadata);

            fileStats.push(await getFileStats(file, collectionPath));
        } else if (audioRegex.test(file)) {
            await extractAudio(file, collectionPath, audioVideoContainerPath);

            fileStats.push(await getFileStats(file, collectionPath));
        } else {
            logger.warn('Unsupported file format ' + file);
        }
    });

    runTask<ManifestParams>('manifest', {collectionPath: collectionPath, metadata: metadata, fileStats: fileStats});
}

async function extractImages(file: string, path: string, container:string, metadata: CollectionMetadata) {
    const filename = parse(file).name.replace(/[#]/g, '_');
    logger.debug('Processing file: "' + resolve(path, file) + '"');

    // extract pdf pages as images
    const imagesFilesPath = resolve(container, filename);
    logger.debug('Extract images to ' + imagesFilesPath);

    await ensureDir(imagesFilesPath);

    const convert = spawn(
        'convert',
        [
            '-limit', 'area', '0',
            '-limit', ' memory', '128MB',
            '-density', '150',
            resolve(path, file),
            '-quality', '90',
            resolve(imagesFilesPath, filename + '-%d.jpg')
        ]
    );

    let data = "";
    for await (const chunk of convert.stdout) {
        logger.debug('convert: ' + chunk);
        data += chunk;
    }
    let error = "";
    for await (const chunk of convert.stderr) {
        logger.error('convert: ' + chunk);
        error += chunk;
    }
    const exitCode = await new Promise( (resolve, reject) => {
        convert.on('close', resolve);
    });

    if( exitCode) {
        throw new Error( `subprocess error exit ${exitCode}, ${error}`);
    }

    runTask<OcrIndexParams>('ocr-index', {collectionPath: path, metadata: metadata, docId: filename, imageFilesPath: imagesFilesPath});
}

async function extractAudio(file: string, path: string, container:string) {
    // copy audio files, for the moment no further processing required
    await ensureDir(container);

    const convert = spawn(
        'cp',
        [
            resolve(path, file),
            resolve(container, file)
        ]
    );

    let data = "";
    for await (const chunk of convert.stdout) {
        logger.debug('convert: ' + chunk);
        data += chunk;
    }
    let error = "";
    for await (const chunk of convert.stderr) {
        logger.error('convert: ' + chunk);
        error += chunk;
    }
    const exitCode = await new Promise( (resolve, reject) => {
        convert.on('close', resolve);
    });

    if( exitCode) {
        throw new Error( `subprocess error exit ${exitCode}, ${error}`);
    }
}

async function asyncForEach(array: any[], callback: any) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

async function getFileStats(file: string, path: string) : Promise<object>{
    const stats = await stat(resolve(path, file));

    return {
        'name': parse(file).name,
        'extension': file.split('.').pop(),
        'size': (stats["size"] / 1000000.0).toFixed(1)
    };
}