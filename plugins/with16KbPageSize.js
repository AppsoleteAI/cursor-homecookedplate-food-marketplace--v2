const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const PAGE_SIZE_FLAG = '-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON';

const PACKAGING_BLOCK = `packaging {
        jniLibs {
            useLegacyPackaging = false
        }
    }`;

const SUBPROJECTS = `
// 16 KB memory pages. Native libraries stay uncompressed and page-aligned.
subprojects { subproject ->
    def configurePageSize = {
        try {
            def androidExtension = subproject.extensions.findByName("android")
            if (androidExtension == null) {
                return
            }
            def cmake = androidExtension.defaultConfig.externalNativeBuild.cmake
            if (cmake == null) {
                return
            }
            def arguments = cmake.arguments
            if (arguments == null) {
                return
            }
            def alreadySet = false
            arguments.each { value ->
                if (value.toString().startsWith("-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES")) {
                    alreadySet = true
                }
            }
            if (!alreadySet) {
                arguments.add("${PAGE_SIZE_FLAG}")
            }
        } catch (Exception ignored) {
        }
    }
    if (subproject.state.executed) {
        configurePageSize()
    } else {
        subproject.afterEvaluate { configurePageSize() }
    }
}
`;

function withUncompressedNativeLibs(gradle) {
  if (gradle.includes('useLegacyPackaging')) return gradle;
  const match = gradle.match(/android\s*\{/);
  if (!match) return gradle;
  const index = match.index + match[0].length;
  return `${gradle.slice(0, index)}\n    ${PACKAGING_BLOCK}${gradle.slice(index)}`;
}

function with16KbSubprojects(gradle) {
  if (gradle.includes('ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES')) return gradle;
  return `${gradle.trimEnd()}\n${SUBPROJECTS}`;
}

function with16KbPageSize(config) {
  config = withAppBuildGradle(config, (next) => {
    next.modResults.contents = withUncompressedNativeLibs(next.modResults.contents);
    return next;
  });
  config = withProjectBuildGradle(config, (next) => {
    next.modResults.contents = with16KbSubprojects(next.modResults.contents);
    return next;
  });
  return config;
}

module.exports = with16KbPageSize;
module.exports.withUncompressedNativeLibs = withUncompressedNativeLibs;
module.exports.with16KbSubprojects = with16KbSubprojects;
