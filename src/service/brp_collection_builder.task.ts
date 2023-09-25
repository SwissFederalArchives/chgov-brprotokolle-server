/**
 * Moves files to the output directory
 */

import {BrpCollectionIndexParam, BrpCollectionPage, BrpExpandedCollectionIndexParam} from "./brp/brp.types";
import logger from '../lib/Logger.js';
import {runTask} from '../lib/Task.js';
import {resolve} from "path";

import fsExtra from 'fs-extra';
import {existsSync} from "fs";
import {spawn} from "child_process";
import {pageNoComp, pageNoOf, pageNoOfUrl, pageNumber, PathUtils, toTitlePageNo} from "./brp/brp.utils.js";
import config from "../lib/Config.js";

export default async function buildCollection(param: BrpCollectionIndexParam){
    logger.info(`Running service builder for collection ${param.name}`);

    const collectionName = param.name;

    const imagesContainerPath = await PathUtils.imagesContainer(collectionName);
    const altoOcrContainerPath = await PathUtils.altoContainer(collectionName); // Frontend works, but OCR / Solr not
    const hocrOcrContainerPath = await PathUtils.hocrContainer(collectionName);

    const indexParam = {
        name: collectionName,
        basicParams: param,
        collectionFiles: []
    } as BrpExpandedCollectionIndexParam;

    logger.debug('Starting collection building for ' + collectionName);
    if (config.skipExistingFileCheck && config.filesAlreadyExtracted) {
        logger.info(`File ${collectionName} check disabled, assuming files exist. skipping`);
    } else {
        for (let i = 0; i < param.files.length; i++) {
            const file = param.files[i];
            // BE AWARE the imgName might still contain the signature (CH-BAR*)
            const imgName = file.substring(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
            const suffix = file.substring(file.lastIndexOf('.') + 1); // Image suffix
            let pageNo;
            if (param.isTitlePageDocument) {
                pageNo = toTitlePageNo(pageNumber(imgName) + 1);
            } else {
                pageNo = pageNoOf(imgName);
            }
            const targetName = `${collectionName}-${pageNo}`;
            const targetPath = resolve(imagesContainerPath, targetName + '.' + suffix);
            // Copy Image File
            await fsExtra.copy(file, targetPath);
            // check for ocr files, if existent copy them too
            const altoOcrFile = resolve(param.absoluteRoot, 'alto', imgName + '.xml');
            const hocrOcrFile = resolve(param.absoluteRoot, 'hocr', imgName + '.hocr');

            const altoDest = resolve(altoOcrContainerPath, targetName + '.xml');
            if (!(config.filesAlreadyExtracted && config.skipExistingFileCheck) && !existsSync(altoDest) && existsSync(altoOcrFile)) {
                await fsExtra.copy(altoOcrFile, altoDest);
            }

            const hocrDest = resolve(hocrOcrContainerPath, targetName + '.hocr');

            if (!config.skipExistingFileCheck && existsSync(hocrDest)) {
                logger.info(`HOCR file ${hocrDest} already exists, skipping`);
            } else {
                if (existsSync(hocrOcrFile)) {
                    await fsExtra.copy(hocrOcrFile, hocrDest);
                    logger.info('Copy of ' + imgName + ' complete.');
                } else {
                    /* hcor doesn't exist, lets create it */
                    const cmd = spawn(
                        'ocr-transform',
                        [
                            'alto', 'hocr', // might be alto4.0 ?
                            altoOcrFile, hocrDest
                        ]
                    );

                    let info = '';
                    let error = '';
                    for await(const chunk of cmd.stdout) {
                        logger.debug(`[ocr-transform]: ${chunk}`);
                        info += chunk;
                    }
                    for await (const chunk of cmd.stderr) {
                        logger.error(`[ocr-transform]: ${chunk}`);
                        error += chunk;
                    }
                    const exitCode = await new Promise((resolve, reject) => {
                        cmd.on('close', resolve);
                    });
                    if (exitCode) {
                        throw new Error('An error occurred during ocr-transform (exit code: ' + exitCode + '): ' + error);
                    }
                    logger.info(`Successfully transformed ${altoOcrFile} to ${hocrDest}`);
                }
            }
        }
    }
    if(param.isTitlePageDocument){
        // we just stop here, all we had to do for a titlepage was copy the right stuff
        return;
    }
    const images = await fsExtra.readdir(imagesContainerPath);
    for(const image of images){
        const imgName = image.substring(image.lastIndexOf('/')+1, image.lastIndexOf('.'));
        //const suffix = image.substring(image.lastIndexOf('.')+1); // Image suffix
        //let pageNo = pageNoOf(imgName);
        const page = {
            id: collectionName,
            imgFile: resolve(imagesContainerPath, image),
            base: imgName
        } as BrpCollectionPage;
        const altoOcrFile = resolve(altoOcrContainerPath, imgName+'.xml');
        const hocrOcrFile = resolve(hocrOcrContainerPath, imgName + '.hocr');
        if(config.filesAlreadyExtracted || existsSync(altoOcrFile)){
            page.altoOcr = altoOcrFile;
        }
        if(config.filesAlreadyExtracted || existsSync(hocrOcrFile)){
            page.hocrOcr = hocrOcrFile;
        }
        indexParam.collectionFiles.push(page);
    }
    indexParam.collectionFiles = indexParam.collectionFiles.sort((a, b) => pageNoComp(a.base, b.base, true));

    logger.info('Finished collection building for '+collectionName);
    if (!config.extractOnly) {
        await runTask<BrpExpandedCollectionIndexParam>('brp-manifest', indexParam);
        await runTask<BrpExpandedCollectionIndexParam>('brp-ocr-indexer', indexParam);
    }
    if (config.forceHocrToPlaintext || (config.brpUpdateProcessOngoing || !config.filesAlreadyExtracted)) {
        await runTask<BrpExpandedCollectionIndexParam>('brp-hocr-plaintext-extract', indexParam);
    }
}


