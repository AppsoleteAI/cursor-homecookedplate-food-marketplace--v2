import React from 'react';
import { View, type ViewProps } from 'react-native';

/** Web plays a social clip in an iframe. This shim keeps the native view off the website bundle. */
export function WebView(_props: ViewProps & { source?: { uri?: string } }) {
  return React.createElement(View, null);
}
