/**
 * A collection of brp related types
 */

export namespace IIIFPresV3 {
    export const CONTEXT = "http://iiif.io/api/presentation/3/context.json";

    export interface Collection {
        '@context': string;
        type: string;
        label: Label4Lang | LabelNoLang;
        items: ManifestEntry[];
        id?:string;
    }

    export interface Label4Lang {
        de: string[];
        fr: string[];
        it: string[];
        en: string[];
    }

    export interface Thumbnail {
        id: string;
        format: string;
        type: string;
        service?: Service[]
    }

    export interface ManifestEntry {
        id: string;
        type: string;
        label: Label4Lang | LabelNoLang;
        thumbnail?: Thumbnail;
        rendering?: Rendering[];
        navDate?: string; // YYYY-MM-DDT00:00:00Z
    }

    export interface Rendering  {
        id: string;
        type: string; // 'Text'
        label: Label4Lang | LabelNoLang;
        format: string; // 'application/pdf'
        language?: string[]; // de, fr, it, en
    }

    export interface Manifest {
        '@context': string; // http://iiif.io/api/presentation/3/context.json
        id: string;
        type: string; // Manifest
        label: Label4Lang | LabelNoLang,
        metadata: Metadata[],
        service?: Service,
        summary: Label4Lang | LabelNoLang,
        thumbnail: Thumbnail[],
        rendering: Rendering[],
        partOf: PartOf[],
        items: Canvas[]
    }

    export interface Metadata {
        label: Label4Lang | LabelNoLang,
        value: Label4Lang | LabelNoLang
    }

    export interface PartOf {
        id: string;
        type: string // Collection
    }

    export interface Annotation {
        '@context': string;
        id: string;
        type: string; // Annotation
        motivation: string; // painting for canvas, supplementing for ocr
        target: string; // img uri
        body: AnnotationBody;

    }

    export interface AnnotationPage {
        '@context': string; // http://iiif.io/api/presentation/3/context.json
        id: string;
        type: string // AnnotationPage
        items: Annotation[];
    }

    export interface AnnotationBody {
        id: string; // img uri
        type: string; // Image
        format?: string;
        service?: Service[];
        width?: number;
        height?: number;
    }

    export interface Canvas  {
        id: string;
        type: string; // Canvas
        label: LabelNoLang | Label4Lang;
        height: number;
        width: number;
        items: AnnotationPage[];
        annotations: AnnotationPage[];
        seeAlso?: SeeAlso[];
        renderings?: Rendering[];
    }

    export interface LabelNoLang {
        none: string[]; // "none": [ "p. 1" ]
    }

    export interface SeeAlso {
        id: string; // URL
        type: string; // in [Dataset, Image, Model, Sound, Text, Video]
        label: Label4Lang | LabelNoLang;
        format: string; // mime type
        profile: string; // Schema for URL
    }

    export interface Service {
        id: string; // URL
        type: string // in [ImageService1, ImageService2, SearchService1, AutoCompleteService1, AuthCookieService1, AuthTokenService1, AuthLogoutService1]
        profile: string;
    }

    export interface Services {
        '@id': string; // Service URL
        '@type': string; // see Service.type
        label: Label4Lang | LabelNoLang;
        services: Service[];
    }
}

/**
 * The base collection builder parameters, this represents a single BRP.
 */
export interface BrpBaseCollectionIndexParam {
    /**
     * The ADS ID (700*) as name
     */
    name: string;
    /**
     * The absolute path of the collection's root.
     * The folder specified with this path contains all of the jpgs, page/ and alto/ OCR subfolders as well as mets.xml and metadata.xml
     */
    absoluteRoot: string;
    /**
     * Metadata from the AdsIndex csv dump
     */
    metadata: AdsMetadata;

    /**
     * The target id (this is only set for title pages that have to be migrated to other documents)
     */
    targetId?: string;
    /**
     * If this is a title page document (i.e. should not get a manifest on its own)
     */
    isTitlePageDocument?: boolean;
}

/**
 * Parameters of a BRP collection index job
 * Provides (semantic) metadata, relevant paths
 */
export interface BrpCollectionIndexParam extends BrpBaseCollectionIndexParam {
    /**
     * Transkribus ID for posterity
     */
    transkribusId: string;
    /**
     * A list of IMAGE files belonging to this collection
     */
    files: string[];

}

export interface BrpRootCollectionIndexParam {
    name: string;
    metadata: AdsMetadata;
    manifestUri: string;
    thumbnailUri: string;
    navDate: string;
}

/**
 * Expanded index parameters.
 * A data container for metadata, id, associated files
 */
export interface BrpExpandedCollectionIndexParam {
    /**
     * Name, i.e. (ADS) ID of the collection
     */
    name: string;
    /**
     * The basic parameters, such as name (again), the source, metadata and (source) image files list.
     */
    basicParams: BrpCollectionIndexParam;
    /**
     * A list of associated files (image, ocr) with this collection.
     * Filenames as after processing
     */
    collectionFiles: BrpCollectionPage[];
}

/**
 * A single page of a BRP.
 */
export interface BrpCollectionPage {
    /**
     * The ADS ID of the BRP this page belongs to
     */
    id: string;
    /**
     * The base name of this BRP page, inclusive its page no
     */
    base: string;
    /**
     * The name of this BRP's image file
     */
    imgFile: string;
    /**
     * The name of this BRP's alto ocr file
     */
    altoOcr?: string;
    /**
     * The name of this BRP's page ocr file
     */
    pageOcr?: string;
    /**
     * The name of this BRP's hocr ocr file
     */
    hocrOcr?: string;
}



/**
 * An ADS metadata XML representation
 */
