import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
interface MembershipPromoBannerProps {
  userLocation?: string | null;
  membershipTier?: 'free' | 'premium';
  onPress?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const MembershipPromoBanner: React.FC<MembershipPromoBannerProps> = ({
  userLocation,
  membershipTier = 'free',
  onPress,
  dismissible = false,
  onDismiss,
}) => {
  // Only show banner for free tier users
  if (membershipTier !== 'free') {
    return null;
  }

  // userLocation should be the metro_area from profile (locked at signup)
  // Only show if metro area is set
  if (!userLocation) {
    return null;
  }

  const matchedMetro = userLocation;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/membership');
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.touchable}
      >
        <LinearGradient
          colors={monoGradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Ionicons name="star" size={20} color={Colors.white} />
                <Text style={styles.title}>Limited Time Offer</Text>
                {dismissible && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDismiss();
                    }}
                    style={styles.dismissButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={Colors.white} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.message}>
                You are in {matchedMetro}! You may be eligible for 3 months FREE.
              </Text>
              <Text style={styles.cta}>Tap to learn more →</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  touchable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
    lineHeight: 20,
  },
  cta: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.white,
    opacity: 0.9,
  },
});
