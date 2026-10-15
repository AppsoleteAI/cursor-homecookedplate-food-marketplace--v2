import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { AuthColors, authGradientCss } from '@/constants/auth-palette';

/**
 * Web document shell. The honey wash is painted on the canvas itself so a
 * mobile browser that sizes the app shorter than the visible screen does not
 * show white underneath. Route changes retint this from lib/web-page-fill.web.ts.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: canvasFill }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const canvasFill = `
html, body, #root {
  min-height: 100%;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
}
html, body {
  background-color: ${AuthColors.gradientBottom};
  background-image: ${authGradientCss};
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-size: 100% 100%;
}
`;
