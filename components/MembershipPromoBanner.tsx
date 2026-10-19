import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { GlassPressable } from '@/components/glass-surface';
interface MembershipPromoBannerProps {
  userLocation?: string | null;
  membershipTier?: 'free' | 'premium';
  audience?: 'platetaker' | 'platemaker';
  onPress?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const MembershipPromoBanner: React.FC<MembershipPromoBannerProps> = ({
  membershipTier = 'free',
  audience = 'platetaker',
  onPress,
  dismissible = false,
  onDismiss,
}) => {
  // Only show banner for free tier users
  if (membershipTier !== 'free') {
    return null;
  }

  const story = audience === 'platemaker'
    ? {
        title: 'Your Cook Path',
        message: 'Home, FarmGrownBasket, MealPrepGo, Catering, FoodTruckPopup, and a Restaurant.',
      }
    : {
        title: 'Where You Can Eat',
        message: 'Home Kitchens, FarmGrownBasket, MealPrepGo, Catering, FoodTruckPopup, and SitDownDelicious.',
      };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/membership-access');
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <View style={styles.container}>
      <GlassPressable
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
                <Text style={styles.title}>{story.title}</Text>
                {dismissible && (
                  <GlassPressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDismiss();
                    }}
                    style={styles.dismissButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={Colors.white} />
                  </GlassPressable>
                )}
              </View>
              <Text style={styles.message}>{story.message}</Text>
              <Text style={styles.cta}>Tap to learn more →</Text>
            </View>
          </View>
        </LinearGradient>
      </GlassPressable>
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
