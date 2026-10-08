import React from 'react';
import { View } from 'react-native';
import { youtubeEmbedUrl, youtubeVideoId } from '@/lib/food-review-clips';
import { glassSurface } from '@/components/glass-surface';

type FoodReviewPlayerProps = {
  uri: string;
  posterUri?: string;
  width: number;
  height: number;
};

export function FoodReviewPlayer({ uri, posterUri, width, height }: FoodReviewPlayerProps) {
  const youtubeId = youtubeVideoId(uri);
  return (
    <View testID="food-review-player" style={[{ width, height, borderRadius: 16 }, glassSurface]}>
      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' }}>
        {youtubeId
          ? React.createElement('iframe', {
              src: youtubeEmbedUrl(youtubeId),
              title: 'Food review clip',
              allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
              allowFullScreen: true,
              style: {
                width: '100%',
                height: '100%',
                border: 0,
                display: 'block',
                backgroundColor: '#000000',
              },
            })
          : React.createElement('video', {
              src: uri,
              poster: posterUri,
              controls: true,
              playsInline: true,
              loop: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000000',
                display: 'block',
              },
            })}
      </View>
    </View>
  );
}
