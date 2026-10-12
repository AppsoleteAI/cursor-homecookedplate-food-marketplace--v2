# Fonts

SF Pro Text is the default for pre-app and in-app copy, including screens added later.

The default is installed once at startup in `lib/apply-default-font.ts`. `index.js` loads that file before Expo Router, and `app/_layout.tsx` imports it again as a backup. A new screen that uses `Text` or `TextInput` from `react-native` gets this face without setting `fontFamily`.

| Where | Face |
| --- | --- |
| UI copy (titles, body, buttons, inputs) | SF Pro Text |
| HomeCookedPlate wordmark | Georgia |
| Admin code field | monospace |

On iPhone, `preAppFont` uses the system font, which is San Francisco. On Android it uses the system sans (`sans-serif`, Roboto). On web it uses `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`. Do not add an SF Pro font file. Apple’s license does not allow bundling it.

Use `wordmarkFont` from `constants/auth-palette.ts` only for the HomeCookedPlate name: the auth wordmark, the splash name, and the brand line on Support, Terms, and Privacy. Those legal pages use the same web stack for headings and body.

An explicit `fontFamily` on a style overrides the default. Leave the admin dashboard code field as `monospace`.
