import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { BaseColor, Colors, monoGradients } from '@/constants/colors';

interface StarRatingProps {
  value: number;
  onChange?: (next: number) => void;
  max?: number;
  size?: number;
  baseColor?: BaseColor;
  testID?: string;
  disabled?: boolean;
}

function StarRatingBase({ value, onChange, max = 5, size = 24, baseColor = 'yellow', testID, disabled = false }: StarRatingProps) {
  const color = monoGradients[baseColor][0];

  const handlePress = useCallback((idx: number) => {
    if (disabled) return;
    if (onChange) onChange(idx + 1);
  }, [onChange, disabled]);

  return (
    <View style={styles.row} testID={testID ?? 'star-rating'}>
      {Array.from({ length: max }).map((_, idx) => {
        const filled = idx < value;
        return (
          <TouchableOpacity
            key={idx}
            onPress={() => handlePress(idx)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${idx + 1} star`}
            disabled={disabled}
            style={styles.starWrap}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={`star-${idx + 1}`}
          >
            <Star
              size={size}
              color={filled ? color : Colors.gray[300]}
              fill={filled ? color : 'transparent'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const StarRating = memo(StarRatingBase);
export default StarRating;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starWrap: {
    marginRight: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
