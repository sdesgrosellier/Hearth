// Round Table mark: nine spheres on a circle seen from just above the table.
// The front sphere (you) is largest; the two beside it are 30% smaller; the rest
// shrink as they curve away. Flat fills so it stays crisp at any size.

import React from "react";
import Svg, { Circle, Ellipse } from "react-native-svg";

const RING: { cx: number; cy: number; r: number; fill: string }[] = [
  { cx: 51.3, cy: -67.7, r: 17, fill: "#B7A8D4" },
  { cx: -51.3, cy: -67.7, r: 17, fill: "#4FB0B5" },
  { cx: 129.9, cy: -36, r: 21, fill: "#F0C29B" },
  { cx: -129.9, cy: -36, r: 21, fill: "#8FB59B" },
  { cx: 147.7, cy: 12.5, r: 27, fill: "#9CC3CF" },
  { cx: -147.7, cy: 12.5, r: 27, fill: "#E8B3AA" },
  { cx: 96.4, cy: 55.2, r: 36, fill: "#8FB59B" },
  { cx: -96.4, cy: 55.2, r: 36, fill: "#F0C29B" },
];

export function Logo({
  width = 120,
  front = "#3E7D91",
  table = false,
}: {
  width?: number;
  /** Color of the front sphere (Harbor by default; white on a Harbor background). */
  front?: string;
  /** Draw the soft table ellipse behind the ring. */
  table?: boolean;
}) {
  const height = Math.round(width * 0.65);
  return (
    <Svg width={width} height={height} viewBox="-200 -130 400 260" accessibilityLabel="Round Table" role="img">
      {table ? <Ellipse cx={0} cy={40} rx={190} ry={78} fill="#E9F1F3" /> : null}
      {RING.map((s, i) => (
        <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />
      ))}
      <Circle cx={0} cy={72} r={52} fill={front} />
    </Svg>
  );
}
