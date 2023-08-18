/**
 * Task to extract hOCR courtesy of tesseract (requires tesseract to be installed).
 */
import {BrpCollectionIndexParam, BrpCollectionPage, BrpExpandedCollectionIndexParam} from "./brp/brp.types";
import logger from "../lib/Logger";
import {resolve, parse} from 'path';
import config from "../lib/Config";
import {copy, ensureDir, readdir, unlink, writeFile} from "fs-extra";
import {spawn} from "child_process";
import {runTask} from "../lib/Task";
import {asyncForEach} from "../lib/Utils";

const pageNoSorter = (a: string, b: string): number => {
    return Number(extractPageNumber(a)) - Number(extractPageNumber(b));
}


export default async function extractOcr(params: BrpCollectionIndexParam) {
    logger.info(`Running service OCR Extraction for collection ${params.name}`);

    if (params.isTitlePageDocument || params.name.startsWith('70')) {
        return; // no ocr for title page
    }

    const ocrContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', params.name, 'hocr');

    await ensureDir(ocrContainerPath);

    /* Based on comments in neat_ocr_index.ts,
    a textfile with the images (line separated) is required by tesseract
     */
    const imageFiles = params.files.sort(pageNoSorter); // ensure correct ordering
    let outputDirContents = await readdir(ocrContainerPath); // check for already generated hocr files

    if (config.filesAlreadyExtracted) {
        logger.debug(`Skip extracting as it already exists according to config`);
    } else {
        for (let i = 0; i < imageFiles.length; i++) {
            try {
                const hOcrFileName = `${params.name}-${extractPageNumber(imageFiles[i])}`;
                const hOcrFilePath = resolve(ocrContainerPath, hOcrFileName);

                if (!config.skipExistingFileCheck && outputDirContents.includes(`${hOcrFileName}.hocr`)) {
                    logger.debug(`Skipping ${hOcrFileName} as it already exists`);
                } else {
                    logger.debug(`Extracting OCR for ${imageFiles[i]} to ${hOcrFileName}`);

                    const cmd = spawn(
                        'tesseract',
                        [
                            '--dpi', '150',
                            '-l', 'deu',
                            imageFiles[i],
                            hOcrFilePath,
                            'hocr'
                        ]
                    );
                    let data = '';
                    let error = '';
                    for await (const d of cmd.stdout) {
                        logger.debug(`[Tesseract]: ${d}`);
                        data += d;
                    }
                    for await(const d of cmd.stderr) {
                        if (d && typeof (d) === 'object' && typeof (d.startsWith) === 'function') {
                            if (!d.startsWith('Tesseract Open Source OCR')) { // apparently sometimes we get here wihtout d being an instance of string
                                /* for some unkown reason, tesseract prints the following on stderr: 'Tesseract Open Source OCR Engine v4.1.1 with Leptonica\n' */
                                logger.error(`[Tesseract]: ${d}`);
                                error += d;
                            }
                        } else {
                            /* For backup purposes, just print the error*/
                            logger.error(`[Tesseract]: ${d}`);
                            error += d;
                        }
                    }
                    const exitCode = await new Promise((r, _) => {
                        cmd.on('close', r);
                    });
                    if (exitCode) {
                        throw new Error(`Tesseract subprocess exited with error code ${exitCode}: ${error}`);
                    }
                }
            } catch (e) {
                const _e = e as any;
                const err = new Error(`Failed to extract ocr for ${params.name} from ${imageFiles[i]}: ${_e.message}`);
                err.stack = _e.stack;
                logger.error(`Error during Tesseract OCR Extraction: ${err}`);
            }
        }

        outputDirContents = await readdir(ocrContainerPath);
    }

    /* Collect necessary information of files created */

    const ocrFiles = []
    for (let i = 0; i < outputDirContents.length; i++) {
        const file = outputDirContents[i];
        if (file.startsWith(params.name) && file.endsWith('.hocr')) {
            ocrFiles.push(resolve(ocrContainerPath, file));
        }
    }
    logger.info(`Successfully created hocr files due to tesseract ${JSON.stringify(ocrFiles, null, " ")}`);
    const nextParams = createExpandedIndexParams(params, ocrFiles);

    if (!config.extractOnly) {
        await runTask<BrpExpandedCollectionIndexParam>('brp-manifest', nextParams);
        await runTask<BrpExpandedCollectionIndexParam>('brp-ocr-indexer', nextParams);
    }
    if (!config.filesAlreadyExtracted) {
        await runTask<BrpExpandedCollectionIndexParam>('brp-hocr-plaintext-extract', nextParams);
    }

    if(config.forceHocrToPlaintext){
        await runTask<BrpExpandedCollectionIndexParam>('brp-hocr-plaintext-extract', nextParams);
    }
}

async function createIndexFile(params: BrpCollectionIndexParam) {
    const filename = indexFileFor(params);
    logger.info(`Writing image files to tesseract index file ${filename}`);
    await writeFile(filename, params.files.sort(pageNoSorter).join('\n'));
    return filename;
}

function indexFileFor(params: BrpCollectionIndexParam) {
    return resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', params.name, `${params.name}-ocr-index.txt`);
}

function createExpandedIndexParams(
    params: BrpCollectionIndexParam,
    hocrFiles: string[]): BrpExpandedCollectionIndexParam {


    /* Ensure that image files and hocr files are both sorted by the page number */
    const imgFiles = params.files.sort(pageNoSorter);
    const ocrFiles = hocrFiles.sort(pageNoSorter);


    const p = {
        name: params.name,
        basicParams: params,
        collectionFiles: []
    } as BrpExpandedCollectionIndexParam

    for (let i = 0; i < imgFiles.length; i++) {
        const file = imgFiles[i];
        const imgName = file.substring(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
        const pageNo = imgName.substring(imgName.lastIndexOf('-') + 1);
        const targetName = `${params.name}-${pageNo}`;
        const collectionPage = {
            id: params.name,
            base: targetName,
            imgFile: file
        } as BrpCollectionPage;
        collectionPage.hocrOcr = ocrFiles[i];
        p.collectionFiles.push(collectionPage);
    }


    return p;
}

function extractPageNumber(file: string) {
    return file.substring(file.lastIndexOf('-') + 1, file.lastIndexOf('.'));
}
