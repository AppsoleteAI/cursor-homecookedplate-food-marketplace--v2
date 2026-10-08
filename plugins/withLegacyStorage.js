const { withAndroidManifest } = require('expo/config-plugins');

const STORAGE_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

/**
 * Gallery and camera saves on Android 12 and earlier still request storage.
 * Android 13+ uses the system photo picker and does not need these permissions.
 */
function withLegacyStorage(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const uses = manifest['uses-permission'] ?? [];

    for (const name of STORAGE_PERMISSIONS) {
      let node = uses.find((item) => item.$?.['android:name'] === name);
      if (!node) {
        node = { $: { 'android:name': name } };
        uses.push(node);
      }
      node.$['android:maxSdkVersion'] = '32';
    }

    manifest['uses-permission'] = uses;
    return config;
  });
}

module.exports = withLegacyStorage;
