import { safeRequestId } from "./request-id";

/**
 * Ordinary JSON stays at 10 MB.
 * A meal photo, a profile photo, a meal video, and a clip are base64 inside JSON.
 * Their HTTP ceiling is the 50 MB video check plus a small envelope, so the
 * existing file checks still decide the photo and the video.
 */

export const JSON_BODY_MAX_BYTES = 10 * 1024 * 1024;
export const MEAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const UPLOAD_ENVELOPE_BYTES = 64 * 1024;
export const BODY_TOO_LARGE = "BODY_TOO_LARGE";

export function base64Bytes(fileBytes: number): number {
  if (!Number.isInteger(fileBytes) || fileBytes < 0) {
    throw new Error("File size must be a whole number of bytes.");
  }
  return Math.ceil(fileBytes / 3) * 4;
}

export const MEDIA_BODY_MAX_BYTES = base64Bytes(VIDEO_MAX_BYTES) + UPLOAD_ENVELOPE_BYTES;

let rejectedBodies = 0;

export function rejectedBodyCount(): number {
  return rejectedBodies;
}

export function resetRejectedBodies(): void {
  rejectedBodies = 0;
}

export function uploadPath(path: string): boolean {
  const name = path.split("?")[0];
  return /\/(?:media\.upload|media\.uploadProfile|clips\.publish)$/.test(name);
}

export function bodyMaxBytes(path: string): number {
  return uploadPath(path) ? MEDIA_BODY_MAX_BYTES : JSON_BODY_MAX_BYTES;
}

export function noteRejectedBody(path: string, bytes: number, max: number, requestId: unknown): void {
  rejectedBodies += 1;
  const safePath = path.split("?")[0].slice(0, 120);
  console.error(`${BODY_TOO_LARGE} count=${rejectedBodies} path=${safePath} bytes=${bytes} max=${max} request_id=${safeRequestId(requestId)}`);
}

function refuse(c: { req: { path: string }; get?: (key: string) => unknown; json: (body: unknown, status: number) => Response }, bytes: number, max: number): Response {
  noteRejectedBody(c.req.path, bytes, max, c.get?.("requestId"));
  return c.json({ error: "Request too large." }, 413);
}

export async function cappedBody(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let over = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        over = true;
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    if (!over) reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function limitBody() {
  return async (c: any, next: () => Promise<void>) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      await next();
      return;
    }
    const max = bodyMaxBytes(c.req.path);
    const raw = c.req.raw as Request;
    const chunked = raw.headers.has("transfer-encoding");
    const lengthHeader = raw.headers.get("content-length");
    if (lengthHeader !== null && !chunked) {
      const declared = Number(lengthHeader);
      if (!Number.isInteger(declared) || declared < 0 || declared > max) {
        return refuse(c, Number.isFinite(declared) ? declared : 0, max);
      }
      await next();
      return;
    }
    if (!raw.body) {
      await next();
      return;
    }
    const bytes = await cappedBody(raw.body, max);
    if (!bytes) return refuse(c, max + 1, max);
    c.req.raw = new Request(raw, { body: bytes as BodyInit });
    await next();
  };
}
