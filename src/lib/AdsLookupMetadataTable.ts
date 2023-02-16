import {createReadStream, readFileSync} from "fs";
import {AdsCsvStreamWriter} from "./AdsLookupStreamWriter";
import parse = require("csv-parse");
import logger from "./Logger";
import {AdsMetadata} from "../service/brp/brp.types";

/**
 * The master index lookup for ADS entries.
 * Provides two major features:
 *
 *   1. Lookup to get the ADS ID for Signatures (CH-BAR*)
 *   2. Table to get metadata for ADS ID
 */
export class AdsLookupMetadataTable {

    /**
     * The (internal) path of the AdsIndex file to read from
     * @private
     */
    private readonly path: string;
    /**
     * (internal) flag whether the initialisation was performed
     * @private
     */
    private ready = false;
    /**
     * The actual raw data (could be omitted, as metadataMap also contains this data)
     * @private
     */
    private data: AdsMetadata[] = [];
    /**
     * A map of CH-BAR* ids to ADS (700*) ids.
     * @private
     */
    private signatureMap: Map<string, string> = new Map();
    /**
     * A map of ADS ids (700*) to their metadata entry
     * @private
     */
    private metadataMap: Map<string, AdsMetadata> = new Map();

    /**
     * The single instance
     * @private
     */
    private static instance: AdsLookupMetadataTable;

    public static getInstance(path: string) {
        if (this.instance && this.instance.ready) {
            return this.instance;
        } else if (this.instance && !this.instance.ready) {
            this.instance.initialise();
            return this.instance;
        } else {
            this.instance = new AdsLookupMetadataTable(path);
            this.instance.initialise();
            return this.instance;
        }
    }

    private constructor(path: string) {
        this.path = path;
    }

    /**
     * Reads the file, parses its contents and prepares the indexes
     * @private
     */
    private initialise() {
        logger.info('Starting init process from ' + this.path);
        const txt = readFileSync(this.path, "utf8");
        logger.debug('Read from file: ' + txt.length);
        parse(txt, {
            columns: header => header.map((col: string) => AdsCsvStreamWriter.mapHeadersToAdsMetdataKeys(col))
        }, ((err, records) => {
            if (err) {
                logger.warning(`An issue occurred, during reading of ADS Index: ${JSON.stringify(err)}`);
            } else {
                logger.debug('Reached before store');
                this.data = records as AdsMetadata[];
                logger.info(`Successfully read & parsed ${this.data.length} entries`);
                this.data.forEach(ads => {
                    if (ads.SID && ads.SID.length > 0) {
                        this.signatureMap.set(AdsLookupMetadataTable.normalise(ads.SID), ads.ADS);
                    }
                    this.metadataMap.set(ads.ADS, ads);
                });
                logger.info("Completed initialisation.")
                this.ready = true;
            }
        }));
    }

    /**
     * Lookup for metadata, given a 700* (ADS IDs) or CH-BAR* (Signatures) id.
     * If no fitting ID is given, an error is thrown.
     * @param id Either an ADS id (700*) or a Signature (CH-BAR*)
     * @throws Error In case the ID was not found in the index
     */
    public get(id: string): AdsMetadata {
        if (id.startsWith('700')) {
            if (this.metadataMap.has(id)) {
                return this.metadataMap.get(id)!;
            } else {
                throw new Error("Unrecognized ADS ID: " + id);
            }
        } else if (id.startsWith('CH-BAR')) {
            if (this.signatureMap.has(id)) {
                return this.metadataMap.get(this.signatureMap.get(id)!)!;
            } else {
                throw new Error("Unrecognised signature: " + id);
            }
        } else {
            throw new Error("Unrecognised id type: " + id);
        }
    }

    public contains(id: string): boolean {
        try{
            this.getAdsId(id);
            return true;
        }catch(e){
            return false;
        }
    }

    /**
     * Returns the proper ADS ID (700*) for an ID-like construct.
     * ID-like constructs are basically filenames with more than the ID
     * @param idLike Filename either Signature ID (CH-BAR*) or ADS ID (700*) and suffix(es) and other information, e.g. page number
     */
    public getAdsId(idLike: string): string {
        if (idLike.startsWith('CH-BAR')) {
            // This is a Signature, we can basically return everything from start to second last ('.') (or the ('.') after the last ('#').
            const sid = AdsLookupMetadataTable.extractSignature(idLike);
            return this.get(sid).ADS;
        } else if (idLike.startsWith('700')) {
            // This is an ADS ID, we can basically return everything in between ('_') and ('-'), if present
            return AdsLookupMetadataTable.extractAdsId(idLike);
        } else {
            throw new Error('Unrecognised id like: ' + idLike);
        }
    }

    public isReady(){
        return this.ready;
    }

    /**
     * Extracts the signature from a filename (could be absolute)
     * @param sid
     */
    public static extractSignature(sid: string) {
        const startIdx = sid.indexOf('/') > 0 ? sid.lastIndexOf('/') : 0;
        const endIdx = sid.indexOf('.', sid.lastIndexOf('#'));
        return sid.substring(startIdx, endIdx);
    }

    /**
     * Extracts the ads id from a filename (could be absolute)
     * @param idLike
     */
    public static extractAdsId(idLike: string) {
        let startIdx = (idLike.indexOf('_') > 0) ? idLike.indexOf('_') + 1 : ((idLike.indexOf('/') > 0) ? idLike.lastIndexOf('/') +1: 0);
        let endIdx = (idLike.indexOf('-') > 0) ? idLike.lastIndexOf('-') : (idLike.lastIndexOf('.') > 0 ? idLike.lastIndexOf('.') : idLike.length );
        return idLike.substring(startIdx, endIdx);
    }


    /**
     * Normalises a given ID.
     * Signature IDs (CH-BAR*) are normalised.
     * They contain a slash ('/'), which will be replaced with a dash ('-'), as
     * files contain the dash and not the slash (pun unintended)
     * @param id The ID (CH-BAR*) or (700*) to normalise.
     * @return string Normalised version or the input, if it's not an ID to normalise
     */
    public static normalise(id: string) {
        if (id.startsWith('CH-BAR')) {
            return id.replace('/', '-');
        } else {
            return id;
        }
    }

}
