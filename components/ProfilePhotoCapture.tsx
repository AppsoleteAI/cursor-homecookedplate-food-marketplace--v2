import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type CapturedPhoto = { base64: string; mimeType: string };

function rawBase64(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

async function cameraJpeg(base64: string, mimeType: string): Promise<CapturedPhoto> {
  const bytes = rawBase64(base64);
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return { base64: bytes, mimeType };
  }
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('photo'));
      img.src = `data:${mimeType};base64,${bytes}`;
    });
    const max = 768;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { base64: bytes, mimeType };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const next = rawBase64(dataUrl);
    return next ? { base64: next, mimeType: 'image/jpeg' } : { base64: bytes, mimeType };
  } catch {
    return { base64: bytes, mimeType };
  }
}

function tell(message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert('Profile photo', message);
}

export function ProfilePhotoCapture({ onDone }: { onDone: (photo: CapturedPhoto | null) => void }) {
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finish = (photo: CapturedPhoto | null) => {
    if (finished.current) return;
    finished.current = true;
    onDoneRef.current(photo);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        tell('Camera access is required. A photo from the internet or your gallery is not accepted.');
        finish(null);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        cameraType: 'front' as ImagePicker.CameraType,
      });
      if (cancelled) return;
      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset?.base64) {
        finish(null);
        return;
      }
      const mimeType = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
      finish(await cameraJpeg(asset.base64, mimeType));
    })().catch(() => {
      tell('The camera did not open. Take the photo in the app.');
      finish(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
