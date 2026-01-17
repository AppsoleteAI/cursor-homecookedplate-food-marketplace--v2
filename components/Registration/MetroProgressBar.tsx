import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { Colors } from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface MetroProgressBarProps {
  metroName: string;
  role: 'platemaker' | 'platetaker';
  refetchInterval?: number; // Optional polling interval in milliseconds
}

export const MetroProgressBar: React.FC<MetroProgressBarProps> = ({
  metroName,
  role,
  refetchInterval = 15000, // Default: 15 seconds
}) => {
  // Query metro availability with polling for live updates
  const { data: availability, isLoading, error } = trpc.metro.getAvailability.useQuery(
    { metroName },
    {
      enabled: !!metroName, // Only query if metroName is provided
      refetchInterval, // Poll for live updates
      refetchOnWindowFocus: true, // Refetch when user returns to the app
    }
  );

  // Handle loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.gradient.orange} />
          <Text style={styles.loadingText}>Loading availability...</Text>
        </View>
      </View>
    );
  }

  // Handle error or metro not found
  if (error || !availability || !availability.found) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {error ? 'Unable to load availability' : 'Metro not available'}
        </Text>
      </View>
    );
  }

  // Determine current count and spots remaining based on role
  const isMaker = role === 'platemaker';
  const currentCount = isMaker ? availability.makerCount : availability.takerCount;
  const spotsLeft = isMaker ? availability.makerSpotsRemaining : availability.takerSpotsRemaining;
  const maxCap = availability.maxCap;

  // Calculate progress (0-1)
  const progress = maxCap > 0 ? Math.min(1, currentCount / maxCap) : 0;

  // Determine color: red when < 10 spots, orange otherwise
  const barColor: 'orange' | 'red' = spotsLeft < 10 ? 'red' : 'orange';

  // Format role name for display
  const roleName = isMaker ? 'PlateMaker' : 'PlateTaker';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {spotsLeft} Early Bird spots left for {roleName}s in {metroName}!
      </Text>
      <ProgressBar
        progress={progress}
        label={`${currentCount} / ${maxCap} spots taken`}
        color={barColor}
        showPercentage={true}
      />
      {spotsLeft === 0 && (
        <Text style={styles.fullText}>All Early Bird spots are taken in this metro.</Text>
      )}
      {spotsLeft > 0 && spotsLeft < 10 && (
        <Text style={styles.warningText}>Hurry! Only {spotsLeft} spots remaining!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 16,
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  fullText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningText: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
});
