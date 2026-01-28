import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
/* eslint-disable import/no-unresolved */
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  Easing,
} from 'react-native-reanimated';
/* eslint-enable import/no-unresolved */
import { Colors } from '@/constants/colors';

/**
 * Branded Loading Splash Screen
 * 
 * Matches the dark gradient theme from the app's splash screen to prevent white flash.
 * Features a pulsing logo animation that creates a premium "cooking/preparing" feel.
 * 
 * CRITICAL: Background colors must match app.json splash.backgroundColor to avoid flash.
 */
export const LoadingSplashScreen: React.FC = () => {
  // Pulse animation for the logo
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Gentle pulse animation (1.0 to 1.05 scale)
    pulseScale.value = withRepeat(
      withTiming(1.05, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite repeat
      true // Reverse
    );

    // Subtle glow pulse
    glowOpacity.value = withRepeat(
      withTiming(0.6, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Dark gradient background matching the app's theme
  // From very dark brown/black (#1A0F0A) to lighter warm dark brown (#2D1B14)
  const gradientColors = ['#1A0F0A', '#2D1B14', '#1A0F0A'];

  return (
    <LinearGradient
      colors={gradientColors}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo Container with Glow Effect */}
        <View style={styles.logoContainer}>
          {/* Glow effect behind logo */}
          <Animated.View style={[styles.glowCircle, animatedGlowStyle]} />
          
          {/* Main Logo */}
          <Animated.View style={[styles.logoWrapper, animatedLogoStyle]}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* App Name with Ellipsis Animation */}
        <View style={styles.textContainer}>
          <Text style={styles.appName}>HomeCookedPlate</Text>
          <Animated.View style={styles.ellipsisContainer}>
            <Text style={styles.ellipsis}>...</Text>
          </Animated.View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gradient.darkGold,
    opacity: 0.3,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logo: {
    width: '100%',
    height: '100%',
    tintColor: Colors.white, // Ensure logo is white
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'sans-serif',
    }),
  },
  ellipsisContainer: {
    marginLeft: 4,
  },
  ellipsis: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    opacity: 0.8,
  },
});
