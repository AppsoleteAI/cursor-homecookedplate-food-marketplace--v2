/**
 * Text Security Library
 *
 * Sanitizes and scans user-submitted text fields for:
 *
 * 1. Zero-width / invisible Unicode characters
 *    Invisible chars (U+200B, U+200C, U+200D, U+FEFF, etc.) are used to hide
 *    injected prompt text that is invisible to human reviewers but read by LLMs.
 *    Action: strip silently, add flag.
 *
 * 2. Unicode bidirectional override characters
 *    RTL override (U+202E) and the other override/embedding characters visually
 *    reverse text. Ordinary direction marks and isolates are stripped and the
 *    message is still accepted, so Arabic and Hebrew text can be sent.
 *    Action: strip overrides and block. Strip marks without blocking.
 *
 * 3. Control characters
 *    Null bytes, C0/C1 control codes outside of standard whitespace (TAB/LF/CR)
 *    can smuggle data past string comparisons.
 *    Action: strip and block.
 *
 * 4. Prompt injection patterns
 *    Regex-matched LLM jailbreak / instruction-override phrases.
 *    Action: block submission.
 *
 * 5. Mixed-script homoglyphs
 *    A suspicious mix of Cyrillic and Latin characters where some Cyrillic
 *    glyphs are visually identical to Latin (е, а, о, р, с, х, у, …) but
 *    have different code points. Used to evade keyword filters.
 *    Action: fold lookalikes on a detection copy, then run the phrase check.
 *    A bilingual name is stored when that copy does not match.
 *
 * The phrase check runs after hidden characters are removed and the copy is
 * NFKC-normalized. The phrase list is a backstop. It does not stop every
 * instruction, and it does not read words drawn in a picture.
 */

export interface TextScanResult {
  sanitized: string;
  blocked: boolean;
  flags: string[];
}

// ---------------------------------------------------------------------------
// Character-class regexes
// ---------------------------------------------------------------------------

// Zero-width and invisible Unicode characters
// U+200B  Zero Width Space
// U+200C  Zero Width Non-Joiner
// U+200D  Zero Width Joiner
// U+FEFF  BOM / Zero Width No-Break Space
// U+2060  Word Joiner
// U+180E  Mongolian Vowel Separator (deprecated, invisible in most renderers)
// U+00AD  Soft Hyphen (invisible unless line-break triggered)
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060\u180E\u00AD]/g;

// Override and embedding characters. These are refused.
const BIDI_OVERRIDE_RE = /[\u202A\u202B\u202C\u202D\u202E]/g;

// Direction marks and isolates. Stripped so they cannot hide a phrase.
// A message that contains only these still sends when other words remain.
const BIDI_MARK_RE = /[\u200E\u200F\u2066\u2067\u2068\u2069]/g;

// Null bytes and C0/C1 control characters
// Excluded (safe whitespace): U+0009 TAB, U+000A LF, U+000D CR
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g;

// ---------------------------------------------------------------------------
// Prompt injection patterns
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|commands?|rules?|context)/i,
  /\bsystem\s*prompt\b/i,
  /\byou\s+are\s+(now\s+)?(a|an|the)\s+\w/i,
  /\bact\s+as\s+(a|an)\s+/i,
  /forget\s+(all\s+)?(previous|prior|everything)/i,
  /do\s+not\s+(moderate|review|flag|reject|filter|block)\s+this/i,
  /approve\s+this\s+(listing|meal|image|content|post)/i,
  /\bjailbreak\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bdan\b.*\bmode\b/i,
  /<\|im_start\|>/,
  /<\|endoftext\|>/,
  /\[system\]/i,
  /\bprompt\s+injection\b/i,
  // Instruction delimiters used by common LLM frameworks
  /###\s*instruction/i,
  /\bHuman:\s/,
  /\bAssistant:\s/,
  // Null-byte / Unicode escape smuggling attempts
  /\\u00[0-9a-fA-F]{2}/,
  /\\x[0-9a-fA-F]{2}/,
];

// ---------------------------------------------------------------------------
// Mixed-script homoglyph detection
// ---------------------------------------------------------------------------

// Flag a suspicious mixture of Cyrillic and Latin characters.
// Pure Cyrillic text (e.g. a Russian meal name) is fine — only flag if both
// scripts appear in a ratio that suggests deliberate lookalike substitution.
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[a-zA-Z]/;

