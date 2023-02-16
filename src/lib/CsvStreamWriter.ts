/**
 * A stream writer to write RFC4180 compliant CSV of ADS metadata
 * Roughly based on https://gist.github.com/statico/e2b0d2340be85c158aa079d09769c0ea
 */
import {Writable} from "stream";
import {createWriteStream} from "fs";

export class CsvStreamWriter {

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

    private headers: string[];

    private sanitiseWhitespace = (str:string) => /\s/.test(str) ? `"${str}"` : str;

    /**
     * Creates a new AdsCsvStreamWriter.
     * @param path The path to the file to write
     * @param truncate Optional flag to indicate if the file should be truncated
     */
    constructor(path: string, headers: string[], truncate?: boolean) {
        this.path = path;
        var options = {flags: 'a+'};
        if (truncate) {
            options = {flags: 'w+'};
        }
        this.stream = createWriteStream(this.path, options);
        this.count = 0;
        this.headers = headers;
    }

    /**
     */
    public write(row: string[]) {
        if (this.count < 1) {
            this.writeHeaders();
        }
        this._write(row.map(this.sanitiseWhitespace ).join(','));
    }

    /**
     * Writes the header line if there was nothing previously written with this writer
     */
    public writeHeaders() {
        if (this.count < 1) {
            this._write(this.headers.map(this.sanitiseWhitespace).join(","));
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

}
