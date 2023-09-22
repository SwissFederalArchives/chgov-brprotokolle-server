/**
 * Task to extract hOCR courtesy of tesseract (requires tesseract to be installed).
 */
import {
  BrpCollectionIndexParam,
  BrpCollectionPage,
  BrpExpandedCollectionIndexParam,
} from "./brp/brp.types.js";
import logger from "../lib/Logger.js";
import path from "path";
import config from "../lib/Config.js";
import fsExtra from "fs-extra";
import { spawn } from "child_process";
import { runTask } from "../lib/Task.js";
import { AIS_LOOKUP } from "./brp/brp.utils.js";

const pageNoSorter = (a: string, b: string): number => {
  return Number(extractPageNumber(a)) - Number(extractPageNumber(b));
};

export default async function extractOcr(params: BrpCollectionIndexParam) {
  logger.info(`Running service OCR Extraction for collection ${params.name}`);

  if (params.isTitlePageDocument || params.name.startsWith("70")) {
    return; // no ocr for title page
  }

  const ocrContainerPath = path.resolve(
    config.dataRootPath,
    config.collectionsRelativePath,
    "ocr",
    params.name,
    "hocr"
  );

  const collectionName = params.isTitlePageDocument
    ? params.targetId!
    : params.name;
  const ads = params.isTitlePageDocument
    ? params.name
    : AIS_LOOKUP.ads(collectionName);

  const pdfPath = path.resolve(params.absoluteRoot, ads + ".pdf");

  await fsExtra.ensureDir(ocrContainerPath);

  /* Based on comments in neat_ocr_index.ts,
    a textfile with the images (line separated) is required by tesseract
     */
  const imageFiles = params.files.sort(pageNoSorter); // ensure correct ordering
  let outputDirContents = await fsExtra.readdir(ocrContainerPath); // check for already generated hocr files

  if (config.filesAlreadyExtracted) {
    logger.debug(`Skip extracting as it already exists according to config`);
  } else {
    switch (config.brpOcrExtractionMode) {
      case "tesseract":
        outputDirContents = await extractWithTesseract({
          name: params.name,
          ocrContainerPath,
          imageFiles,
          outputDirContents,
        });
        break;
      case "pdfalto":
        outputDirContents = await extractWithPdfalto({
          pdfPath,
          name: params.name,
          ocrContainerPath,
          outputDirContents,
        });
        break;
      default:
        logger.error(
          `Unknown ocr extraction mode ${config.brpOcrExtractionMode}`
        );
        break;
    }
  }

  /* Collect necessary information of files created */
  const ocrFiles = [];
  for (const element of outputDirContents) {
    const file = element;
    if (file.startsWith(params.name) && file.endsWith(".hocr")) {
      ocrFiles.push(path.resolve(ocrContainerPath, file));
    }
  }
  logger.info(
    `Successfully created hocr files due to tesseract ${JSON.stringify(
      ocrFiles,
      null,
      " "
    )}`
  );
  const nextParams = createExpandedIndexParams(params, ocrFiles);

  if (!config.extractOnly) {
    await runTask<BrpExpandedCollectionIndexParam>("brp-manifest", nextParams);
    await runTask<BrpExpandedCollectionIndexParam>(
      "brp-ocr-indexer",
      nextParams
    );
  }
  if (!config.filesAlreadyExtracted) {
    await runTask<BrpExpandedCollectionIndexParam>(
      "brp-hocr-plaintext-extract",
      nextParams
    );
  }

  if (config.forceHocrToPlaintext) {
    await runTask<BrpExpandedCollectionIndexParam>(
      "brp-hocr-plaintext-extract",
      nextParams
    );
  }
}

async function createIndexFile(params: BrpCollectionIndexParam) {
  const filename = indexFileFor(params);
  logger.info(`Writing image files to tesseract index file ${filename}`);
  await fsExtra.writeFile(filename, params.files.sort(pageNoSorter).join("\n"));
  return filename;
}

