const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro automatically resolves .web.ts files when platform is 'web'
// So lib/expo-video.web.ts will be used automatically on web

module.exports = config;
