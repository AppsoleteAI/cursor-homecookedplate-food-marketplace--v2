/**
 * Image Security Library
 *
 * Validates uploaded images for:
 * - MIME type spoofing via magic bytes (not content-type header or file extension)
 * - File size limits per upload context
 * - Embedded metadata prompt injection (EXIF APP1/COM, PNG tEXt/iTXt chunks)
 * - Trailing data appended after the image end marker (steganographic payload risk)
 * - NSFW content moderation via Cloudflare Workers AI (required; the upload is refused if it cannot be scanned)
 *
 * Designed for Cloudflare Workers — zero Node.js dependencies.
 */

export type ImageContext = 'meal' | 'profile';
export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface CloudflareAI {
  run(model: string, input: Record<string, unknown>): Promise<{ response?: string }>;
}

export interface MediaFrameBinding {
  input(source: Blob | ReadableStream): {
    transform(options: { width: number }): {
      output(options: { mode: 'frame'; time: string; format: 'jpg' }): {
        response(): Promise<Response>;
      };
    };
  };
}

export interface VideoFrameMedia {
  frame(video: Uint8Array, time: string): Promise<Uint8Array>;
}

const NSFW_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const NSFW_PROMPT =
  'This image is from a home-cooked food marketplace. Does it contain nudity, sexual content, graphic violence, gore, or any content inappropriate for a general audience? Answer with ONE word only: SAFE or UNSAFE.';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function nsfwVerdict(ai: CloudflareAI, bytes: Uint8Array): Promise<string> {
  const result = await ai.run(NSFW_MODEL, {
    image: Array.from(bytes),
    prompt: NSFW_PROMPT,
    max_tokens: 8,
  });
  const text = typeof result?.response === 'string' ? result.response : '';
  return text.trim().toUpperCase();
}

export interface ImageScanResult {
  allowed: boolean;
  detectedMime: SupportedMime | null;
  flags: string[];
  reason?: string;
}

// Stricter than Supabase bucket limits — enforced at the application layer first
const SIZE_LIMITS: Record<ImageContext, number> = {
  meal: 10 * 1024 * 1024,   // 10 MB
  profile: 5 * 1024 * 1024, // 5 MB
};

// ---------------------------------------------------------------------------
// Magic bytes detection
// ---------------------------------------------------------------------------

function detectMime(buf: Uint8Array): SupportedMime | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';

  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';

  return null;
}

// ---------------------------------------------------------------------------
// Prompt injection pattern matching (applied to metadata strings)
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|commands?|rules?)/i,
  /\bsystem\s*prompt\b/i,
  /you\s+are\s+(now\s+)?(a|an|the)\s+\w/i,
  /\bact\s+as\s+(a|an)\s+/i,
  /forget\s+(all\s+)?(previous|prior|everything)/i,
  /do\s+not\s+(moderate|review|flag|reject|filter|block)\s+this/i,
  /approve\s+this\s+(listing|meal|image|content|post)/i,
  /\bjailbreak\b/i,
  /\bdeveloper\s+mode\b/i,
  /<\|im_start\|>/,
  /<\|endoftext\|>/,
  /\[system\]/i,
];

function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

const AI_IMAGE_MARKERS: RegExp[] = [
  /stable\s*diffusion/i,
  /midjourney/i,
  /dall[- ]?e/i,
  /\bopenai\b/i,
  /adobe firefly/i,
  /comfyui/i,
  /novelai/i,
  /leonardo\.ai/i,
  /c2pa/i,
  /trainedalgorithmicmedia/i,
  /negative prompt/i,
  /cfg scale/i,
];

function looksLikeDownloadedImage(text: string): boolean {
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return urls.some((url) => !/^https?:\/\/(ns\.|www\.w3\.org|purl\.org|schemas\.)/i.test(url));
}

export function profilePhotoMetadataReason(texts: string[]): string | null {
  const joined = texts.join('\n');
  if (AI_IMAGE_MARKERS.some((pattern) => pattern.test(joined))) {
    return 'This file looks like an AI-generated image. Take a photo with your camera.';
  }
  if (looksLikeDownloadedImage(joined)) {
    return 'This file looks like an image from the internet. Take a photo with your camera.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// JPEG metadata extraction
// ---------------------------------------------------------------------------

/**
 * Walks JPEG segment markers and returns human-readable strings from:
 * - FF FE (COM — comment marker)
 * - FF E1 (APP1 — EXIF/XMP)
 * - FF E0 (APP0 — JFIF)
 */
function readJpegMetadataStrings(buf: Uint8Array): string[] {
  const strings: string[] = [];
  const dec = new TextDecoder('utf-8', { fatal: false });
  let i = 2; // skip SOI (FF D8)

  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const segLen = (buf[i + 2] << 8) | buf[i + 3];
    if (segLen < 2 || i + 2 + segLen > buf.length) break;

    // FF FE = COM, FF E0–FF EF = APP0–APP15
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) {
      strings.push(dec.decode(buf.slice(i + 4, i + 2 + segLen)));
    }

    // FF D9 = EOI — stop
    if (marker === 0xd9) break;

    i += 2 + segLen;
  }

  return strings;
}

