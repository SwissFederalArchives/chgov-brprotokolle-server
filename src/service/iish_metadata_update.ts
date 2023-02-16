import * as got from 'got';
import * as moment from 'moment';
import * as libxmljs from 'libxmljs2';
import {Element} from 'libxmljs2';

import config from '../lib/Config';
import logger from '../lib/Logger';
import {runTask} from '../lib/Task';
import {MetadataParams} from '../lib/Service';

const ns = {
    'oai': 'http://www.openarchives.org/OAI/2.0/'
};

export default async function updateMetadata(): Promise<void> {
    if (!config.metadataOaiUrl)
        throw new Error('Failed to run the update metadata service: there is no OAI URL configured!');

    try {
        const fromDate = moment().subtract(5, 'days').format('YYYY-MM-DD');
        const oaiIdentifiers = await getOAIIdentifiersOfUpdated(fromDate, config.metadataOaiUrl);
        oaiIdentifiers.forEach(oaiIdentifier => {
            runTask<MetadataParams>('metadata', {oaiIdentifier});
        });
    }
    catch (err) {
        logger.error(`Failed to run the recurring update metadata procedure: ${(err as any).message}`, {err});
    }
}

export async function getOAIIdentifiersOfUpdated(fromDate: string, uri: string): Promise<string[]> {
    const oaiIdentifiers: string[] = [];

    let resumptionToken = null;
    while (resumptionToken !== false) {
        const response = await got.default(uri, {
            rejectUnauthorized: false, resolveBodyOnly: true, searchParams: {
                verb: 'ListIdentifiers',
                metadataPrefix: 'marcxml',
                from: fromDate,
                ...(resumptionToken ? {resumptionToken} : {})
            }
        });

        const oaiResults = libxmljs.parseXml(response);

        const resumptionTokenElem = oaiResults.get('//oai:resumptionToken', ns) as Element;
        resumptionToken = resumptionTokenElem ? resumptionTokenElem.text() : false;

        const foundIdentifiers = (oaiResults.root() as Element)
            .find('//oai:header', ns)
            .map(headerElem => (headerElem as Element).get('./oai:identifier', ns))
            .filter(identifierElem => identifierElem !== null)
            .map(identifierElem => (identifierElem as libxmljs.Element).text());

        oaiIdentifiers.push(...foundIdentifiers);
    }

    return oaiIdentifiers;
}