function extractWithPdfalto(params: {
  name: string;
  pdfPath: string;
  ocrContainerPath: string;
  outputDirContents: string[];
}): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const { name, pdfPath, ocrContainerPath, outputDirContents } = params;

    try {
      // Get number of pages in the PDF
      const identify = spawn("identify", [pdfPath]);

      let output = "";
      identify.stdout.on("data", (data) => {
        output += data.toString();
      });

      identify.stdout.on("data", (data) => {
        logger.debug(`[pdfalto - identify]: ${data}`);
      });

      identify.stderr.on("data", (data) => {
        logger.error(`[pdfalto - identify]: ${data}`);
      });

      identify.on("close", (code) => {
        const noPgs = output.trim().split("\n").length;
        const pdfAltoQueue: Array<() => Promise<any>> = [];
        // Extract OCR for each page
        for (let i = 0; i <= noPgs; i++) {
          const altoFileName = `${name}-${i}.xml`;
          const altoFilePath = path.join(ocrContainerPath, altoFileName);
          const hOcrFileName = `${name}-${i}.hocr`;

          if (
            !config.skipExistingFileCheck &&
            outputDirContents.includes(hOcrFileName)
          ) {
            logger.debug(`Skipping ${hOcrFileName} as it already exists`);
          } else {
            pdfAltoQueue.push(() =>
              extractPageWithPdfalto({
                sourcePath: pdfPath,
                targetPath: altoFilePath,
                pageNr: i,
              })
            );
          }
        }

        processQueue(pdfAltoQueue, {
          maximalParallelism: config.brpOcrAltoExtractionMaxParallelProcesses,
        })
          .then(() => {
            // Cleanup ALTO metadata xml files as they are not needed
            const altoMetadataFiles = fsExtra
              .readdirSync(ocrContainerPath)
              .filter((file) => file.endsWith("_metadata.xml"));
            return cleanupFiles(altoMetadataFiles, ocrContainerPath);
          })
          .then(() => {
            const altoFiles = fsExtra
              .readdirSync(ocrContainerPath)
              .filter((file) => file.endsWith(".xml"));
            // Convert ALTO xml files to hOcr
            const convertQueue = [];
            for (const element of altoFiles) {
              convertQueue.push(() =>
                convertPageAltoToHocr({
                  altoFilePath: path.join(ocrContainerPath, element),
                  hocrFilePath: path.join(
                    ocrContainerPath,
                    path.parse(element).name + ".hocr"
                  ),
                })
              );
            }

            return processQueue(convertQueue, {
              maximalParallelism:
                config.brpOcrAltoExtractionMaxParallelProcesses,
            });
          })
          .then(() => {
            // Cleanup ALTO xml files
            const altoFiles = fsExtra
              .readdirSync(ocrContainerPath)
              .filter((file) => file.endsWith(".xml"));
            return cleanupFiles(altoFiles, ocrContainerPath);
          })
          .then(() => {
            const result = fsExtra.readdir(ocrContainerPath);
            resolve(result);
          })
          .catch((innerError) => {
            reject(innerError);
          });
      });
    } catch (e) {
      const _e = e as any;
      const err = new Error(
        `Failed to extract ocr for ${pdfPath}: ${_e.message}`
      );
      err.stack = _e.stack;
      logger.error(`Error during pdfalto OCR Extraction: ${err}`);
      reject(err);
    }
  });
}

async function extractPageWithPdfalto(params: {
  sourcePath: string;
  targetPath: string;
  pageNr: number;
}) {
  return new Promise<number | null>((resolve, reject) => {
    const { sourcePath, targetPath, pageNr } = params;

    logger.debug(
      `Starting OCR extraction for ${sourcePath} page ${pageNr} to ${targetPath}`
    );

    const pdfAlto = spawn("pdfalto", [
      "-f",
      `${pageNr + 1}`,
      "-l",
      `${pageNr + 1}`,
      "-noImage",
      sourcePath,
      targetPath,
    ]);

    pdfAlto.stdout.on("data", (data) => {
      logger.debug(`[pdfalto]: ${data}`);
    });

    pdfAlto.stderr.on("data", (data) => {
      logger.error(`[pdfalto]: ${data}`);
      reject(data);
    });

    pdfAlto.on("close", (code) => {
      logger.debug(
        `Finished OCR extraction for ${sourcePath} page ${pageNr} to ${targetPath}`
      );
      resolve(code);
    });
  });
}

async function convertPageAltoToHocr(params: {
  altoFilePath: string;
  hocrFilePath: string;
}) {
  return new Promise<number | null>((resolve, reject) => {
    const { altoFilePath, hocrFilePath } = params;

    logger.debug(`Converting ${altoFilePath} to hOCR`);

    const ocrTransform = spawn("ocr-transform", [
      "alto",
      "hocr",
      altoFilePath,
      hocrFilePath,
    ]);

    ocrTransform.stdout.on("data", (data) => {
      logger.debug(`[ocr-transform]: ${data}`);
    });

    ocrTransform.stderr.on("data", (data) => {
      logger.error(`[ocr-transform]: ${data}`);
      reject(data);
    });

    ocrTransform.on("close", (code) => {
      resolve(code);
    });
  });
}

