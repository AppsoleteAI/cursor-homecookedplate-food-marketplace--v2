import React from 'react';
import { Pressable } from 'react-native';

export function GlassPressable({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return <Pressable onPress={onPress}>{children}</Pressable>;
}
