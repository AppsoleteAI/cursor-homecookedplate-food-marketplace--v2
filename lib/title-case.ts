const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'up',
  'via',
  'vs',
  'with',
]);

function wordKey(word: string): string {
  return word.replace(/[^A-Za-z]/g, '').toLowerCase();
}

/** First letter of each word in a screen name, leaving the rest of the spelling as typed. */
export function screenName(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return 'Guest';
  return raw.replace(/(^|[\s_])([a-z])/g, (_match, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

/** Title case for page headers. Small words stay lowercase unless they open or close the title. */
export function titleCase(value: string): string {
  const words = value.match(/\S+/g);
  if (!words) return value;
  const significant = words.filter((word) => /[A-Za-z]/.test(word));
  let index = 0;
  return value.replace(/\S+/g, (word) => {
    if (!/[A-Za-z]/.test(word)) return word;
    const isEdge = index === 0 || index === significant.length - 1;
    index += 1;
    const key = wordKey(word);
    if (!isEdge && SMALL_WORDS.has(key)) {
      return word.replace(/[A-Za-z]+/g, (letters) => letters.toLowerCase());
    }
    return word.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
  });
}