async function cleanupFiles(
  files: string[],
  ocrContainerPath: string
): Promise<void> {
  if (files.length === 0) {
    return Promise.resolve();
  }

  const deletePromises = files.map((file) => {
    const filePath = path.join(ocrContainerPath, file);
    return new Promise<void>((resolve, reject) => {
      fsExtra.unlink(filePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  return Promise.all(deletePromises).then(() => {});
}

async function extractWithTesseract(params: {
  name: string;
  ocrContainerPath: string;
  imageFiles: string[];
  outputDirContents: string[];
}) {
  const { imageFiles, ocrContainerPath, outputDirContents } = params;
  for (const element of imageFiles) {
    try {
      const hOcrFileName = `${params.name}-${extractPageNumber(element)}`;
      const hOcrFilePath = path.resolve(ocrContainerPath, hOcrFileName);

      if (
        !config.skipExistingFileCheck &&
        outputDirContents.includes(`${hOcrFileName}.hocr`)
      ) {
        logger.debug(`Skipping ${hOcrFileName} as it already exists`);
      } else {
        logger.debug(`Extracting OCR for ${element} to ${hOcrFileName}`);

        const cmd = spawn("tesseract", [
          "--dpi",
          "150",
          "-l",
          "deu",
          element,
          hOcrFilePath,
          "hocr",
        ]);
        let data = "";
        let error = "";
        for await (const d of cmd.stdout) {
          logger.debug(`[Tesseract]: ${d}`);
          data += d;
        }
        for await (const d of cmd.stderr) {
          if (
            d &&
            typeof d === "object" &&
            typeof d.startsWith === "function"
          ) {
            if (!d.startsWith("Tesseract Open Source OCR")) {
              // apparently sometimes we get here wihtout d being an instance of string
              /* for some unkown reason, tesseract prints the following on stderr: 'Tesseract Open Source OCR Engine v4.1.1 with Leptonica\n' */
              logger.error(`[Tesseract]: ${d}`);
              error += d;
            }
          } else {
            /* For backup purposes, just print the error*/
            logger.error(`[Tesseract]: ${d}`);
            error += d;
          }
        }
        const exitCode = await new Promise((r, _) => {
          cmd.on("close", r);
        });
        if (exitCode) {
          throw new Error(
            `Tesseract subprocess exited with error code ${exitCode}: ${error}`
          );
        }
      }
    } catch (e) {
      const _e = e as any;
      const err = new Error(
        `Failed to extract ocr for ${params.name} from ${element}: ${_e.message}`
      );
      err.stack = _e.stack;
      logger.error(`Error during Tesseract OCR Extraction: ${err}`);
    }
  }

  return fsExtra.readdir(ocrContainerPath);
}

function indexFileFor(params: BrpCollectionIndexParam) {
  return path.resolve(
    config.dataRootPath,
    config.collectionsRelativePath,
    "ocr",
    params.name,
    `${params.name}-ocr-index.txt`
  );
}

function createExpandedIndexParams(
  params: BrpCollectionIndexParam,
  hocrFiles: string[]
): BrpExpandedCollectionIndexParam {
  /* Ensure that image files and hocr files are both sorted by the page number */
  const imgFiles = params.files.sort(pageNoSorter);
  const ocrFiles = hocrFiles.sort(pageNoSorter);

  const p = {
    name: params.name,
    basicParams: params,
    collectionFiles: [],
  } as BrpExpandedCollectionIndexParam;

  for (let i = 0; i < imgFiles.length; i++) {
    const file = imgFiles[i];
    const imgName = file.substring(
      file.lastIndexOf("/") + 1,
      file.lastIndexOf(".")
    );
    const pageNo = imgName.substring(imgName.lastIndexOf("-") + 1);
    const targetName = `${params.name}-${pageNo}`;
    const collectionPage = {
      id: params.name,
      base: targetName,
      imgFile: file,
    } as BrpCollectionPage;
    collectionPage.hocrOcr = ocrFiles[i];
    p.collectionFiles.push(collectionPage);
  }

  return p;
}

function extractPageNumber(file: string) {
  return file.substring(file.lastIndexOf("-") + 1, file.lastIndexOf("."));
}

/**
 * Processes a queue of promises with a limit on the number of promises that can be processed at once.
 * @param {Array<Promise<any>>} queue - The queue of promises to process.
 * @param {Object} options - The options for processing.
 * @param {number} options.maximalParallelism - The maximum number of promises that can be processed at once.
 * @returns {Promise<void>}
 */
async function processQueue(
  queue: Array<() => Promise<any>>,
  options: { maximalParallelism: number }
): Promise<void> {
  let activePromises = 0;
  const { maximalParallelism } = options;

  return new Promise((resolve, reject) => {
    const processNext = async () => {
      if (queue.length === 0) {
        if (activePromises === 0) {
          logger.debug("All processes in the queue have completed.");
          resolve();
        }
        return;
      }

      if (activePromises < maximalParallelism) {
        activePromises++;
        const promiseFunction = queue.shift();
        logger.debug(
          `Dequeuing a new process. Active processes: ${activePromises}`
        );
        const promise = promiseFunction!();

        try {
          await promise;
        } catch (error) {
          reject(error);
          return;
        }

        activePromises--;
        processNext();
      }
    };

    for (let i = 0; i < maximalParallelism; i++) {
      processNext();
    }
  });
}
