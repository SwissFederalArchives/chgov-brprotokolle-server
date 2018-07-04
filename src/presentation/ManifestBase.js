const config = require('../lib/Config');

/***
 * See http://iiif.io/api/presentation/2.1/
 */
class ManifestBase {
    constructor(id, label) {
        this.id = id;
        this.data = {
            "@id": this.getPresentationUrl(id),
            "@context": "http://iiif.io/api/presentation/2/context.json",
            "label": label
        };

        const logo = config.logo;
        if (logo) {
            this.data["logo"] = logo;
        }
    }

    get() {
        return this.data;
    }

    // Can be removed with IIIF Image Api 3.0
    getLabel(label) {
        const defaultLang = config.imageServerUrl;
        if (label.hasOwnProperty(defaultLang))
            return label[defaultLang];
        return Object.values(label)[0]
    }

    getPresentationUrl(id) {
        return `${config.baseUrl}/iiif/presentation/${id}/manifest`;
    }

    getImageUrl(accessFileName) {
        return `${config.baseUrl}/iiif/image/${this.id}`;
        // ToDo: The line above breaks loris
        // return config.getBaseUrl() + "/iiif/image/" + accessFileName;
    }

    setParent(id) {
        this.data.within = this.getPresentationUrl(id)
    }

    addMetadata(label, value) {
        if (this.data.metadata === undefined) {
            this.data.metadata = [];
        }

        if (Array.isArray(label)) {
            this.data.metadata = [...label]
        }
        else {
            this.data.metadata.push({
                "label": label,
                "value": value
            })
        }
    }

}

module.exports = ManifestBase;