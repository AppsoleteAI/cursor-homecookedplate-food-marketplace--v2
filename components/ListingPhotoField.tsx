import React, { useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FoodImage } from '@/components/FoodImage';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';

type ListingPhotoFieldProps = {
  label: string;
  value?: string;
  onChange: (uri: string) => void;
  testID?: string;
  food?: boolean;
};

async function pickedUri(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (asset.base64) {
    const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  return asset.uri;
}

export function ListingPhotoField({ label, value, onChange, testID, food }: ListingPhotoFieldProps) {
  const [busy, setBusy] = useState(false);

  const choose = async (source: 'camera' | 'library') => {
    if (busy) return;
    setBusy(true);
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert('Camera access is required to take this photo.');
          return;
        }
      }
      if (source === 'library' && Platform.OS !== 'web') {
        const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!library.granted) {
          Alert.alert('Photo library access is required to choose this photo.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          });
      if (result.canceled || !result.assets[0]) return;
      onChange(await pickedUri(result.assets[0]));
    } catch {
      Alert.alert(source === 'camera' ? 'The camera did not open. Choose a photo instead.' : 'That photo could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.note}>Use good lighting. Showcase the best photo of the food, and capture the heart of the cooking space, truck, cart, event space, or farmers table.</Text>
      <View style={styles.row}>
        {value ? (
          food ? <FoodImage source={{ uri: value }} style={styles.preview} /> : <Image source={{ uri: value }} style={styles.preview} />
        ) : <View style={styles.preview} />}
        <View style={styles.actions}>
          <GlassPressable style={styles.button} onPress={() => choose('camera')} disabled={busy} testID={testID ? `${testID}-camera` : undefined}>
            <Text style={styles.buttonText}>{busy ? 'Opening…' : 'Take photo'}</Text>
          </GlassPressable>
          <GlassPressable style={styles.button} onPress={() => choose('library')} disabled={busy} testID={testID ? `${testID}-library` : undefined}>
            <Text style={styles.buttonText}>Choose photo</Text>
          </GlassPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { color: Colors.gray[800], fontWeight: '700', marginBottom: 4 },
  note: { color: Colors.gray[600], lineHeight: 20, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  preview: {
    ...glassSurface,
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: Colors.gray[200],
  },
  actions: { flex: 1, gap: 8 },
  button: {
    ...glassSurface,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: { color: Colors.gray[900], fontWeight: '700' },
});
