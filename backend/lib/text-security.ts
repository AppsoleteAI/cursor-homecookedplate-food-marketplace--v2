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
 *    RTL override (U+202E) and related control chars visually reverse text so
 *    "UNSAFE" appears as "EFASNU" on screen while the raw string still reads
 *    "UNSAFE" to an AI. Also enables same-color-text attacks in web views.
 *    Action: strip, block submission.
 *
 * 3. Control characters
 *    Null bytes, C0/C1 control codes outside of standard whitespace (TAB/LF/CR)
 *    can smuggle data past string comparisons.
 *    Action: strip silently, add flag.
 *
 * 4. Prompt injection patterns
 *    Regex-matched LLM jailbreak / instruction-override phrases.
 *    Action: block submission.
 *
 * 5. Mixed-script homoglyphs
 *    A suspicious mix of Cyrillic and Latin characters where some Cyrillic
 *    glyphs are visually identical to Latin (е, а, о, р, с, х, у, …) but
 *    have different code points. Used to evade keyword filters.
 *    Action: flag only (strip is not possible without breaking legitimate bilingual text).
 *
 * Return value: sanitized string + blocked flag + audit flags.
 * Sanitization always runs. Blocking is reserved for high-risk patterns.
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

// Unicode bidirectional control characters
// U+202E  Right-to-Left Override  ← most dangerous (visually reverses text)
// U+202D  Left-to-Right Override
// U+202C  Pop Directional Formatting
// U+202B  Right-to-Left Embedding
// U+202A  Left-to-Right Embedding
// U+200F  Right-to-Left Mark
// U+200E  Left-to-Right Mark
// U+2066–U+2069  Isolates
const BIDI_OVERRIDE_RE = /[\u202A\u202B\u202C\u202D\u202E\u200E\u200F\u2066\u2067\u2068\u2069]/g;

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

/**
 * Scans a single text string for security issues.
 *
 * - Always returns a sanitized version with invisible/control characters removed.
 * - Sets `blocked = true` for high-risk patterns (injection, bidi override).
 * - Lower-risk issues (zero-width chars, homoglyphs) are flagged but not blocked
 *   because legitimate content can occasionally trigger them.
 */
export function scanText(input: string): TextScanResult {
  const flags: string[] = [];

  // Check before stripping so we can accurately flag presence
  if (ZERO_WIDTH_RE.test(input)) flags.push('ZERO_WIDTH_CHARS');
  ZERO_WIDTH_RE.lastIndex = 0;

  if (BIDI_OVERRIDE_RE.test(input)) flags.push('BIDI_OVERRIDE');
  BIDI_OVERRIDE_RE.lastIndex = 0;

  if (CONTROL_RE.test(input)) flags.push('CONTROL_CHARS');
  CONTROL_RE.lastIndex = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      flags.push('PROMPT_INJECTION');
      break;
    }
  }

  if (hasMixedScript(input)) flags.push('MIXED_SCRIPT_HOMOGLYPHS');

  // Strip all invisible and dangerous characters regardless of block decision
  const sanitized = input
    .replace(ZERO_WIDTH_RE, '')
    .replace(BIDI_OVERRIDE_RE, '')
    .replace(CONTROL_RE, '')
    .trim();

  // Block on high-risk patterns: prompt injection or bidi override
  // Zero-width chars, control chars, and mixed script are stripped but allowed
  const blocked =
    flags.includes('PROMPT_INJECTION') || flags.includes('BIDI_OVERRIDE');

  return { sanitized, blocked, flags };
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
