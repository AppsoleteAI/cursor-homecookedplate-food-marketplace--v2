import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageErrorEventData,
  type ImageSourcePropType,
  type ImageStyle,
  type NativeSyntheticEvent,
  type StyleProp,
} from 'react-native';
import { foodCrop } from '@/lib/food-crop';

type FoodImageProps = {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  testID?: string;
  onError?: (event: NativeSyntheticEvent<ImageErrorEventData>) => void;
};

function sourceUri(source: ImageSourcePropType): string | undefined {
  if (typeof source === 'number') {
    return Image.resolveAssetSource(source)?.uri;
  }
  if (Array.isArray(source)) {
    const first = source[0];
    return first && typeof first === 'object' && 'uri' in first ? first.uri : undefined;
  }
  if (source && typeof source === 'object' && 'uri' in source) return source.uri;
  return undefined;
}

/** Crops a food photo so the dish sits in the middle of the frame. */
export function FoodImage({ source, style, accessibilityLabel, testID, onError }: FoodImageProps) {
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const uri = sourceUri(source);
  const crop = foodCrop(natural.w, natural.h, frame.w, frame.h);

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    setNatural({ w: 0, h: 0 });
    Image.getSize(
      uri,
      (width, height) => {
        if (alive) setNatural({ w: width, h: height });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[style, styles.frame]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setFrame((current) => (current.w === width && current.h === height ? current : { w: width, h: height }));
      }}
    >
      <Image
        source={source}
        resizeMode="cover"
        onError={onError}
        style={crop
          ? { position: 'absolute', width: crop.width, height: crop.height, left: crop.left, top: crop.top }
          : StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    position: 'relative',
  },
});
