import {resolve} from 'path';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {runTask} from '../lib/Task.js';
import {spawn} from "child_process";
import {existsSync, rename, promises as fsPromises} from 'fs';
import {BrpBaseCollectionIndexParam, BrpCollectionIndexParam} from "./brp/brp.types";
import {AIS_LOOKUP, pageNoOf, pageNumber, PathUtils, toTitlePageNo} from "./brp/brp.utils.js";
import * as fs from "fs";

const {readdir, stat} = fsPromises;


export default async function extractImages(indexParams: BrpBaseCollectionIndexParam) {
    logger.info(`Starting task pdf-to-images for collection ${indexParams.absoluteRoot}`);

    const collectionName = indexParams.isTitlePageDocument ? indexParams.targetId! : indexParams.name;
    const imageContainerPath = await PathUtils.imagesContainer(collectionName);

    let doImagesExist = false;

    if (config.skipExistingFileCheck && existsSync(imageContainerPath)) {
        const files = await readdir(imageContainerPath);
        if (files.length > 0) {
            // very, very likely that the images already exist.
            // TODO check for image file endings
            doImagesExist = true;
        }
    }

    if (config.filesAlreadyExtracted) {
        doImagesExist = true;
    }

    if (!doImagesExist) {
        // Since collectionName is, also for title pages, the AIS id (of the target, for title pages), this can stay
        await doImageExtraction(indexParams, collectionName, imageContainerPath);
        if(indexParams.isTitlePageDocument){
            // no further processing.
            return;
        }
    } else {
        logger.debug("Images already exist");
    }

    /* Collect necessary information of files created */
    const outputDirContents = await readdir(imageContainerPath);
    const images = []
    for (let i = 0; i < outputDirContents.length; i++) {
        const file = outputDirContents[i];
        if (file.startsWith(collectionName) && file.endsWith('.jpg')) {

            images.push(resolve(imageContainerPath, file));
        }
    }
    logger.info(`Extracted files for ${collectionName}: \n ${JSON.stringify(images, null, ' ')}`);



    const nextParams = {
        name: indexParams.name,
        absoluteRoot: indexParams.absoluteRoot,
        metadata: indexParams.metadata,
        transkribusId: 'Machine Written BRP - This should not be used if so this is an error',
        files: images
    } as BrpCollectionIndexParam;

    if(indexParams.isTitlePageDocument){
        // no further processing.
        return;
    }
    runTask<BrpCollectionIndexParam>('brp-ocr-extract', nextParams);
}

async function doImageExtraction(indexParams: BrpBaseCollectionIndexParam, collectionName: string, imageContainerPath: string) {
    logger.info("Started image extraction...");
    const ads = indexParams.isTitlePageDocument ? indexParams.name : AIS_LOOKUP.ads(collectionName);
    const target = indexParams.isTitlePageDocument ? resolve(imageContainerPath, `${ads}-%d.jpg`) : resolve(imageContainerPath, `${collectionName}-%d.jpg`);
    /* PDF Pages as images */
    const convert = spawn(
        'convert',
        [
            //'-limit', 'area', '0',
            //'-limit', 'memory', '128MB',
            '-density', '150',
            resolve(indexParams.absoluteRoot, ads + '.pdf'),
            '-quality', '90',
            target
        ]
    );
    //logger.debug(`Command: ${JSON.stringify(convert)}`)

    let data = '';
    let error = '';

    for await(const chunk of convert.stdout) {
        logger.debug('[Convert]: ' + chunk);
        data += chunk;
    }
    for await (const chunk of convert.stderr) {
        logger.error('[Convert]: ' + chunk);
        error += chunk;
    }
    const exitCode = await new Promise((resolve, _) => {
        convert.on('close', resolve);
    });

    if (exitCode) {
        throw new Error(`Subprocess convert finished with an errorcode ${exitCode}, ${error}`);
    }

    if(indexParams.isTitlePageDocument){
        // Title page extraction:
        // extraction went to <targetPath>/ADS-%d.jpg
        // so, rename ADS-%d to AIS-<roman> is required
        const outputDirContents = await readdir(imageContainerPath);
        for(const file of outputDirContents){
            // Has to start with ADS to be a title page
            if(file.startsWith(ads)){
                const pageNum = pageNumber(file);
                const titlePageNo = toTitlePageNo(pageNum+1);

                const src = resolve(imageContainerPath, file);
                const dest = resolve(imageContainerPath, `${collectionName}-${titlePageNo}.jpg`)
                await fsPromises.rename(src, dest);
                logger.info(`Titlepage cleanup: mv ${src} ${dest}`);
            }
        }
    }

    logger.info("Image extraction finished");
}
