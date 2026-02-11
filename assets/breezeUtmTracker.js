function extractQueryParamFromPageURL() {
    const params = {};
    try {
        const queryString = window.location.search.substring(1);
        if (queryString === '') {
            return params;
        }
        const pairs = queryString.split('&');
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (typeof key !== 'undefined' && typeof value !== 'undefined') {
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
        });
    } catch (e) {}
    return params;
}

function setUTMParameters() {
    try {
        const queryParams = extractQueryParamFromPageURL();
        const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "fbclid", "utm_content", "utm_term", "ref", "gclid", "shpxid"];

        // 👉 Check existing UTM in localStorage
        const existingUTM = localStorage.getItem("utmTracker");
        let storedData = existingUTM ? JSON.parse(existingUTM) : {};

        let newData = { ...storedData }; // start with existing data

        Object.keys(queryParams).forEach(key => {
            if (utmKeys.includes(key)) {
                newData[key] = queryParams[key]; // overwrite only if new UTM exists
            }
        });

        // 👉 Add default ONLY IF nothing exists at all
        if (!newData.utm_source) {
            newData.utm_source = "direct";
        }

        localStorage.setItem("utmTracker", JSON.stringify(newData));
    } catch (e) {}
}

setUTMParameters();
