export async function readLocalMedia(
  uri: string,
  type: 'image' | 'video',
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read that file');
  }
  const blob = await response.blob();
  const fromName = uri.toLowerCase().endsWith('.mov') || uri.toLowerCase().endsWith('.qt')
    ? 'video/quicktime'
    : type === 'video'
      ? 'video/mp4'
      : 'image/jpeg';
  const mimeType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : fromName;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType };
}
