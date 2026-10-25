import React, { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { chromeIsVisible, pokeChromeActivity, subscribeChromeVisible } from '@/lib/chrome-activity';

export function useChromeVisible(): boolean {
  return useSyncExternalStore(subscribeChromeVisible, chromeIsVisible, chromeIsVisible);
}

/** Hides floating chips after 5 quiet seconds. Scroll, touch, or motion brings them back. */
export function ChromeActivity() {
  React.useEffect(() => {
    pokeChromeActivity();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const poke = () => pokeChromeActivity();
      document.addEventListener('scroll', poke, true);
      window.addEventListener('wheel', poke, { passive: true });
      window.addEventListener('pointermove', poke);
      window.addEventListener('devicemotion', poke);
      return () => {
        document.removeEventListener('scroll', poke, true);
        window.removeEventListener('wheel', poke);
        window.removeEventListener('pointermove', poke);
        window.removeEventListener('devicemotion', poke);
      };
    }
    return undefined;
  }, []);
  return null;
}

export function IdleChrome({ children, overlay = false }: { children: React.ReactNode; overlay?: boolean }) {
  const shown = useChromeVisible();
  return (
    <View
      pointerEvents={shown ? 'box-none' : 'none'}
      style={[overlay ? styles.overlay : styles.hold, shown ? styles.shown : styles.hidden]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hold: { alignSelf: 'flex-start' },
  overlay: { ...StyleSheet.absoluteFillObject },
  shown: { opacity: 1 },
  hidden: { opacity: 0 },
});
