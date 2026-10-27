import React from 'react';
import { Ionicons } from '@expo/vector-icons';

/** Ionicons wrapper — use Expo's bundled icon set. */
export function AppIcon({ name, size = 22, color, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/** Bottom tab: solid when focused, outline when inactive (uses navigation tint colors). */
export function tabBarIcon(focusedName, outlineName) {
  return ({ focused, color, size }) => (
    <Ionicons name={focused ? focusedName : outlineName} size={size ?? 24} color={color} />
  );
}
