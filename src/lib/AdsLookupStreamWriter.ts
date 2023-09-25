/**
 * A stream writer to write RFC4180 compliant CSV of ADS metadata
 * Roughly based on https://gist.github.com/statico/e2b0d2340be85c158aa079d09769c0ea
 */
import {Writable} from "stream";
import {createWriteStream} from "fs";
import {
    ADS_BOOKLET_ATTR,
    ADS_DS_TYPE_ATTR,
    ADS_LANG_ATTR,
    ADS_PAGES_ATTR,
    ADS_PUB_DATE_ATTR,
    ADS_SRC_TYPE_ATTR,
    ADS_TXT_LANG_ATTR, ADS_TXT_PAGES_ATTR,
    ADS_TXT_PDF_ATTR,
    ADS_TXT_SUP_ATTR, ADS_TXT_TITLE_DE, ADS_TXT_TITLE_FR, ADS_TXT_TITLE_IT,
    ADS_VOL_ISSUE_ATTR,
    ADS_VOL_NO_ATTR,
    ADS_VOL_PAGES_ATTR,
    ADS_YEAR_ATTR,
    AdsMetadata
} from "../service/brp/brp.types.js";

export class AdsCsvStreamWriter {

    /**
     * Current line number
     * @private
     */
    private count: number;
    /**
     * Path to the file
     * @private
     */
    private path: string;
    /**
     * The actual stream to write
     * @private
     */
    private stream: Writable;

    /**
     * Creates a new AdsCsvStreamWriter.
     * @param path The path to the file to write
     * @param truncate Optional flag to indicate if the file should be truncated
     */
    constructor(path: string, truncate?: boolean) {
        this.path = path;
        var options = {flags: 'a+'};
        if (truncate) {
            options = {flags: 'w+'};
        }
        this.stream = createWriteStream(this.path, options);
        this.count = 0;
    }

    /**
     * Writes a given metadata entry
     * @param row
     */
    public write(row: AdsMetadata, aisId?: string) {
        if (this.count < 1) {
            this.writeHeaders();
        }
        this._write(this.stringify(row, aisId));
    }

    /**
     * Writes the header line if there was nothing previously written with this writer
     */
    public writeHeaders() {
        if (this.count < 1) {
            const headerRow = [
                "ADS_ID",
                "SID",
                ADS_BOOKLET_ATTR,
                ADS_YEAR_ATTR,
                ADS_PUB_DATE_ATTR,
                ADS_SRC_TYPE_ATTR,
                ADS_PAGES_ATTR,
                ADS_LANG_ATTR,
                ADS_DS_TYPE_ATTR,
                ADS_VOL_NO_ATTR,
                ADS_VOL_ISSUE_ATTR,
                ADS_VOL_PAGES_ATTR,
                ADS_TXT_LANG_ATTR,
                ADS_TXT_SUP_ATTR,
                ADS_TXT_PAGES_ATTR,
                ADS_TXT_PDF_ATTR,
                ADS_TXT_TITLE_DE,
                ADS_TXT_TITLE_FR,
                ADS_TXT_TITLE_IT,
                "AIS_ID"
            ]
            this._write(headerRow.join(","));
        }
    }

    public static mapHeadersToAdsMetdataKeys(header: string, index?: number): string {
        switch (header) {
            case 'ADS_ID':
                return 'ADS';
            case 'SID':
                return 'SID';
            case ADS_BOOKLET_ATTR:
                return 'bookletMeetingNo';
            case ADS_YEAR_ATTR:
                return 'year';
            case ADS_PUB_DATE_ATTR:
                return 'publicationDate';
            case ADS_SRC_TYPE_ATTR:
                return 'sourceType';
            case ADS_PAGES_ATTR:
                return 'adsPages';
            case ADS_LANG_ATTR:
                return 'adsLanguage';
            case ADS_DS_TYPE_ATTR:
                return 'letterTypeABK';
            case      ADS_VOL_NO_ATTR:
                return 'volumeNo';
            case        ADS_VOL_ISSUE_ATTR:
                return 'volumeIssue';
            case       ADS_VOL_PAGES_ATTR:
                return 'volumePages';
            case      ADS_TXT_LANG_ATTR:
                return 'language';
            case      ADS_TXT_SUP_ATTR:
                return 'supplier';
            case     ADS_TXT_PAGES_ATTR:
                return 'pagesNo';
            case      ADS_TXT_PDF_ATTR:
                return 'filePDF';
            case      ADS_TXT_TITLE_DE:
                return 'titleDE';
            case      ADS_TXT_TITLE_FR:
                return 'titleFR';
            case      ADS_TXT_TITLE_IT:
                return 'titleIT';
            case "AIS_ID":
                return "AIS_ID";
            default:
                throw new Error('Unkown header '+header+' at column '+index)
        }
    }

    /**
     * Returns the number of rows written
     */
    public getCount(): number {
        return this.count;
    }

    /**
     * Closes and flushes the stream writer
     */
    public async close() {
        if (this.isOpen()) {
            this.stream.end();
        }
    }

    /**
     * Check to see whether this writer is still open
     */
    public isOpen(): boolean {
        return this.stream != null;
    }

    /**
     * Internal. Writes the given string, followed by <new line><carriage return> in utf8.
     * Basically expects the string already being properly formatted CSV line
     * @param str The string to write
     * @private
     */
    private _write(str: string) {
        this.stream.write(str + "\n", "utf8");
        this.count++;
    }

    private stringify(meta: AdsMetadata, aisId? : string) {
        const str = [
            meta.ADS,
            meta.SID,
            meta.bookletMeetingNo,
            meta.year,
            meta.publicationDate,
            meta.sourceType,
            meta.adsPages,
            meta.adsLanguage,
            meta.letterTypeABK,
            meta.volumeNo,
            meta.volumeIssue,
            meta.volumePages,
            meta.language,
            meta.supplier,
            meta.pagesNo,
            meta.filePDF,
            meta.titleDE,
            meta.titleFR,
            meta.titleIT
        ]
        if(aisId){
            str.push(aisId);
        }
        return str.map((s) => `"${s}"`).join(",");
    }

}