export interface AdsMetadata {
    /**
     * The ADS number, not actually part of the content, but in the filename
     */
    ADS: string;
    /**
     * The Signature (Read from LIEFERANTEN_ID, if present. Otherwise empty (and thus not required)
     */
    SID: string;
    /**
     * Attribute HEFT_SITZUNGS_NR from tag ADS_AMTSDRUCKSCHRIFT
     */
    bookletMeetingNo: string;
    year:string;
    publicationDate: string;
    sourceType: string;
    adsPages: string;
    adsLanguage: string;
    letterTypeABK: string;
    volumeNo: string;
    volumeIssue: string;
    volumePages: string;
    language: string;
    supplier: string; // optional
    pagesNo: string;
    filePDF: string;
    titleDE: string;
    titleFR: string;
    titleIT: string;
}
/**
 * Original format
 * <?xml version="1.0" encoding="ISO-8859-1"?>
 <!DOCTYPE ads_ladedatenformat SYSTEM "ads_ladedatenformat_v1_3.dtd">
 <ads_ladedatenformat>
 <ADS_AMTSDRUCKSCHRIFT HEFT_SITZUNGS_NR="055" JAHR="1898"
 PUBLIKATIONS_DATUM="1898-07-01 00:00" QUELLEN_TYPE="OCR_BRP"
 SEITE_ANZ="44" SPRACHE="DFI">
 <ADS_DRUCKSCHRIFTTYP DRUCKSCHRIFTTYP_ABK="BRP"/>
 <ADS_BAND BAND_NR="194" JAHRGANG="1898" SEITE_ANZ="653"/>
 <ADS_TEXTEINHEIT FILE_PDF="70008600.pdf"
 LIEFERANTEN_ID="CH-BAR#E1004.1#1000/9#194#2" SEITE_ANZ="44"
 SPRACHE="DFI" TEXTKAT_LIEFERANTEN="BRP_PROT_BR"
 TITEL_ORIGINAL_DE="Beschlussprotokoll(-e) 01.07.-04.07.1898"
 TITEL_ORIGINAL_FR="Procès-verbal(-aux) des décisions 01.07.-04.07.1898" TITEL_ORIGINAL_IT="Verbale(-i) delle decisioni 01.07.-04.07.1898"/>
 </ADS_AMTSDRUCKSCHRIFT>
 </ads_ladedatenformat>

 */
export const ADS_ROOT_TAG = 'ads_ladedatenformat';
export const ADS_ADS_TAG = 'ADS_AMTSDRUCKSCHRIFT';
export const ADS_BOOKLET_ATTR = 'HEFT_SITZUNGS_NR';
export const ADS_YEAR_ATTR = 'JAHR';
export const ADS_PUB_DATE_ATTR = 'PUBLIKATIONS_DATUM';
export const ADS_SRC_TYPE_ATTR = 'QUELLEN_TYPE';
export const ADS_PAGES_ATTR = 'SEITE_ANZ';
export const ADS_LANG_ATTR = 'SPRACHE';
export const ADS_DS_TYPE_TAG = 'ADS_DRUCKSCHRIFTTYP';
export const ADS_DS_TYPE_ATTR = 'DRUCKSCHRIFTTYP_ABK';
export const ADS_VOL_TAG = 'ADS_BAND';
export const ADS_VOL_NO_ATTR = 'BAND_NR';
export const ADS_VOL_ISSUE_ATTR = 'JAHRGANG';
export const ADS_VOL_PAGES_ATTR = 'SEITE_ANZ';
export const ADS_TXT_TAG = 'ADS_TEXTEINHEIT';
export const ADS_TXT_PDF_ATTR = 'FILE_PDF';
export const ADS_TXT_SUP_ID_ATTR = 'LIEFERANTEN_ID';
export const ADS_TXT_PAGES_ATTR = 'SEITE_ANZ';
export const ADS_TXT_LANG_ATTR = 'SPRACHE';
export const ADS_TXT_SUP_ATTR = 'TEXTKAT_LIEFERANTEN';
export const ADS_TXT_TITLE_DE = 'TITEL_ORIGINAL_DE';
export const ADS_TXT_TITLE_FR = 'TITEL_ORIGINAL_FR';
export const ADS_TXT_TITLE_IT = 'TITEL_ORIGINAL_IT';

/**
 * A record row in the ais-ads-index.csv file
 */
export interface AisLookupRecord {
    'Signatur':string;
    'Aktenzeichen*':string;
    'Titel':string;
    'Entstehungszeitraum':string;
    'ID-Nr.':string;
    'Band*':string;
    'Zusätzliche Informationen*':string;
}

/**
 * A record row in the title-pages-mapping.csv file
 */
export interface TitleLookupRecord {
    'file_t': string;
    'Match_t': string;
    'HEFT_SITZUNGS_NR_t': string;
    'JAHR_t': string;
    'PUBLIKATIONS_DATUM_t': string;
    'SEITE_ANZ_t': string;
    'BAND_NR_t': string;
    'JAHRGANG_t': string;
    'TITEL_ORIGINAL_DE_t': string;
    'TITEL_ORIGINAL_FR_t': string;
    'TITEL_ORIGINAL_IT_t': string;
    'Bemerkung_t': string;
    'file_p': string;
    'Match_': string;
    'HEFT_SITZUNGS_NR_p': string;
    'JAHR_p': string;
    'PUBLIKATIONS_DATUM_p': string;
    'SEITE_ANZ_p': string;
    'BAND_NR_p': string;
    'JAHRGANG_p': string;
    'TITEL_ORIGINAL_DE_p': string;
    'TITEL_ORIGINAL_FR_p': string;
    'TITEL_ORIGINAL_IT_p': string;
}

