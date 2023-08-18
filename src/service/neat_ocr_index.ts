import {resolve, parse} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';

import {OcrIndexParams} from "../lib/ServiceTypes";
import {ensureDir} from "fs-extra";
import { promises as fsPromises, Dirent} from 'fs';
import {spawn} from "child_process";
import axios from "axios";
import {CollectionMetadata} from "./neat_metadata";

const { readdir, writeFile, unlink } = fsPromises;


export default async function ocrIndex({collectionPath, metadata, docId,imageFilesPath}: OcrIndexParams) {
    logger.info(`running service ocr index for collection ${collectionPath}`);

    const collectionName = parse(collectionPath).name.replace(/[#]/g, '_');
    const ocrContainerPath = resolve(config.dataRootPath, config.collectionsRelativePath, 'ocr', collectionName);

    await ensureDir(ocrContainerPath);

    try {
        // tesseract needs a textfile with all images to correctly create hocr with pages
        const imagesEnts : Dirent [] = await readdir(imageFilesPath, {withFileTypes: true});
        const images: string[] = imagesEnts
            .filter(dirent => dirent.isFile())
            .map(dirent => resolve(imageFilesPath, dirent.name))
            .sort(function(a, b){
                return Number(a.split(".")[0].split('-').pop()) - Number(b.split(".")[0].split('-').pop());
            });

        const indexFileName = resolve(ocrContainerPath, docId + '.txt');
        logger.debug(indexFileName);
        await writeFile(indexFileName, images.join("\n"));

        // start tesseract
        const tesseract = spawn(
            'tesseract',
            [
                //'--help'
                '--dpi', '150',
                '-l', 'deu',
                indexFileName,
                resolve(ocrContainerPath, docId),
                'hocr'
            ]
        );

        let data = "";
        for await (const chunk of tesseract.stdout) {
            logger.debug('convert: ' + chunk);
            data += chunk;
        }
        let error = "";
        for await (const chunk of tesseract.stderr) {
            logger.error('convert: ' + chunk);
            error += chunk;
        }
        const exitCode = await new Promise( (resolve, reject) => {
            tesseract.on('close', resolve);
        });

        if( exitCode) {
            throw new Error( `subprocess error exit ${exitCode}, ${error}`);
        }

        await unlink(indexFileName);

        await sendToSolr(
            docId,
            resolve(ocrContainerPath, docId + '.hocr'),
            metadata,
            collectionName
        );
    }
    catch (e) {
        const _e = e as any;
        const err = new Error(`Failed to extract ocr for ${imageFilesPath}: ${_e.message}`);
        err.stack = _e.stack;
        logger.error(err);
    }
}

async function sendToSolr(id: string, pathToOcr: string, metadata: CollectionMetadata, collectionName: string) {
    const payload = {
        "add": {
            "doc": {
                id: id,
                source: collectionName,
                ocr_text: pathToOcr,
                author: '',
                title: metadata.title,
                date: metadata.dateTo,
                language: '',
                publisher: ''
            }
        }
    };

    logger.debug(JSON.stringify(payload));

    axios.post(
        `http://${config.solr!.host}:${config.solr!.port}/solr/ocr/update?softCommit=true`,
        JSON.stringify(payload),
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    ).then((response) => {
        logger.info('successful indexed ' + id);
    }, (error) => {
        logger.error(error.response.data);
    });
}