/**
 * Returns true if bytes exist after the last FF D9 (JPEG end-of-image marker).
 * Trailing data is a red flag for steganographic payloads.
 */
function jpegHasTrailingData(buf: Uint8Array): boolean {
  for (let i = buf.length - 2; i > 0; i--) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd9) {
      return i + 2 < buf.length;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// PNG text chunk extraction
// ---------------------------------------------------------------------------

/**
 * Reads tEXt, iTXt, and zTXt chunk data from a PNG file.
 * These chunks can carry arbitrary text including injected prompts.
 */
function readPngTextChunks(buf: Uint8Array): string[] {
  const strings: string[] = [];
  const dec = new TextDecoder('utf-8', { fatal: false });
  let i = 8; // skip 8-byte PNG signature

  while (i + 12 <= buf.length) {
    const length =
      ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
    const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);

    if (type === 'IEND') break;
    if (length > buf.length) break; // corrupt file guard

    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      strings.push(dec.decode(buf.slice(i + 8, i + 8 + length)));
    }

    i += 12 + length; // 4 (length) + 4 (type) + length (data) + 4 (CRC)
  }

  return strings;
}

// ---------------------------------------------------------------------------
// Main scan entry point
// ---------------------------------------------------------------------------

/**
 * Scans an image for security issues.
 *
 * @param arrayBuffer  Decoded image bytes
 * @param base64Data   Original base64 string (passed directly to Cloudflare AI to avoid re-encoding)
 * @param context      Upload context: 'meal' or 'profile'
 * @param declaredMimeType  MIME type claimed by the client
 * @param ai           Optional Cloudflare Workers AI binding for NSFW checks
 */
export async function scanImage(
  arrayBuffer: ArrayBuffer,
  base64Data: string,
  context: ImageContext,
  declaredMimeType: string,
  ai?: CloudflareAI,
): Promise<ImageScanResult> {
  const buf = new Uint8Array(arrayBuffer);
  const flags: string[] = [];

  // 1. File size check
  const maxBytes = SIZE_LIMITS[context];
  if (buf.length > maxBytes) {
    return {
      allowed: false,
      detectedMime: null,
      flags: ['SIZE_EXCEEDED'],
      reason: `File size ${(buf.length / 1024 / 1024).toFixed(2)} MB exceeds the ${maxBytes / 1024 / 1024} MB limit for ${context} images`,
    };
  }

  // 2. Magic bytes MIME detection
  const detectedMime = detectMime(buf);
  if (!detectedMime) {
    return {
      allowed: false,
      detectedMime: null,
      flags: ['INVALID_FORMAT'],
      reason: 'File header does not match a supported image format (JPEG, PNG, or WebP)',
    };
  }

  if (detectedMime !== declaredMimeType) {
    // Log the mismatch but use the detected (authoritative) type for the upload
    flags.push('MIME_MISMATCH');
  }

  // 3. Metadata injection scan
  const metaStrings: string[] = [];

  if (detectedMime === 'image/jpeg') {
    metaStrings.push(...readJpegMetadataStrings(buf));

    if (jpegHasTrailingData(buf)) {
      return {
        allowed: false,
        detectedMime,
        flags: [...flags, 'TRAILING_DATA'],
        reason: 'Image contains data appended after the end-of-image marker (possible steganographic payload)',
      };
    }
  } else if (detectedMime === 'image/png') {
    metaStrings.push(...readPngTextChunks(buf));
  }

  for (const text of metaStrings) {
    if (containsInjection(text)) {
      return {
        allowed: false,
        detectedMime,
        flags: [...flags, 'PROMPT_INJECTION_IN_METADATA'],
        reason: 'Image metadata contains prompt injection content',
      };
    }
  }

  if (context === 'profile') {
    const profileReason = profilePhotoMetadataReason(metaStrings);
    if (profileReason) {
      return {
        allowed: false,
        detectedMime,
        flags: [...flags, 'PROFILE_NOT_CAMERA'],
        reason: profileReason,
      };
    }
  }

  // 4. NSFW moderation via Cloudflare Workers AI (LLaVA vision model).
  //    Refuse the file when the scanner is missing, errors, or the image is over 4 MB.
  if (!ai) {
    return {
      allowed: false,
      detectedMime,
      flags: [...flags, 'NSFW_SCAN_UNAVAILABLE'],
      reason: 'Image could not be scanned',
    };
  }
  if (buf.length > 4 * 1024 * 1024) {
    return {
      allowed: false,
      detectedMime,
      flags: [...flags, 'NSFW_SCAN_SKIPPED_LARGE'],
      reason: 'Image is over 4 MB and was not scanned',
    };
  }
  try {
    const verdict = await nsfwVerdict(ai, buf);
    if (!verdict) {
      return {
        allowed: false,
        detectedMime,
        flags: [...flags, 'NSFW_SCAN_UNAVAILABLE'],
        reason: 'Image could not be scanned',
      };
    }
    if (verdict.startsWith('UNSAFE')) {
      return {
        allowed: false,
        detectedMime,
        flags: [...flags, 'NSFW_DETECTED'],
        reason: 'Image was flagged as inappropriate by content moderation',
      };
    }
    flags.push('NSFW_SCANNED_SAFE');
  } catch {
    return {
      allowed: false,
      detectedMime,
      flags: [...flags, 'NSFW_SCAN_UNAVAILABLE'],
      reason: 'Image could not be scanned',
    };
  }

  return { allowed: true, detectedMime, flags };
}

