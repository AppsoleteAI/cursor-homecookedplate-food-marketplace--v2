import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { app } from "../../hono";
import {
  BODY_TOO_LARGE,
  JSON_BODY_MAX_BYTES,
  MEDIA_BODY_MAX_BYTES,
  MEAL_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_BYTES,
  UPLOAD_ENVELOPE_BYTES,
  VIDEO_MAX_BYTES,
  base64Bytes,
  bodyMaxBytes,
  cappedBody,
  rejectedBodyCount,
  resetRejectedBodies,
  uploadPath,
} from "../body-limit";

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("request body ceilings", () => {
  beforeEach(() => {
    resetRejectedBodies();
  });

  it("keeps ordinary JSON at 10 MB and gives uploads room for a 50 MB file", () => {
    expect(JSON_BODY_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(base64Bytes(PROFILE_IMAGE_MAX_BYTES)).toBeLessThan(JSON_BODY_MAX_BYTES);
    expect(base64Bytes(MEAL_IMAGE_MAX_BYTES)).toBeGreaterThan(JSON_BODY_MAX_BYTES);
    expect(base64Bytes(MEAL_IMAGE_MAX_BYTES) + UPLOAD_ENVELOPE_BYTES).toBeLessThan(MEDIA_BODY_MAX_BYTES);
    expect(base64Bytes(VIDEO_MAX_BYTES) + UPLOAD_ENVELOPE_BYTES).toBe(MEDIA_BODY_MAX_BYTES);
    expect(uploadPath("/api/trpc/media.upload")).toBe(true);
    expect(uploadPath("/api/trpc/media.uploadProfile?batch=1")).toBe(true);
    expect(uploadPath("/api/trpc/clips.publish")).toBe(true);
    expect(uploadPath("/api/trpc/clips.publishLink")).toBe(false);
    expect(uploadPath("/api/trpc/orders.create")).toBe(false);
    expect(bodyMaxBytes("/api/trpc/orders.create")).toBe(JSON_BODY_MAX_BYTES);
    expect(bodyMaxBytes("/api/trpc/media.upload")).toBe(MEDIA_BODY_MAX_BYTES);
    expect(bodyMaxBytes("/webhook/stripe")).toBe(JSON_BODY_MAX_BYTES);
  });

  it("matches the file checks already used for a meal photo, a profile photo, and a video", () => {
    const scanner = readFileSync(resolve(__dirname, "../image-security.ts"), "utf8");
    expect(scanner).toContain("meal: 10 * 1024 * 1024");
    expect(scanner).toContain("profile: 5 * 1024 * 1024");
    expect(scanner).toContain("const maxBytes = 50 * 1024 * 1024");
  });

  it("stops a chunked body once it passes the ceiling and counts that refusal", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const allowed = await cappedBody(streamOf(new Uint8Array(8)), 8);
    expect(allowed?.byteLength).toBe(8);
    const refused = await cappedBody(streamOf(new Uint8Array(9)), 8);
    expect(refused).toBeNull();
    const response = await app.request("http://localhost/api/trpc/orders.create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(JSON_BODY_MAX_BYTES + 1),
        "cf-connecting-ip": "203.0.113.50",
      },
      body: "{}",
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Request too large." });
    expect(rejectedBodyCount()).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining(BODY_TOO_LARGE));
    expect(error.mock.calls.some((call) => String(call[0]).includes("203.0.113.50"))).toBe(false);
    error.mockRestore();
  });

  it("accepts an upload declaration between the JSON ceiling and the media ceiling", async () => {
    const meal = await app.request("http://localhost/api/trpc/media.upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(JSON_BODY_MAX_BYTES + 1),
        "cf-connecting-ip": "203.0.113.51",
      },
      body: "{}",
    });
    const clip = await app.request("http://localhost/api/trpc/clips.publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(base64Bytes(MEAL_IMAGE_MAX_BYTES)),
        "cf-connecting-ip": "203.0.113.52",
      },
      body: "{}",
    });
    const profile = await app.request("http://localhost/api/trpc/media.uploadProfile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(base64Bytes(PROFILE_IMAGE_MAX_BYTES)),
        "cf-connecting-ip": "203.0.113.53",
      },
      body: "{}",
    });
    expect(meal.status).not.toBe(413);
    expect(clip.status).not.toBe(413);
    expect(profile.status).not.toBe(413);
    expect(rejectedBodyCount()).toBe(0);
    const oversizedClip = await app.request("http://localhost/api/trpc/clips.publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MEDIA_BODY_MAX_BYTES + 1),
        "cf-connecting-ip": "203.0.113.54",
      },
      body: "{}",
    });
    expect(oversizedClip.status).toBe(413);
    expect(rejectedBodyCount()).toBe(1);
  });
});
