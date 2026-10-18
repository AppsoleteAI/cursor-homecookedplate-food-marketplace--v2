const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// One copy of these packages, so tab Screen and the navigator share one component.
// A second copy makes "Use the app" throw for the (home) screen.
const singletonPackages = new Set([
  "@react-navigation/native",
  "@react-navigation/core",
]);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = previousResolveRequest ?? context.resolveRequest;
  if (singletonPackages.has(moduleName)) {
    return resolve(
      { ...context, originModulePath: path.join(__dirname, "package.json") },
      moduleName,
      platform
    );
  }
  return resolve(context, moduleName, platform);
};

// Metro automatically resolves .web.ts files when platform is 'web'
// So lib/expo-video.web.ts will be used automatically on web

module.exports = config;
