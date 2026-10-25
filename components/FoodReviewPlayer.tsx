import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from '@/lib/clip-webview';
import { useVideoPlayer, VideoView } from '@/lib/expo-video';
import { clipFrameAllowsNavigation, socialClipEmbed } from '@/lib/food-review-clips';
import { glassSurface } from '@/components/glass-surface';

type FoodReviewPlayerProps = {
  uri: string;
  posterUri?: string;
  width: number;
  height: number;
};

export function FoodReviewPlayer({ uri, width, height }: FoodReviewPlayerProps) {
  const embed = socialClipEmbed(uri, width, height);
  const player = useVideoPlayer(embed.embedUrl ? '' : uri, (instance) => {
    if (instance && !embed.embedUrl) {
      instance.loop = true;
    }
  });

  if (embed.embedUrl) {
    return (
      <View style={[styles.frame, { width, height }]} testID="food-review-player">
        <View style={[styles.clip, embed.letterbox && styles.letterbox]}>
          <WebView
            source={{ uri: embed.embedUrl }}
            style={embed.letterbox ? styles.letterboxVideo : styles.video}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            originWhitelist={['https://*', 'http://*']}
            onShouldStartLoadWithRequest={(request) => clipFrameAllowsNavigation(request.navigationType)}
          />
        </View>
      </View>
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
  letterbox: {
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  letterboxVideo: {
    width: '100%',
    height: '72%',
  },
});
