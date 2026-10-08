import React, { createContext, useContext } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type PressState = { pressed: boolean; hovered?: boolean };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const springIn = { damping: 14, stiffness: 420, mass: 0.35 };
const springOut = { damping: 7, stiffness: 260, mass: 0.45 };

/** Same floating glass edge used on the sign-in card and gold button. */
export const glassSurface = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.36)',
  shadowColor: '#461C06',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 14,
  elevation: 5,
} satisfies ViewStyle;

const BounceContext = createContext<SharedValue<number> | null>(null);

function useGlassBounce() {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const pressIn = () => {
    pressed.value = 1;
    scale.value = withSpring(0.94, springIn);
    lift.value = withSpring(4, springIn);
  };
  const pressOut = () => {
    pressed.value = 0;
    scale.value = withSpring(hovered.value ? 1.03 : 1, springOut);
    lift.value = withSpring(hovered.value ? -4 : 0, springOut);
  };
  const hoverIn = () => {
    hovered.value = 1;
    if (pressed.value === 0) {
      scale.value = withSpring(1.03, springOut);
      lift.value = withSpring(-4, springOut);
    }
  };
  const hoverOut = () => {
    hovered.value = 0;
    if (pressed.value === 0) {
      scale.value = withSpring(1, springOut);
      lift.value = withSpring(0, springOut);
    }
  };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  return { animStyle, pressIn, pressOut, hoverIn, hoverOut, pressed };
}

/** Same press and hover lift used on the sign-in buttons. */
export function glassLift(state: PressState): ViewStyle {
  const hovered = Boolean(state.hovered);
  return {
    transform: [
      { translateY: state.pressed ? 4 : hovered ? -4 : 0 },
      { scale: state.pressed ? 0.94 : hovered ? 1.03 : 1 },
    ],
  };
}

type GlassPressableProps = PressableProps & { activeOpacity?: number };

export function GlassPressable({
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  activeOpacity: _activeOpacity,
  children,
  ...rest
}: GlassPressableProps) {
  const bounce = useGlassBounce();
  const flatStyle = typeof style === 'function' ? style({ pressed: false, hovered: false }) : style;

  return (
    <BounceContext.Provider value={bounce.pressed}>
      <AnimatedPressable
        accessibilityRole="button"
        {...rest}
        onPressIn={(event) => {
          bounce.pressIn();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          bounce.pressOut();
          onPressOut?.(event);
        }}
        onHoverIn={(event) => {
          bounce.hoverIn();
          onHoverIn?.(event);
        }}
        onHoverOut={(event) => {
          bounce.hoverOut();
          onHoverOut?.(event);
        }}
        style={[flatStyle, bounce.animStyle]}
      >
        {children}
      </AnimatedPressable>
    </BounceContext.Provider>
  );
}

export function GlassIconButton({
  onPress,
  children,
  testID,
  accessibilityLabel,
  tint = 'rgba(255,255,255,0.18)',
}: {
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  tint?: string;
}) {
  return (
    <GlassPressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.icon, { backgroundColor: tint }]}
    >
      {children}
    </GlassPressable>
  );
}

/** Count bubble that pops when the surrounding button is pressed. */
export function GlassBadge({
  children,
  style,
  testID,
  popKey,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  popKey?: string | number | boolean;
}) {
  const parentPressed = useContext(BounceContext);
  const idle = useSharedValue(0);
  const source = parentPressed ?? idle;
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => source.value,
    (current, previous) => {
      if (current > 0 && (previous ?? 0) === 0) {
        scale.value = withSequence(
          withTiming(1.22, { duration: 80 }),
          withSpring(1, springOut),
        );
      }
    },
  );

  useAnimatedReaction(
    () => String(popKey ?? ''),
    (current, previous) => {
      if (previous !== null && current !== previous) {
        scale.value = withSequence(
          withTiming(1.22, { duration: 80 }),
          withSpring(1, springOut),
        );
      }
    },
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View testID={testID} style={[styles.badge, style, animStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...glassSurface,
  },
  badge: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
});
