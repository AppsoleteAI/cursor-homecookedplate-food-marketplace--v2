import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type CapturedPhoto = { base64: string; mimeType: string };

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
        quality: 0.85,
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
      finish({
        base64: asset.base64,
        mimeType: asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg',
      });
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
