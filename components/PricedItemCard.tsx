import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FoodImage } from '@/components/FoodImage';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';

type PricedItemCardProps = {
  image?: string;
  title: string;
  meta?: string;
  price: string;
  priceColor?: string;
  onPress?: () => void;
  testID?: string;
};

export function PricedItemCard({
  image,
  title,
  meta,
  price,
  priceColor = '#166534',
  onPress,
  testID,
}: PricedItemCardProps) {
  const body = (
    <>
      {image ? <FoodImage source={{ uri: image }} style={styles.image} /> : null}
      <View style={styles.copy}>
        <Text style={styles.name}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <Text style={[styles.price, { color: priceColor }]}>{price}</Text>
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.card} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <GlassPressable style={styles.card} onPress={onPress} testID={testID}>
      {body}
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassSurface,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
  },
  image: {
    ...glassSurface,
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: Colors.gray[200],
  },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  price: { fontWeight: '700', marginTop: 6 },
});
