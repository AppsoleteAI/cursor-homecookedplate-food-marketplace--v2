const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Metro automatically resolves .web.ts files when platform is 'web'
// So lib/expo-video.web.ts will be used automatically on web

module.exports = config;