const MP4_BRANDS = new Set(['mp42', 'isom', 'iso2', 'avc1', 'mp41', 'M4V ', 'MSNV']);

export interface VideoScanResult {
  allowed: boolean;
  flags: string[];
  reason?: string;
}

function asciiRuns(buf: Uint8Array): string[] {
  const runs: string[] = [];
  let current = '';
  const consider = (index: number) => {
    const byte = buf[index];
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
      return;
    }
    if (current.length >= 8) runs.push(current);
    current = '';
  };
  const head = Math.min(buf.length, 256 * 1024);
  for (let i = 0; i < head; i += 1) consider(i);
  if (current.length >= 8) runs.push(current);
  current = '';
  const tailStart = Math.max(head, buf.length - 256 * 1024);
  for (let i = tailStart; i < buf.length; i += 1) consider(i);
  if (current.length >= 8) runs.push(current);
  return runs;
}

function readU32(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readU64(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) * 2 ** 32 + readU32(buf, offset + 4);
}

function childBox(
  buf: Uint8Array,
  start: number,
  end: number,
  type: string,
): { start: number; end: number } | null {
  let i = start;
  while (i + 8 <= end) {
    let size = readU32(buf, i);
    const boxType = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    let header = 8;
    if (size === 1) {
      if (i + 16 > end) return null;
      size = readU64(buf, i + 8);
      header = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < header || i + size > end) return null;
    if (boxType === type) return { start: i + header, end: i + size };
    i += size;
  }
  return null;
}

function videoDurationSeconds(buf: Uint8Array): number | null {
  const moov = childBox(buf, 0, buf.length, 'moov');
  if (!moov) return null;
  const mvhd = childBox(buf, moov.start, moov.end, 'mvhd');
  if (!mvhd) return null;
  const payload = mvhd.start;
  if (payload >= buf.length) return null;
  const version = buf[payload];
  let timescale = 0;
  let duration = 0;
  if (version === 0) {
    if (payload + 20 > mvhd.end) return null;
    timescale = readU32(buf, payload + 12);
    duration = readU32(buf, payload + 16);
  } else if (version === 1) {
    if (payload + 32 > mvhd.end) return null;
    timescale = readU32(buf, payload + 20);
    duration = readU64(buf, payload + 24);
  } else {
    return null;
  }
  if (timescale <= 0) return null;
  return duration / timescale;
}

function sampleTimes(durationSeconds: number | null): string[] {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return ['0s'];
  }
  const points = [0];
  if (durationSeconds >= 1.5) points.push(durationSeconds / 2);
  if (durationSeconds >= 3) points.push(Math.min(durationSeconds * 0.8, durationSeconds - 0.25));
  return [...new Set(points.map((point) => `${Math.max(0, Math.floor(point))}s`))];
}

