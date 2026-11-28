/**
 * An icon font has no ordinary letters, so the web font check cannot see it
 * and throws after 6 seconds. The face is already on the page. Keep the icons
 * and let that check finish.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Font = require('expo-font') as { loadAsync: (...args: unknown[]) => Promise<unknown> };
const original = Font.loadAsync.bind(Font);

Font.loadAsync = (...args: unknown[]) => {
  const pending = original(...args);
  return Promise.resolve(pending).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('timeout exceeded')) return undefined;
    throw error;
  });
};
