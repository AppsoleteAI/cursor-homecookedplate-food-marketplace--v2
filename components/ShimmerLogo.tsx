import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat,
  Easing 
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

export const ShimmerLogo = ({ children }: { children: React.ReactNode }) => {
  const translateX = useSharedValue(-200); 
  const scale = useSharedValue(1);         

  const runShimmer = () => {
    // Reset to start position before animating
    translateX.value = -200; 
    translateX.value = withTiming(300, {
      duration: 2500, // Slightly faster for interaction feedback
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    });
  };

  useEffect(() => {
    // 1. Initial render shimmer
    runShimmer();

    // 2. Continuous subtle pulse
    // Scales from 1 to 1.03 and back every 4 seconds (2s in, 2s out)
    scale.value = withRepeat(
      withTiming(1.03, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1, // -1 means loop forever
      true // reverse: true creates the "in and out" motion
    );
  }, []);

  // 3. Gesture configuration for the tap
  const tapGesture = Gesture.Tap().onStart(() => {
    runShimmer();
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.container}>
        {/* The Pulsing Logo */}
        <Animated.View style={logoStyle}>
          {children}
        </Animated.View>

        {/* The Shimmer Ripple */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.shimmerWrapper, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            />
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shimmerWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    flex: 1,
    width: 80,
    transform: [{ rotate: '25deg' }], 
  },
});