export function mediaFrameSource(binding: MediaFrameBinding): VideoFrameMedia {
  return {
    async frame(video, time) {
      const copy = new ArrayBuffer(video.byteLength);
      new Uint8Array(copy).set(video);
      const response = await binding
        .input(new Blob([copy]).stream())
        .transform({ width: 480 })
        .output({ mode: 'frame', time, format: 'jpg' })
        .response();
      if (!response.ok) {
        throw new Error('Frame extract failed');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        throw new Error('Frame extract did not return a JPEG');
      }
      return bytes;
    },
  };
}

/**
 * Scans an uploaded video container, then still frames from it.
 * Refuses anything that is not MP4 or QuickTime, anything over 50 MB,
 * any container whose metadata contains injection text, and any file whose
 * frame scan is missing, errors, or flags a frame.
 */
export async function scanVideo(
  arrayBuffer: ArrayBufferLike,
  declaredMimeType: string,
  ai?: CloudflareAI,
  media?: VideoFrameMedia,
): Promise<VideoScanResult> {
  const buf = new Uint8Array(arrayBuffer);
  const maxBytes = 50 * 1024 * 1024;
  if (buf.length < 12 || buf.length > maxBytes) {
    return {
      allowed: false,
      flags: ['VIDEO_SIZE'],
      reason: 'Video must be a container between 12 bytes and 50 MB',
    };
  }

  const box = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
  const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  if (box !== 'ftyp') {
    return {
      allowed: false,
      flags: ['VIDEO_INVALID_FORMAT'],
      reason: 'File header is not a video container',
    };
  }

  const declared = declaredMimeType.toLowerCase();
  const quicktime = brand === 'qt  ';
  const mp4 = MP4_BRANDS.has(brand);
  if (declared === 'video/quicktime' && !quicktime) {
    return { allowed: false, flags: ['VIDEO_MIME_MISMATCH'], reason: 'File is not a QuickTime video' };
  }
  if (declared === 'video/mp4' && !mp4) {
    return { allowed: false, flags: ['VIDEO_MIME_MISMATCH'], reason: 'File is not an MP4 video' };
  }
  if (!quicktime && !mp4) {
    return { allowed: false, flags: ['VIDEO_UNSUPPORTED'], reason: 'Only MP4 and QuickTime videos can be uploaded' };
  }
  if (declared !== 'video/mp4' && declared !== 'video/quicktime') {
    return { allowed: false, flags: ['VIDEO_MIME_MISMATCH'], reason: 'Video type must be MP4 or QuickTime' };
  }

  for (const text of asciiRuns(buf)) {
    if (containsInjection(text)) {
      return {
        allowed: false,
        flags: ['PROMPT_INJECTION_IN_VIDEO'],
        reason: 'Video metadata contains disallowed text',
      };
    }
  }

  if (!ai || !media) {
    return {
      allowed: false,
      flags: ['NSFW_SCAN_UNAVAILABLE'],
      reason: 'Video could not be scanned',
    };
  }

  let frames: Uint8Array[];
  try {
    const times = sampleTimes(videoDurationSeconds(buf));
    frames = [];
    for (const time of times) {
      const frame = await media.frame(buf, time);
      if (frame.length < 3 || frame[0] !== 0xff || frame[1] !== 0xd8) {
        throw new Error('Frame is not a JPEG');
      }
      if (frame.length > 4 * 1024 * 1024) {
        return {
          allowed: false,
          flags: ['NSFW_SCAN_SKIPPED_LARGE'],
          reason: 'Video frame is over 4 MB and was not scanned',
        };
      }
      frames.push(frame);
    }
  } catch {
    return {
      allowed: false,
      flags: ['NSFW_SCAN_UNAVAILABLE'],
      reason: 'Video could not be scanned',
    };
  }

  if (frames.length === 0) {
    return {
      allowed: false,
      flags: ['NSFW_SCAN_UNAVAILABLE'],
      reason: 'Video could not be scanned',
    };
  }

  try {
    for (const frame of frames) {
      const verdict = await nsfwVerdict(ai, bytesToBase64(frame));
      if (!verdict) {
        return {
          allowed: false,
          flags: ['NSFW_SCAN_UNAVAILABLE'],
          reason: 'Video could not be scanned',
        };
      }
      if (verdict.startsWith('UNSAFE')) {
        return {
          allowed: false,
          flags: ['NSFW_DETECTED'],
          reason: 'Video was flagged as inappropriate by content moderation',
        };
      }
    }
  } catch {
    return {
      allowed: false,
      flags: ['NSFW_SCAN_UNAVAILABLE'],
      reason: 'Video could not be scanned',
    };
  }

  return { allowed: true, flags: ['VIDEO_CONTAINER_SCANNED', 'NSFW_SCANNED_SAFE'] };
}
