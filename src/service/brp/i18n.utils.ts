/**
 * English version of a title, given the german format.
 * Basically extracts the relevant date information and uses these.
 * @param titleDe
 */
export function englishifyTitle(titleDe: string) {
    return 'Minutes of decision(s) ' + titleDe.substring(titleDe.indexOf(' '))
}

/**
 * The base URL for 'original documents' (ie. permalinks)
 */
export const EXT_BASE_URL = 'https://www.recherche.bar.admin.ch/recherche/#/';
/**
 * The URL route for permalinks in GERMAN
 */
export const EXT_ROUTE_DE = 'de/archiv/einheit/';
/**
 * The URL route for permalinks in FRENCH
 */
export const EXT_ROUTE_FR = 'fr/archive/unite/';
/**
 * The URL route for permalinks in ITALIAN
 */
export const EXT_ROUTE_IT = 'it/archivio/unita/';
/**
 * The URL route for permalinks in ENGLISH
 */
export const EXT_ROUTE_EN = 'en/archive/unit/';
/**
 * All available routes as an array (i.e. GER; FRA; ITA; ENG)
 */
export const EXT_LANG_ARR = [EXT_ROUTE_DE, EXT_ROUTE_FR, EXT_ROUTE_IT, EXT_ROUTE_EN];

export const TITLE_LABEL_DE = "Titel";
export const TITLE_LABEL_FR = "Titre";
export const TITLE_LABEL_IT = "Titolo";
export const TITLE_LABEL_EN = "Title";

export const PUBLISHED_LABEL_DE = "Publiziert";
export const PUBLISHED_LABEL_FR = "Publié";
export const PUBLISHED_LABEL_IT = "Edito";
export const PUBLISHED_LABEL_EN = "Published";

export const DATE_LABEL_DE = "Datum";
export const DATE_LABEL_FR = "Date";
export const DATE_LABEL_IT = "Data";
export const DATE_LABEL_EN = "Date";

export const VOLUME_LABEL_DE = "Band";
export const VOLUME_LABEL_FR = "Volume";
export const VOLUME_LABEL_IT = "Volume";
export const VOLUME_LABEL_EN = "Volume";

/**
 * A map for the language routes / language description.
 * This 2d array is used as follows: first is the index of the EXT_LANG_ARR, then [0,3] for the corresponding language
 */
export const EXT_LANG_MAP = [
    ['deutsch', 'allemand', 'tedesco', 'German'], //
    ['französisch', 'français', 'francese', 'French'],
    ['italienisch', 'italien', 'italiano', 'Italian'],
    ['Englisch', 'anglais', 'inglese', 'English']
]
export const EXT_LANG_DESCRIPTION = [
    'Original Dokument im Archiv',
    'Document original en archive',
    'Documento originale in archivio',
    'Original document in archive'
]
export const LANGUAGE_IDENTIFIERS = ['de', 'fr', 'it', 'en'];

export const OCR_LABELS = [
    'Transkription',
    'Transcription',
    'Transcrizione',
    'Transcription'
]

