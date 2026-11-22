const appJson = require("./app.json");

module.exports = () => {
    const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

    return {
        ...appJson.expo,
        android: {
            ...appJson.expo.android,
            ...(googleServicesFile ? { googleServicesFile } : {}),
        },
    };
};