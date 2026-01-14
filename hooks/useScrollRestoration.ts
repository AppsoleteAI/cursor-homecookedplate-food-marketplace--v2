import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

const positions = new Map<string, { x: number; y: number }>();

export default function useScrollRestoration(key: string, ref: React.RefObject<ScrollView | null>) {
  const keyRef = useRef<string>(key);

  useFocusEffect(
    useCallback(() => {
      const pos = positions.get(keyRef.current);
      if (ref.current && pos) {
        ref.current.scrollTo({ x: pos.x, y: pos.y, animated: false });
      }
      return () => {};
    }, [ref])
  );

  const onScroll = useCallback((x: number, y: number) => {
    positions.set(keyRef.current, { x, y });
  }, []);

  useEffect(() => {
    return () => {};
  }, []);

  return { onScroll } as const;
}
