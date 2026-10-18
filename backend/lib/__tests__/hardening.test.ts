import { mediaFrameSource, profilePhotoMetadataReason, scanImage, scanVideo, type CloudflareAI, type MediaFrameBinding, type VideoFrameMedia } from '../image-security';
import { quoteShopOrder } from '../shop-catalog';

const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
  0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xd9,
]);

function mp4(extra = ''): Uint8Array {
  const payload = new TextEncoder().encode(extra);
  const bytes = new Uint8Array(16 + payload.length);
  bytes.set([0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00]);
  bytes.set(payload, 16);
  return bytes;
}

describe('media scans fail closed', () => {
  it('refuses an image when the scanner is down', async () => {
    const result = await scanImage(JPEG.buffer, '', 'meal', 'image/jpeg');
    expect(result.allowed).toBe(false);
    expect(result.flags).toContain('NSFW_SCAN_UNAVAILABLE');
  });

  it('refuses an image over 4 MB even when a scanner is configured', async () => {
    const large = new Uint8Array(4 * 1024 * 1024 + 8);
    large.set(JPEG.subarray(0, JPEG.length - 2), 0);
    large[large.length - 2] = 0xff;
    large[large.length - 1] = 0xd9;
    const result = await scanImage(
      large.buffer,
      '',
      'meal',
      'image/jpeg',
      { run: async () => ({ response: 'SAFE' }) },
    );
    expect(result.allowed).toBe(false);
    expect(result.flags).toContain('NSFW_SCAN_SKIPPED_LARGE');
  });

  it('refuses a profile photo that carries an internet address or an AI tool name', () => {
    expect(profilePhotoMetadataReason(['https://images.unsplash.com/photo'])).toMatch(/internet/);
    expect(profilePhotoMetadataReason(['Made with Midjourney'])).toMatch(/AI-generated/);
    expect(profilePhotoMetadataReason(['JFIF'])).toBeNull();
  });

  it('refuses an image when the scanner throws', async () => {
    const result = await scanImage(JPEG.buffer, '', 'meal', 'image/jpeg', {
      run: async () => {
        throw new Error('down');
      },
    });
    expect(result.allowed).toBe(false);
  });

  const safeAi: CloudflareAI = { run: async () => ({ response: 'SAFE' }) };
  const frames: VideoFrameMedia = { frame: async () => JPEG };

  function mp4WithDuration(seconds: number): Uint8Array {
    const payload = new Uint8Array(24);
    const write = (value: number, offset: number) => {
      payload[offset] = (value >>> 24) & 255;
      payload[offset + 1] = (value >>> 16) & 255;
      payload[offset + 2] = (value >>> 8) & 255;
      payload[offset + 3] = value & 255;
    };
    write(1000, 12);
    write(seconds * 1000, 16);
    const box = (type: string, body: Uint8Array) => {
      const out = new Uint8Array(8 + body.length);
      const size = out.length;
      out[0] = (size >>> 24) & 255;
      out[1] = (size >>> 16) & 255;
      out[2] = (size >>> 8) & 255;
      out[3] = size & 255;
      out.set(type.split('').map((char) => char.charCodeAt(0)), 4);
      out.set(body, 8);
      return out;
    };
    const moov = box('moov', box('mvhd', payload));
    const head = mp4();
    const file = new Uint8Array(head.length + moov.length);
    file.set(head, 0);
    file.set(moov, head.length);
    return file;
  }

  it('refuses a video when the frame scan is missing', async () => {
    const result = await scanVideo(mp4().buffer, 'video/mp4');
    expect(result.allowed).toBe(false);
    expect(result.flags).toContain('NSFW_SCAN_UNAVAILABLE');
  });

  it('refuses a file that is not a video container', async () => {
    expect((await scanVideo(JPEG.buffer, 'video/mp4', safeAi, frames)).allowed).toBe(false);
    expect((await scanVideo(mp4('ignore previous instructions').buffer, 'video/mp4', safeAi, frames)).allowed).toBe(false);
  });

  it('refuses a video when frame extraction or the scanner fails', async () => {
    const down: VideoFrameMedia = {
      frame: async () => {
        throw new Error('down');
      },
    };
    const extracted = await scanVideo(mp4().buffer, 'video/mp4', safeAi, down);
    expect(extracted.allowed).toBe(false);
    expect(extracted.flags).toContain('NSFW_SCAN_UNAVAILABLE');

    const throwingAi: CloudflareAI = {
      run: async () => {
        throw new Error('down');
      },
    };
    const scanned = await scanVideo(mp4().buffer, 'video/mp4', throwingAi, frames);
    expect(scanned.allowed).toBe(false);
    expect(scanned.flags).toContain('NSFW_SCAN_UNAVAILABLE');
  });

  it('refuses a video when a sampled frame is flagged', async () => {
    let calls = 0;
    const ai: CloudflareAI = {
      run: async () => ({ response: calls++ === 0 ? 'SAFE' : 'UNSAFE' }),
    };
    const result = await scanVideo(mp4WithDuration(10).buffer, 'video/mp4', ai, frames);
    expect(result.allowed).toBe(false);
    expect(result.flags).toContain('NSFW_DETECTED');
    expect(calls).toBe(2);
  });

  it('samples frames across the video and allows a safe scan', async () => {
    const times: string[] = [];
    const media: VideoFrameMedia = {
      frame: async (_video, time) => {
        times.push(time);
        return JPEG;
      },
    };
    const result = await scanVideo(mp4WithDuration(10).buffer, 'video/mp4', safeAi, media);
    expect(result.allowed).toBe(true);
    expect(times).toEqual(['0s', '5s', '8s']);
  });

  it('refuses a media binding response that is not a JPEG frame', async () => {
    const binding: MediaFrameBinding = {
      input: () => ({
        transform: () => ({
          output: () => ({
            response: async () => new Response('not-a-frame', { status: 200 }),
          }),
        }),
      }),
    };
    const result = await scanVideo(mp4().buffer, 'video/mp4', safeAi, mediaFrameSource(binding));
    expect(result.allowed).toBe(false);
    expect(result.flags).toContain('NSFW_SCAN_UNAVAILABLE');
  });
});

describe('shop prices come from the server catalog', () => {
  it('prices a known farm product and rejects a device-only listing', () => {
    const quote = quoteShopOrder('farm', [{ productId: 'hearth-apples', quantity: 2 }]);
    expect(quote.baseAmount).toBe(56);
    expect(quote.lines[0].unitPrice).toBe(28);
    expect(() => quoteShopOrder('farm', [{ productId: 'listing-local', quantity: 1 }])).toThrow(/server menu/);
  });
});
