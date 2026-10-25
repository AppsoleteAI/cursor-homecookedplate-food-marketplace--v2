import React from 'react';
import { View } from 'react-native';
import { socialClipEmbed } from '@/lib/food-review-clips';
import { glassSurface } from '@/components/glass-surface';

type FoodReviewPlayerProps = {
  uri: string;
  posterUri?: string;
  width: number;
  height: number;
};

export function FoodReviewPlayer({ uri, posterUri, width, height }: FoodReviewPlayerProps) {
  const embed = socialClipEmbed(uri, width, height);
  return (
    <View testID="food-review-player" style={[{ width, height, borderRadius: 16 }, glassSurface]}>
      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000', justifyContent: 'center' }}>
        {embed.embedUrl
          ? React.createElement('iframe', {
              src: embed.embedUrl,
              title: 'Food review clip',
              sandbox: 'allow-scripts allow-same-origin allow-presentation',
              allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
              allowFullScreen: true,
              style: {
                width: '100%',
                height: embed.letterbox ? '72%' : '100%',
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
