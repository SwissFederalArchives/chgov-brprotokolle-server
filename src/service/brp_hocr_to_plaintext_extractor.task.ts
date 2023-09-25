import {BrpExpandedCollectionIndexParam} from "./brp/brp.types";
import logger from "../lib/Logger.js";
import {readFile, writeFile} from "fs-extra";
import {parse} from "node-html-parser"; // Apparently the fastest html parsers
import {PathUtils} from "./brp/brp.utils.js";


/**
 * A worker based service that, given a bunch of hOcr files merges the textual content line by line and stores
 * the results as a plain text file (txt).
 * @param param
 */
export default async function extractPlainTextFromHOCR(param: BrpExpandedCollectionIndexParam) {
    logger.info(`Running service HOCR to Plaintext for collection ${param.name}`);
    /*
    For each hocr file, loop over its .ocr_line and extract the text of .ocrx_word
     */
    const lines: string[] = [];

    for (let i = 0; i < param.collectionFiles.length; i++) {
        const contents = await readFile(param.collectionFiles[i].hocrOcr!, 'utf-8');
        const root = parse(contents);
        const ocrLines = root.querySelectorAll('.ocr_line');
        let _line: string[] = [];
        for (const line of ocrLines) {
            const words = line.querySelectorAll('.ocrx_word');
            for (const word of words) {
                _line.push(word.innerText.trim());
            }
            lines.push(_line.join(' '));
            _line = [];
        }
    }

    await writeFile(await PathUtils.plainOcrTextFile(param.name), lines.join('\n'));

    logger.info(`Finished Plaintext Extraction from OCR`);

}
