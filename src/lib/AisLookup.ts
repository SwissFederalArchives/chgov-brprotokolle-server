import logger from "./Logger";
import {readFileSync} from "fs";
import parse from "csv-parse";
import {AisLookupRecord} from "../service/brp/brp.types";
import {AdsLookupMetadataTable} from "./AdsLookupMetadataTable";

export class AisLookup {

    private readonly PREFIX = "[AisLookup]";

    private readonly path: string;

    private readonly COLUMNS = [
        'Signatur',
        'Aktenzeichen*',
        'Titel',
        'Entstehungszeitraum',
        'ID-Nr.',
        'Band*',
        'Zusätzliche Informationen*'
    ]

    public readonly ADS_KEY = 'Zusätzliche Informationen*';
    public readonly AIS_ID_KEY = 'ID-Nr.';

    private ready = false;

    private lookup: Map<string, string> = new Map();
    private reverseLookup: Map<string, string> = new Map();

    private records: Map<string, AisLookupRecord> = new Map();

    private static instance: AisLookup;

    public static getInstance(path: string){
        if( this.instance && this.instance.ready){
            return this.instance; // Potentially different path is ignored
        } else if (this.instance && !this.instance.ready) {
            this.instance.initialise();
            return this.instance;
        }else {
            this.instance = new AisLookup(path);
            this.instance.initialise();
            return this.instance;
        }
    }

    private constructor(path: string) {
        this.path = path;
    }

    private initialise(){
        logger.info(`${this.PREFIX} Starting init process for lookup from index ${this.path}`);
        const txt = readFileSync(this.path, "utf8");
        logger.debug(`${this.PREFIX} Read from index file: ${txt.length}`);
        parse(txt, {
            columns: this.COLUMNS
        }, ((err, records) => {
            if (err) {
                logger.warning(`${this.PREFIX} An issue occurred during the reading of AIS lookup: ${JSON.stringify(err)}`);
            } else {
                const items = records as AisLookupRecord[];
                logger.info(`${this.PREFIX} Successfully read & parsed ${items.length} AIS LOOKUP records`);
                items.forEach(r => {
                   const ads = r[this.ADS_KEY];
                   const ais = r[this.AIS_ID_KEY];
                   this.lookup.set(AdsLookupMetadataTable.extractAdsId(ads), ais);
                   this.reverseLookup.set(ais, AdsLookupMetadataTable.extractAdsId(ads));
                   this.records.set(ais, r);
                });
                logger.debug(`${this.PREFIX} Finished lookup setup`)
            }
        }));
    }

    /**
     * Maps a given ADS id to a AIS id.
     * @param ads
     */
    public get(ads: string): string {
        if(this.lookup.has(ads)){
            return this.lookup.get(ads)!;
        }else {
            throw new Error(`Could not lookup ads id ${ads}`);
        }
    }

    public contains(ads: string): boolean {
        return this.lookup.has(ads);
    }

    /**
     * Maps a given AIS id to a ADS id.
     * @param ais
     */
    public ads(ais: string): string{
        if(this.reverseLookup.has(ais)){
            return this.reverseLookup.get(ais)!;
        }else{
            throw new Error(`Could not get ADS id for AIS id ${ais}`);
        }
    }

    public record(ais: string){
        if(this.records.has(ais)){
            return this.records.get(ais);
        }else{
            throw new Error(`No records available for ${ais}`);
        }
    }

    /**
     * An iterator for all the AIS IDs.
     */
    public listAisIds(){
        return this.reverseLookup.keys();
    }
}
