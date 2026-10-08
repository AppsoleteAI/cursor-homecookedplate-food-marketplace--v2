import React from 'react';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from '@/lib/expo-video';
import { youtubeVideoId } from '@/lib/food-review-clips';
import { GlassPressable, glassSurface } from '@/components/glass-surface';

type FoodReviewPlayerProps = {
  uri: string;
  posterUri?: string;
  width: number;
  height: number;
};

export function FoodReviewPlayer({ uri, posterUri, width, height }: FoodReviewPlayerProps) {
  const youtubeId = youtubeVideoId(uri);
  const player = useVideoPlayer(Platform.OS === 'web' || youtubeId ? '' : uri, (instance) => {
    if (instance && Platform.OS !== 'web' && !youtubeId) {
      instance.loop = true;
    }
  });

  if (youtubeId) {
    return (
      <GlassPressable
        style={[styles.frame, { width, height }]}
        testID="food-review-player"
        accessibilityRole="button"
        accessibilityLabel="Play clip"
        onPress={() => Linking.openURL(uri)}
      >
        <View style={styles.clip}>
          {posterUri ? <Image source={{ uri: posterUri }} style={styles.video} resizeMode="cover" /> : null}
        </View>
      </GlassPressable>
    );
  }

  if (Platform.OS === 'web' || !VideoView) {
    return <View style={[styles.frame, { width, height }]} />;
  }

  return (
    <View style={[styles.frame, { width, height }]} testID="food-review-player">
      <View style={styles.clip}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    ...glassSurface,
  },
  clip: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
