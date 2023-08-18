import {TitleLookupRecord} from "../service/brp/brp.types";
import logger from "./Logger";
import {readFileSync} from "fs";
import parse from "csv-parse";
import {AdsLookupMetadataTable} from "./AdsLookupMetadataTable";

export class TitlePageLookup {

    private readonly PREFIX = "[TitlePageLookupp]";

    private readonly path: string;

    private readonly COLUMNS = [
        'file_t',
        'Match_t',
        'HEFT_SITZUNGS_NR_t',
        'JAHR_t',
        'PUBLIKATIONS_DATUM_t',
        'SEITE_ANZ_t',
        'BAND_NR_t',
        'JAHRGANG_t',
        'TITEL_ORIGINAL_DE_t',
        'TITEL_ORIGINAL_FR_t',
        'TITEL_ORIGINAL_IT_t',
        'Bemerkung_t',
        'file_p',
        'Match_',
        'HEFT_SITZUNGS_NR_p',
        'JAHR_p',
        'PUBLIKATIONS_DATUM_p',
        'SEITE_ANZ_p',
        'BAND_NR_p',
        'JAHRGANG_p',
        'TITEL_ORIGINAL_DE_p',
        'TITEL_ORIGINAL_FR_p',
        'TITEL_ORIGINAL_IT_p'
    ];

    private readonly ADS_KEY_TITLE = 'file_t'; // ads id like
    private readonly ADS_KEY_PAGES = 'file_p'; // ads id like
    private readonly TITLE_NO_PAGES = 'SEITE_ANZ_t'

    private ready = false;

    private lookup: Map<string, string> = new Map();
    private reverseLookup: Map<string, string> = new Map();

    private records: Map<string, TitleLookupRecord> = new Map();

    private static instance: TitlePageLookup;

    public static getInstance(path: string){
        // Purposely ignore potential path mismatch, as its a _singleton_
        if(TitlePageLookup.instance && TitlePageLookup.instance.ready){
            return TitlePageLookup.instance;
        }else if(TitlePageLookup.instance && !TitlePageLookup.instance.ready){
            TitlePageLookup.instance.initialise();
            return TitlePageLookup.instance;
        }else{
            TitlePageLookup.instance = new TitlePageLookup(path);
            TitlePageLookup.instance.initialise();
            return TitlePageLookup.instance;
        }
    }

    private constructor(path: string) {
        this.path = path;
    }

    private initialise(){
        this.info('Starting init process for title page lookup from file '+this.path);
        const txt = readFileSync(this.path, "utf8");
        this.info('Read from lookup file: '+txt.length);
        parse(txt, {
            columns: this.COLUMNS
        }, ((err, records) => {
            if(err){
                const _e = err as Error;
                logger.error(`[${this.PREFIX}] An issue occurred during the reading of AIS lookup: ${JSON.stringify(err)}`);
            }else {
                const items = records as TitleLookupRecord[];
                items.forEach(r => {
                   const tadslike = r[this.ADS_KEY_TITLE];
                   const padslike = r[this.ADS_KEY_PAGES];
                   this.lookup.set(AdsLookupMetadataTable.extractAdsId(tadslike), AdsLookupMetadataTable.extractAdsId(padslike));
                   this.reverseLookup.set(AdsLookupMetadataTable.extractAdsId(padslike), AdsLookupMetadataTable.extractAdsId(tadslike));
                   this.records.set(AdsLookupMetadataTable.extractAdsId(tadslike), r);
                });
            }
        }));
        this.info(`Successfully read&parsed Title Page Lookup (${this.lookup.size} / ${this.reverseLookup.size} / ${this.records.size}) entries`)
    }

    public isTitlePageAds(ads:string){
        return this.lookup.has(ads);
    }

    public getTarget(titleADS: string){
        if(this.isTitlePageAds(titleADS)){
            return this.lookup.get(titleADS)!;
        }else{
            throw new Error("Given ADS ID is not a title page "+titleADS);
        }
    }

    public record(titleAds: string){
        if(this.records.has(titleAds)){
            return this.records.get(titleAds);
        }else{
            throw new Error("Given ADS ID is not a title page "+titleAds);
        }
    }

    public getTitleAds(pageAds: string){
        if(this.reverseLookup.has(pageAds)){
            return this.reverseLookup.get(pageAds);
        }else{
            throw new Error("Given ADS does not have a title page associated with "+pageAds);
        }
    }

    private info(i: any){
        logger.info(`${this.PREFIX}: ${i}`);
    }
}
