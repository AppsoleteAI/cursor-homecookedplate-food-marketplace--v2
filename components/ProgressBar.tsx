import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';

interface ProgressBarProps {
  progress: number; // 0-1 range
  label: string;
  height?: number;
  showPercentage?: boolean;
  color?: 'green' | 'yellow' | 'orange' | 'red';
  testID?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  height = 24,
  showPercentage = true,
  color = 'green',
  testID,
}) => {
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const percentage = Math.round(clampedProgress * 100);
  
  // Determine color based on progress
  let barColor: 'green' | 'yellow' | 'orange' | 'red' = color;
  if (color === 'green') {
    if (clampedProgress >= 0.9) barColor = 'red';
    else if (clampedProgress >= 0.75) barColor = 'orange';
    else if (clampedProgress >= 0.5) barColor = 'yellow';
  }

  const gradientColors = monoGradients[barColor];

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showPercentage && (
          <Text style={styles.percentage}>{percentage}%</Text>
        )}
      </View>
      <View style={[styles.track, { height }]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${clampedProgress * 100}%` }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray[700],
    flex: 1,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
    marginLeft: 8,
  },
  track: {
    width: '100%',
    backgroundColor: Colors.gray[200],
    borderRadius: 12,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 12,
  },
});
