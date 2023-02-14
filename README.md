# chgov-brprotokolle-server

- [chgov-brprotokolle](https://github.com/SwissFederalArchives/chgov-brprotokolle)
  - **[chgov-brprotokolle-server](https://github.com/SwissFederalArchives/chgov-brprotokolle-server)** :triangular_flag_on_post:
  - [chgov-brprotokolle-markdown](https://github.com/SwissFederalArchives/chgov-brprotokolle-markdown)
  - [chgov-brprotokolle-frontend](https://github.com/SwissFederalArchives/chgov-brprotokolle-frontend)
  - [chgov-brprotokolle-mirador-ocr-helper](https://github.com/SwissFederalArchives/chgov-brprotokolle-mirador-ocr-helper)

# Context

The [chgov-brprotokolle](https://github.com/SwissFederalArchives/chgov-brprotokolle) project is settled around managing, retrieving and displaying historic minutes of the Federal Council, based on the [IIIF](https://iiif.io/) standard and the live project set-up can be experienced over at [Federal Archives's site](https://www.chgov.bar.admin.ch/search). The project is separated into 4 dedicated repositories while this current repository `chgov-brprotokolle-server` is the backend for the ingestion of minutes and the interface for SOLR search requests. It was developed using TypeScript and is based on the [archival-iiif-server](https://github.com/archival-IIIF/server). The other projects include the _publicly accessible frontend_ ([chgov-brprotokolle-frontend](https://github.com/SwissFederalArchives/chgov-brprotokolle-frontend)), a _frontend utility_ to properly enable OCR display in Mirador ([chgov-brprotokolle-mirador-ocr-helper](https://github.com/SwissFederalArchives/chgov-brprotokolle-mirador-ocr-helper)) and _documentation_ [chgov-brprotokolle-markdown](https://github.com/SwissFederalArchives/chgov-brprotokolle-markdown). The _frontend_ is written in [React](https://reactjs.org/) and the _frontend utility_ in plain JavaScript.

# Architecture and components

The _backend server_ has two major tasks: _ingestion_ and _search routing_. The latter is more or less directly passed to the corresponding SOLR instance and it's objective is to provide an interface for queries.. The former is outlined below with its objective to store data in the SOLR instance and create IIIF representations of the minutes.

## Pipeline Ingestion

![Pipeline](docs/images/brprotokolle-server-pipeline.png)

The ingestion pipline handles either _handwritten minutes_ (e.g. with provided OCR from the Transkribus project) or _machine written minutes_ (e.g. as PDF files, no OCR provided), enhances the minutes with provided metadata and ultimately stores relevant information in a SOLR instance.
In order to start the ingestion, files in the appropriate format have to be added to the `HOTFOLDER`, which the `dirWatcher` catches. Then, depending on the type of minutes the `collectionBuilder` handles _handwritten minutes_ for further processing. _Machine written minutes_ are ingested as single PDFs, thus before further processing, the images have to be extracted (`imgExtractor`) and subsequently, OCR is extracted based on the images (`ocrExtractor`).
At this point, the _images_, _ocr data_ and _metadata_ are provided and there is no distinction between _machine written_ and _handwritten_ anymore.
The _ocr data_ is compiled into a single text file, the _ocr plaintext_ and together with the _images_, and, _ocr data_, it's stored under the `DATAFOLDER` directory.
The _metadata_ and known locations of the _images_, _ocr data_, and, _ocr plaintext_ are used to generate the _IIIF manifests_ (`manifestCreate`).
These _manifests_ are delivered by an external webserver and are not further part of the _backend_ project.
The pipeline is built in such a way that the `solrAdd` step finalises the ingestion and adds relevant information to the SOLR instance.

# First steps

## Preparations

To prepare the `backend server`'s setup, it is mandatory to have a running SOLR instance, prepared with the appropriate schema and plugin.

## Install

Installation of the development enviornment is done by calling ```npm install`, as this is a node project.

# Customization

## General

Custom elements for the pipeine can be added as described in the [archival-iiif-server](https://github.com/archival-IIIF/server) documentation.

## Run tests

There aren't any automated tests available. End to end runs have to be manually checked.

## Execute

# Authors

- [Schweizerisches Sozialarchiv](https://www.sozialarchiv.ch/)
- [4eyes GmbH](https://www.4eyes.ch/)

# License

The MIT License (MIT), see [LICENSE](LICENSE)

# Contribute

This repository is a copy which is updated regularly - therefore contributions via pull requests are not possible. However, independent copies (forks) are possible under consideration of the The MIT license.

# Contact

- For general questions (and technical support), please contact the Swiss Federal Archives by e-mail at bundesarchiv@bar.admin.ch.
- Technical questions or problems concerning the source code can be posted here on GitHub via the "Issues" interface.
