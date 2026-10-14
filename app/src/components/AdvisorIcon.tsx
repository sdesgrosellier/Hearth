// One family of advisor icons: a sphere (like the logo) with a single white glyph.
// Replaces the emoji everywhere. Glyph paths match the design canvas exactly.

import React from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { getAdvisor } from "@/config/advisors";

const W = "#FFFFFF";

function Glyph({ id }: { id: string }) {
  switch (id) {
    case "mom":
      return (
        <>
          <Path d="M16 30c0-10 7-17 16-17s16 7 16 17" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M19 38c2.5 7 7.5 10 13 10s10.5-3 13-10" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M32 27.5c-1.6-3-6.4-2-5.8 1.6.4 2.4 3.4 4.4 5.8 6.2 2.4-1.8 5.4-3.8 5.8-6.2.6-3.6-4.2-4.6-5.8-1.6z" fill={W} />
        </>
      );
    case "dad":
      return (
        <>
          <Circle cx={23} cy={31} r={6.5} fill="none" stroke={W} strokeWidth={3.2} />
          <Circle cx={41} cy={31} r={6.5} fill="none" stroke={W} strokeWidth={3.2} />
          <Path d="M29.5 31h5M14 29l2.5 1M50 29l-2.5 1" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M25 44c3 3 11 3 14 0" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "grandma":
      return (
        <>
          <Circle cx={32} cy={15} r={6} fill={W} />
          <Path d="M19 27c0-6 5-9 13-9s13 3 13 9" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Circle cx={24} cy={36} r={5} fill="none" stroke={W} strokeWidth={3} />
          <Circle cx={40} cy={36} r={5} fill="none" stroke={W} strokeWidth={3} />
          <Path d="M29 36h6" stroke={W} strokeWidth={3} strokeLinecap="round" />
          <Path d="M26 47c3 2.5 9 2.5 12 0" fill="none" stroke={W} strokeWidth={3} strokeLinecap="round" />
        </>
      );
    case "grandpa":
      return (
        <>
          <Path d="M17 27c1-8 7-13 15-13s14 5 15 13" fill={W} />
          <Path d="M13 29h38" stroke={W} strokeWidth={4} strokeLinecap="round" />
          <Path d="M24 38h4M36 38h4" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M26 46c2 3.5 10 3.5 12 0" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "stranger":
      return (
        <>
          <Path d="M23 25c0-6 4-10 9.5-10S42 19 42 24c0 7-8 7-8 14" fill="none" stroke={W} strokeWidth={3.6} strokeLinecap="round" />
          <Circle cx={34} cy={47} r={2.6} fill={W} />
        </>
      );
    case "kid":
      return (
        <>
          <Path d="M30 20c1-6 5-8 9-7" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Circle cx={25} cy={33} r={2.6} fill={W} />
          <Circle cx={39} cy={33} r={2.6} fill={W} />
          <Circle cx={19} cy={39} r={1.4} fill={W} opacity={0.8} />
          <Circle cx={45} cy={39} r={1.4} fill={W} opacity={0.8} />
          <Path d="M23 42c3 5 15 5 18 0" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "alien":
      return (
        <>
          <Path d="M24 20l-5-9M40 20l5-9" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Circle cx={18} cy={10} r={3} fill={W} />
          <Circle cx={46} cy={10} r={3} fill={W} />
          <Ellipse cx={24.5} cy={34} rx={5} ry={7.5} transform="rotate(-20 24.5 34)" fill={W} />
          <Ellipse cx={39.5} cy={34} rx={5} ry={7.5} transform="rotate(20 39.5 34)" fill={W} />
          <Path d="M28 47h8" stroke={W} strokeWidth={3} strokeLinecap="round" />
        </>
      );
    case "caesar":
      return (
        <>
          <Path d="M14 30c2-8 8-14 18-14s16 6 18 14" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M17 27l3-5M22 22l2-5M27 19l1-5M47 27l-3-5M42 22l-2-5M37 19l-1-5" stroke={W} strokeWidth={3} strokeLinecap="round" />
          <Path d="M25 44c3 2.5 11 2.5 14 0" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M26 36h3M35 36h3" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "napoleon":
      return (
        <>
          <Path d="M11 25c6-8 15-11 21-11s15 3 21 11c-8-2-14-3-21-3s-13 1-21 3z" fill={W} />
          <Path d="M24 38h4M36 38h4" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M26 46c2 2.5 10 2.5 12 0" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "washington":
      return (
        <>
          <Path d="M14 26c4-7 11-10 18-10s14 3 18 10c-4-1-9-1.5-18-1.5S18 25 14 26z" fill={W} />
          <Path d="M19 26c-2 6-1 12 2 16M45 26c2 6 1 12-2 16" fill="none" stroke={W} strokeWidth={3} strokeLinecap="round" />
          <Path d="M43 41c3 2 4 6 2 9" fill="none" stroke={W} strokeWidth={3} strokeLinecap="round" />
          <Path d="M25 38h4M35 38h4" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M27 46h10" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
    case "lincoln":
      return (
        <>
          <Rect x={22} y={6} width={20} height={16} rx={2} fill={W} />
          <Path d="M15 23h34" stroke={W} strokeWidth={4} strokeLinecap="round" />
          <Path d="M25 35h4M35 35h4" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M20 40c2 10 7 15 12 16 5-1 10-6 12-16-3 3-7 4-12 4s-9-1-12-4z" fill={W} />
        </>
      );
    case "elder":
      return (
        <>
          <Path d="M21 36c4-9 13-13 22-12-4 2-6 5-6 9 0 6 4 9 10 9-6 3-13 3-19 0 2-1 3-3 2-6-2-2-6-2-9 0z" fill={W} />
          <Path d="M43 24c2-1 4-1 6 0" stroke={W} strokeWidth={3} strokeLinecap="round" />
          <Path d="M16 46c4 5 10 7 16 7" fill="none" stroke={W} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        </>
      );
    case "biblical":
      return (
        <>
          <Path d="M32 22c-4-3-10-4-16-3v24c6-1 12 0 16 3 4-3 10-4 16-3V19c-6-1-12 0-16 3z" fill="none" stroke={W} strokeWidth={3.2} strokeLinejoin="round" />
          <Path d="M32 22v24" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M21 27c3-.5 6 0 8 1M21 33c3-.5 6 0 8 1M35 28c2-1 5-1.5 8-1M35 34c2-1 5-1.5 8-1" stroke={W} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
        </>
      );
    default:
      return <Circle cx={32} cy={32} r={10} fill={W} />;
  }
}

/** Advisor avatar: accent sphere + white glyph. `size` is the diameter in px. */
export function AdvisorIcon({ id, size = 40, muted = false }: { id: string; size?: number; muted?: boolean }) {
  const advisor = getAdvisor(id);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel={advisor.name} role="img">
      <Circle cx={32} cy={32} r={32} fill={advisor.accent} opacity={muted ? 0.45 : 1} />
      <Glyph id={advisor.id} />
    </Svg>
  );
}

/** The "full circle" glyph: six small spheres around a white one. */
export function FullCircleIcon({ size = 20, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Full circle" role="img">
      {!onDark ? <Circle cx={32} cy={32} r={32} fill="#223642" /> : null}
      <Circle cx={32} cy={14} r={onDark ? 5 : 4} fill="#B7A8D4" />
      <Circle cx={48.5} cy={23} r={onDark ? 5 : 4} fill="#F0C29B" />
      <Circle cx={48.5} cy={41} r={onDark ? 5 : 4} fill="#8FB59B" />
      <Circle cx={32} cy={50} r={onDark ? 6.5 : 5.5} fill="#FFFFFF" />
      <Circle cx={15.5} cy={41} r={onDark ? 5 : 4} fill="#E8B3AA" />
      <Circle cx={15.5} cy={23} r={onDark ? 5 : 4} fill="#4FB0B5" />
    </Svg>
  );
}
