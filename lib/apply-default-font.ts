import React from 'react';
import * as ReactNative from 'react-native';
import { preAppFont } from '@/constants/auth-palette';

/**
 * Installed once from index.js, before Expo Router loads any screen.
 * app/_layout.tsx imports this file again so a screen added later still
 * inherits the face if it is loaded through that layout.
 * An explicit fontFamily on a style still wins, which keeps the wordmark in Georgia.
 *
 * The public Text export is not replaceable, so this patches the component
 * that screens already import. New screens get the face without a fontFamily.
 */
const { StyleSheet } = ReactNative;
const baseStyle = StyleSheet.create({ text: preAppFont }).text;

type RenderFn = (this: unknown, props: { style?: unknown } | null, ref: unknown) => unknown;

type FontComponent = {
  render?: RenderFn;
  __hcpFont?: boolean;
};

type FontHost = {
  Text: FontComponent;
  TextInput: FontComponent;
};

function patchRender(Component: FontComponent) {
  const original = Component.render;
  if (typeof original !== 'function' || Component.__hcpFont) return false;
  const patched: RenderFn = function (this: unknown, props, ref) {
    return original.call(this, {
      ...(props ?? {}),
      style: [baseStyle, props?.style],
    }, ref);
  };
  Component.render = patched;
  Component.__hcpFont = true;
  return true;
}

function install(host: FontHost, key: 'Text' | 'TextInput') {
  const current = host[key];
  if (patchRender(current)) return;
  const Wrapped = React.forwardRef((props: { style?: unknown }, ref: React.Ref<unknown>) =>
    React.createElement(current as React.ComponentType<{ style?: unknown; ref?: unknown }>, {
      ...props,
      ref,
      style: [baseStyle, props.style],
    }),
  );
  Wrapped.displayName = `PreApp${key}`;
  try {
    Object.defineProperty(host, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: Wrapped,
    });
  } catch {
    // The running platform already uses this face as its system font.
  }
}

// iOS already uses San Francisco and Android already uses Roboto.
// The web stack is the only face this patch has to install.
if (ReactNative.Platform.OS === 'web') {
  install(ReactNative as unknown as FontHost, 'Text');
  install(ReactNative as unknown as FontHost, 'TextInput');
}
