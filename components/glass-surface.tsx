import React, { createContext, useContext } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { goldButtonColors, maroonButtonColors } from '@/constants/auth-palette';
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

/** Light caught on the top of a gold card, matching the top of the $4.99 button. */
export function GlassTop() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.72)', 'rgba(246,204,62,0.38)', 'rgba(240,192,72,0)']}
      locations={[0, 0.42, 1]}
      style={styles.glassTop}
    />
  );
}

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
  const shade = useSharedValue(0);
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const pressIn = () => {
    pressed.value = 1;
    if (PRESS_SCALE_ON_BUTTON) {
      scale.value = withSpring(0.94, springIn);
      lift.value = withSpring(4, springIn);
      return;
    }
    shade.value = withTiming(1, { duration: 90 });
  };
  const pressOut = () => {
    pressed.value = 0;
    if (PRESS_SCALE_ON_BUTTON) {
      scale.value = withSpring(hovered.value ? 1.03 : 1, springOut);
      lift.value = withSpring(hovered.value ? -4 : 0, springOut);
      return;
    }
    shade.value = withTiming(hovered.value ? 0.45 : 0, { duration: 120 });
  };
  const hoverIn = () => {
    hovered.value = 1;
    if (pressed.value !== 0) return;
    if (PRESS_SCALE_ON_BUTTON) {
      scale.value = withSpring(1.03, springOut);
      lift.value = withSpring(-4, springOut);
      return;
    }
    shade.value = withTiming(0.45, { duration: 90 });
  };
  const hoverOut = () => {
    hovered.value = 0;
    if (pressed.value !== 0) return;
    if (PRESS_SCALE_ON_BUTTON) {
      scale.value = withSpring(1, springOut);
      lift.value = withSpring(0, springOut);
      return;
    }
    shade.value = withTiming(0, { duration: 120 });
  };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: shade.value,
  }));

  return { animStyle, shadeStyle, pressIn, pressOut, hoverIn, hoverOut, pressed };
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

/**
 * false: the painted face stays full size and darkens. The hit box stays still.
 * true: the earlier press, with the scale on the button itself.
 */
const PRESS_SCALE_ON_BUTTON = false;

function pressFaceLayout(style: StyleProp<ViewStyle> | undefined): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  return {
    alignSelf: 'stretch',
    flexGrow: 1,
    minHeight: '100%',
    flexDirection: flat.flexDirection,
    alignItems: flat.alignItems,
    justifyContent: flat.justifyContent,
    flexWrap: flat.flexWrap,
    gap: flat.gap,
    rowGap: flat.rowGap,
    columnGap: flat.columnGap,
    padding: flat.padding,
    paddingHorizontal: flat.paddingHorizontal,
    paddingVertical: flat.paddingVertical,
    paddingTop: flat.paddingTop,
    paddingBottom: flat.paddingBottom,
    paddingLeft: flat.paddingLeft,
    paddingRight: flat.paddingRight,
    borderRadius: flat.borderRadius,
    borderTopLeftRadius: flat.borderTopLeftRadius,
    borderTopRightRadius: flat.borderTopRightRadius,
    borderBottomLeftRadius: flat.borderBottomLeftRadius,
    borderBottomRightRadius: flat.borderBottomRightRadius,
    overflow: 'hidden',
  };
}

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
        style={PRESS_SCALE_ON_BUTTON ? [flatStyle, bounce.animStyle] : [flatStyle, styles.pressBox]}
      >
        {PRESS_SCALE_ON_BUTTON ? children : (
          <View pointerEvents="box-none" style={pressFaceLayout(flatStyle)}>
            {typeof children === 'function' ? children({ pressed: false, hovered: false }) : children}
            <Animated.View pointerEvents="none" style={[styles.pressShade, bounce.shadeStyle]} />
          </View>
        )}
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
  size = 36,
  honey = false,
  maroon = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  tint?: string;
  size?: number;
  honey?: boolean;
  maroon?: boolean;
}) {
  const gradient = maroon || honey;
  return (
    <GlassPressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2, backgroundColor: gradient ? 'transparent' : tint, overflow: 'hidden' }]}
    >
      {gradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={[...(maroon ? maroonButtonColors : goldButtonColors)]}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
  pressShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(70, 28, 6, 0.28)',
  },
  pressBox: {
    padding: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  glassTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
  },
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