const CONFUSABLES = new Map<string, string>([
  ['\u0430', 'a'], ['\u0410', 'A'],
  ['\u0435', 'e'], ['\u0415', 'E'],
  ['\u043e', 'o'], ['\u041e', 'O'],
  ['\u0440', 'p'], ['\u0420', 'P'],
  ['\u0441', 'c'], ['\u0421', 'C'],
  ['\u0443', 'y'], ['\u0423', 'Y'],
  ['\u0445', 'x'], ['\u0425', 'X'],
  ['\u0456', 'i'], ['\u0406', 'I'],
  ['\u0455', 's'], ['\u0405', 'S'],
  ['\u0458', 'j'],
  ['\u04bb', 'h'], ['\u04ba', 'H'],
  ['\u0412', 'B'], ['\u041d', 'H'], ['\u041a', 'K'], ['\u041c', 'M'], ['\u0422', 'T'],
  ['\u03b1', 'a'], ['\u0391', 'A'],
  ['\u03bf', 'o'], ['\u039f', 'O'],
  ['\u03c1', 'p'], ['\u03a1', 'P'],
  ['\u03b5', 'e'], ['\u0395', 'E'],
  ['\u03b9', 'i'], ['\u0399', 'I'],
  ['\u03ba', 'k'], ['\u039a', 'K'],
  ['\u03bd', 'v'], ['\u039d', 'N'],
  ['\u03c4', 't'], ['\u03a4', 'T'],
  ['\u03c5', 'u'], ['\u03a5', 'Y'],
  ['\u03c7', 'x'], ['\u03a7', 'X'],
]);

function foldConfusables(text: string): string {
  let out = '';
  for (const char of text) out += CONFUSABLES.get(char) ?? char;
  return out;
}

function hasMixedScript(text: string): boolean {
  const chars = [...text];
  const cyrCount = chars.filter((c) => CYRILLIC_RE.test(c)).length;
  const latCount = chars.filter((c) => LATIN_RE.test(c)).length;
  const total = cyrCount + latCount;
  if (total < 5) return false;
  const ratio = cyrCount / total;
  // Flag when Cyrillic makes up 8–92 % of letter characters.
  // Pure Cyrillic (> 92 %) and pure Latin (< 8 %) are both fine.
  return ratio > 0.08 && ratio < 0.92;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function saw(pattern: RegExp, input: string): boolean {
  const found = pattern.test(input);
  pattern.lastIndex = 0;
  return found;
}

/**
 * Scans a single text string for security issues.
 *
 * Hidden characters are removed before the phrase check. The stored string
 * is the stripped, NFKC text. Lookalike letters are folded only on the
 * detection copy.
 *
 * Refuses hidden characters, control characters, bidirectional overrides,
 * and a phrase match. A direction mark does not refuse the text.
 */
export function scanText(input: string): TextScanResult {
  const flags: string[] = [];

  if (saw(ZERO_WIDTH_RE, input)) flags.push('ZERO_WIDTH_CHARS');
  if (saw(BIDI_OVERRIDE_RE, input)) flags.push('BIDI_OVERRIDE');
  if (saw(CONTROL_RE, input)) flags.push('CONTROL_CHARS');

  const stripped = input
    .replace(ZERO_WIDTH_RE, '')
    .replace(BIDI_OVERRIDE_RE, '')
    .replace(BIDI_MARK_RE, '')
    .replace(CONTROL_RE, '');
  const normalized = stripped.normalize('NFKC').trim();
  const detection = foldConfusables(normalized);

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(detection)) {
      flags.push('PROMPT_INJECTION');
      break;
    }
  }

  if (hasMixedScript(normalized)) flags.push('MIXED_SCRIPT_HOMOGLYPHS');

  const blocked =
    flags.includes('PROMPT_INJECTION') ||
    flags.includes('BIDI_OVERRIDE') ||
    flags.includes('ZERO_WIDTH_CHARS') ||
    flags.includes('CONTROL_CHARS');

  return { sanitized: normalized, blocked, flags };
}

/**
 * Convenience wrapper: sanitize a field value and return a result shaped for
 * use inside tRPC mutations.
 *
 * Usage:
 *   const { value, blocked, flags } = sanitizeTextField(input.name);
 *   if (blocked) throw new TRPCError({ code: 'BAD_REQUEST', message: '...' });
 *   updateData.name = value;
 */
export function sanitizeTextField(
  input: string,
): { value: string; blocked: boolean; flags: string[] } {
  const result = scanText(input);
  return { value: result.sanitized, blocked: result.blocked, flags: result.flags };
}

/**
 * Sanitize an array of text values (e.g. ingredients, tags).
 * Returns the sanitized array and a combined flag list.
 * Blocks if any individual item is blocked.
 */
export function sanitizeTextArray(
  items: string[],
): { values: string[]; blocked: boolean; flags: string[] } {
  const allFlags: string[] = [];
  let anyBlocked = false;
  const values = items.map((item) => {
    const r = sanitizeTextField(item);
    if (r.blocked) anyBlocked = true;
    allFlags.push(...r.flags);
    return r.value;
  });
  return { values, blocked: anyBlocked, flags: [...new Set(allFlags)] };
}
