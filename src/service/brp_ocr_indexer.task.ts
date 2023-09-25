import {
    AdsMetadata,
    BrpExpandedCollectionIndexParam
} from "./brp/brp.types";

import {resolve, parse} from 'path';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';

import {OcrIndexParams} from "../lib/ServiceTypes.js";
import {ensureDir} from "fs-extra";
import { promises as fsPromises, Dirent} from 'fs';
import {spawn, spawnSync} from "child_process";

import { axiosInstance } from '../lib/AxiosKeepAliveAgent.js';

import {ALTO_OCR_TYPE, HOCR_OCR_TYPE, PAGE_OCR_TYPE} from "./brp/brp.utils.js";
import {promisify} from "util";

const sleep = promisify(setTimeout);

let runningTask = 0;

export default async function ocrIndex(param: BrpExpandedCollectionIndexParam){
    logger.info(`Running service OCR index for collection ${param.name}`);

    const docs = [];

    // Based on information on https://github.com/dbmdz/solr-ocrhighlighting ALTO is natively supported
    for (let i = 0; i <param.collectionFiles.length; i++) {
        let ocr = '';
        switch (config.brpOcr){
            case ALTO_OCR_TYPE:
                ocr = param
                    .collectionFiles[i].altoOcr!;
                break;
            case PAGE_OCR_TYPE:
                ocr = param.collectionFiles[i].pageOcr!;
                break;
            case HOCR_OCR_TYPE:
                ocr = param.collectionFiles[i].hocrOcr!;
        }

        docs.push(
            createDoc(
                param.collectionFiles[i].base,
                //param.collectionFiles[i].altoOcr!,
                ocr,
                param.basicParams.metadata,
                param.name
            )
        );
    }

    await sendToSolr(param.name, docs);

    await commit();

    logger.info("OCR Index completed!")
}

function createDoc(id: string, path: string, meta: AdsMetadata, collectionName: string) {
    return {
        id: id,
        source: collectionName,
        ocr_text: path,
        author: '',
        title: meta.titleDE,
        date: meta.publicationDate.substr(0,10)+'T00:00:00Z', // I once read somewhere this is the official way to indicate 'that day'.
        language: '',
        publisher: ''
    }
}

/**
 * Sends OCR information to SOLR. Basically copy&paste from neat_ocr_index.ts
 * @param id
 * @param docs []
 */
async function sendToSolr(id: string, docs: any[]){
    const payload = {
        'add': docs
    };

    return axiosInstance.post(
        `http://${config.solr!.host}:${config.solr!.port}/solr/ocr/update?softCommit=true`,
        JSON.stringify(payload),
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    ).then((response) => {
        // logger.debug(`Solr update response: ${JSON.stringify(response)}`);
        logger.info(`Response for indexing ${id} with: ${response.status} - ${JSON.stringify(response.data)}`);
        logger.info('successful indexed ' + id);
    }, (error) => {
        logger.error(`An error occurred during or after sending OCR to Solr: ${JSON.stringify(error)}`);
    });
}

async function commit(){
    return axiosInstance.get(`http://${config.solr!.host}:${config.solr!.port}/solr/ocr/update?commit=true`)
        .then((response) => {
            // logger.debug(`Solr update response: ${JSON.stringify(response)}`);
            logger.info(`Commit Repsonse: ${response.status} - ${JSON.stringify(response.data)}`);
        }, (error) => {
            logger.error(`An error occurred during or after committing Solr: ${JSON.stringify(error)}`);
        });
}
