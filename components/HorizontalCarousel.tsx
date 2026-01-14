import React, { memo, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
  PanResponder,
  GestureResponderEvent,
  Platform,
} from 'react-native';

interface HorizontalCarouselProps {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  testID?: string;
  enableDragScroll?: boolean;
}

function HorizontalCarouselBase({ children, contentContainerStyle, onScroll, testID, enableDragScroll = true }: HorizontalCarouselProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const startXRef = useRef<number>(0);
  const startScrollXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const handleInternalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentXRef.current = e.nativeEvent.contentOffset.x;
    if (onScroll) onScroll(e);
  };

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        startXRef.current = evt.nativeEvent.pageX;
        startScrollXRef.current = currentXRef.current;
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState) => {
        const dx = evt.nativeEvent.pageX - startXRef.current;
        const targetX = startScrollXRef.current - dx;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ x: Math.max(0, targetX), y: 0, animated: false });
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    }),
  []);

  return (
    <View style={styles.container} testID={testID ?? 'horizontal-carousel'} {...(enableDragScroll && Platform.OS === 'web' ? panResponder.panHandlers : {})}>
      <ScrollView
        ref={scrollRef}
        horizontal
        bounces={Platform.OS !== 'web'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        onScroll={handleInternalScroll}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const HorizontalCarousel = memo(HorizontalCarouselBase);
export default HorizontalCarousel;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
});
