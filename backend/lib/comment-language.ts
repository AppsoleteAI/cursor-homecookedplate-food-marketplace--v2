import { sanitizeTextField } from './text-security';

export const REVIEW_COMMENT_LIMIT = 200;

const BLOCKED_TERMS = [
  'nigger', 'niggers', 'nigga', 'niggas',
  'chink', 'chinks', 'gook', 'gooks', 'kike', 'kikes',
  'spic', 'spics', 'wetback', 'wetbacks', 'beaner', 'beaners',
  'towelhead', 'raghead', 'paki', 'coon', 'coons', 'darkie', 'jap', 'japs',
  'faggot', 'faggots', 'fag', 'fags', 'dyke', 'dykes', 'tranny', 'trannies',
  'shemale', 'homo', 'homos',
  'retard', 'retards', 'retarded', 'mongoloid',
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'motherfucker', 'motherfuckers',
  'shit', 'shits', 'shitty', 'bullshit',
  'bitch', 'bitches', 'bastard', 'bastards', 'cunt', 'cunts',
  'asshole', 'assholes', 'ass', 'asses',
  'dick', 'dicks', 'dickhead', 'cock', 'cocks', 'cocksucker',
  'pussy', 'whore', 'whores', 'slut', 'sluts',
];

const BLOCKED_PATTERNS = BLOCKED_TERMS.map((term) => {
  const letters = [...term];
  const body = letters
    .map((letter, index) => (index === letters.length - 1 ? letter : `${letter}[^a-z]{0,3}`))
    .join('');
  return new RegExp(`(?<![a-z])${body}(?![a-z])`, 'i');
});

const PLAIN_TEXT = /^[\p{L}\p{N}\s.,!?'"‘’“”():;&/…-]+$/u;

export type ScreenedComment =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

function foldSymbols(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

function matchesMaskedTerm(folded: string): boolean {
  return folded.split(/[^a-z*#!]+/).some((part) => {
    if (!/[a-z][*#!]+[a-z]/.test(part)) return false;
    const token = part.replace(/[*#!]/g, '');
    return BLOCKED_TERMS.some((term) => {
      if (term.length < 4) return false;
      if (token.length < term.length - 2 || token.length >= term.length) return false;
      let at = 0;
      for (const letter of term) {
        if (token[at] === letter) at += 1;
      }
      return at === token.length;
    });
  });
}

function squeezeLetters(input: string, keep: number): string {
  return input.replace(/([a-z])\1+/g, (run) => run[0].repeat(Math.min(run.length, keep)));
}

export function containsBlockedLanguage(input: string): boolean {
  const folded = foldSymbols(input);
  const forms = [folded, squeezeLetters(folded, 2), squeezeLetters(folded, 1)];
  return forms.some((form) => BLOCKED_PATTERNS.some((pattern) => pattern.test(form)) || matchesMaskedTerm(form));
}

/** A blank review stores stars only. A posted comment is at most 200 characters. */
export function screenReviewComment(input: string | null | undefined): ScreenedComment {
  const scanned = sanitizeTextField(input ?? '');
  if (scanned.blocked) {
    return { ok: false, message: 'That comment cannot be saved.' };
  }
  const value = scanned.value;
  if (!value) return { ok: true, value: null };
  if (value.length > REVIEW_COMMENT_LIMIT) {
    return { ok: false, message: 'A review comment can be 200 characters.' };
  }
  if (containsBlockedLanguage(value)) {
    return { ok: false, message: 'That comment includes language that is not allowed.' };
  }
  if (!PLAIN_TEXT.test(value)) {
    return { ok: false, message: 'A review comment can use letters, numbers, and plain punctuation.' };
  }
  return { ok: true, value };
}
