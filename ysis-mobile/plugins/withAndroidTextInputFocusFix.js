/**
 * Fixes a React Native / Android bug (facebook/react-native#51072) where,
 * on a screen with two or more TextInputs, blurring one field causes focus
 * to snap back to another field — producing a rapid focus/blur bounce loop
 * that makes the keyboard close instantly and prevents typing.
 *
 * The upstream fix landed behind the `useEditTextStockAndroidFocusBehavior`
 * feature flag, which ships ON by default. On some Android versions the
 * default value still reproduces the bug; forcing it to `false` is the
 * confirmed workaround (see the same GitHub issue, comment from @goege64).
 *
 * Since Expo regenerates the native `android/` project on every
 * `expo prebuild` / `eas build`, this override has to be reapplied via a
 * config plugin rather than edited directly in MainApplication.kt.
 */
const { withMainApplication } = require('@expo/config-plugins');
// mergeContents isn't part of the top-level @expo/config-plugins export on
// SDK 57; it lives in this internal util module instead.
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const IMPORT_LINES = [
  'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
  'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
].join('\n');

const OVERRIDE_LINES = [
  '    ReactNativeFeatureFlags.dangerouslyForceOverride(object : ReactNativeNewArchitectureFeatureFlagsDefaults() {',
  '      override fun useEditTextStockAndroidFocusBehavior(): Boolean = false',
  '    })',
].join('\n');

function addImports(contents) {
  return mergeContents({
    tag: 'android-textinput-focus-fix-imports',
    src: contents,
    newSrc: IMPORT_LINES,
    anchor: /^package .*/,
    offset: 1,
    comment: '//',
  }).contents;
}

function addOverrideCall(contents) {
  return mergeContents({
    tag: 'android-textinput-focus-fix-override',
    src: contents,
    newSrc: OVERRIDE_LINES,
    anchor: /super\.onCreate\(\)/,
    offset: 1,
    comment: '    //',
  }).contents;
}

module.exports = function withAndroidTextInputFocusFix(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        `withAndroidTextInputFocusFix expects a Kotlin MainApplication.kt, got "${config.modResults.language}". ` +
          'Update the plugin if this project has switched to Java.'
      );
    }

    let contents = config.modResults.contents;
    contents = addImports(contents);
    contents = addOverrideCall(contents);
    config.modResults.contents = contents;

    return config;
  });
};
