import {promisify} from 'util';
import {parse} from 'path';

import config from '../lib/Config';
import logger from '../lib/Logger';
import {runTask} from '../lib/Task';

import {ImageExtractParams, CollectionPathParams} from "../lib/ServiceTypes";
import * as mysql from "mysql";

export type CollectionMetadata = {
    id: string,
    referenceCode: string,
    title: string,
    dateFrom: string,
    dateTo: string,
    period: string,
    documentNumber: string
}

export default async function retrieveMetadata({collectionPath}: CollectionPathParams) : Promise<void>{
    logger.info(`Get metadata for collection ${collectionPath}`);

    const db = makeDb();
    const identifier = getIdentifier(collectionPath);
    const sql = 'SELECT e.VRZNG_ENHT_ID AS id, e.SGNTR_CD AS referenceCode, e.VRZNG_ENHT_TITEL AS title, e.BGN_DT AS dateFrom, e.END_DT AS dateTo, e.ZT_RAUM_TXT AS period, d.MEMO_TXT AS documentNumber ' +
        ' FROM tbs_vrzng_enht e' +
        ' LEFT JOIN tbs_gsft_obj_dtl d' +
        ' ON e.VRZNG_ENHT_ID = d.GSFT_OBJ_ID AND d.DATEN_ELMNT_ID = 10239' +
        ' WHERE SGNTR_CD LIKE "' + identifier + '"' +
        ' LIMIT 1';

    logger.info(identifier + ': Fetching Metadata');
    const metadata = await db.query(sql) as CollectionMetadata[];
    logger.info(identifier + ': Collection Metadata: ' + JSON.stringify(metadata, null, 2));

    await db.close();

    if (metadata[0] && metadata[0].title) {
        runTask<ImageExtractParams>('file-extract', {collectionPath: collectionPath, metadata: metadata[0]});
    } else {
        logger.warn('No metadata found for identifier ' + identifier);
    }
}

function makeDb() {
    const connection = mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.pass,
        database: config.mysql.db
    });

    return {
        query( sql: string) {
            return promisify( connection.query )
                .call( connection, sql);
        },
        close() {
            return promisify( connection.end ).call( connection );
        }
    };
}

function getIdentifier(path: string) {
    let identifier = parse(path).name;
    identifier = identifier.replace(/(CH\-BAR.?)/g, '');
    identifier = identifier.replace(/[#|\-]/g, '_');

    // the identifier has always a * at the end.
    identifier += '*';

    return identifier
}
