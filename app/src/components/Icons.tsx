// Small UI icons (stroke SVG, no emoji): book, settings, mic, speaker, back, send.

import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function BookIcon({ size = 20, color = "#3E7D91", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="My Story" role="img">
      <Path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 19a2 2 0 0 1 2-2h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsIcon({ size = 20, color = "#3E7D91", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Settings" role="img">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MicIcon({ size = 20, color = "#3E7D91", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Microphone" role="img">
      <Path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M19 11a7 7 0 0 1-14 0M12 18v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function StopIcon({ size = 20, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Stop" role="img">
      <Path d="M7 7h10v10H7z" fill={color} />
    </Svg>
  );
}

export function SpeakerIcon({ size = 20, color = "#3E7D91", strokeWidth = 2, on = true }: IconProps & { on?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel={on ? "Sound on" : "Sound off"} role="img">
      <Path d="M11 5L6 9H2v6h4l5 4V5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {on ? (
        <Path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      ) : (
        <Path d="M16 9l5 6M21 9l-5 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function BackIcon({ size = 22, color = "#223642", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Back" role="img">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ size = 20, color = "#FFFFFF", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Send" role="img">
      <Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
