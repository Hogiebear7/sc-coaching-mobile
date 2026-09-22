import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { Color } from "@/constants/theme";

/**
 * The analog clock-face look from the device's own Timer/Stopwatch apps —
 * tick marks around a circle with a single needle, recreated in the app's
 * own navy/gold palette rather than the OS's black/blue. `showNumbers`
 * distinguishes the two references: the Timer face is bare ticks, the
 * Stopwatch face has 5/10/…/60 labels at the majors.
 */
export function TimerDial({
  size = 240,
  progressAngleDeg,
  showNumbers = false,
  color = Color.gold,
}: {
  size?: number;
  /** 0–360, clockwise from 12 o'clock — where the needle points. */
  progressAngleDeg: number;
  showNumbers?: boolean;
  color?: string;
}) {
  const center = size / 2;
  const outerR = size / 2 - 4;
  const tickInnerRMinor = outerR - 8;
  const tickInnerRMajor = outerR - 14;
  const needleLength = outerR - (showNumbers ? 34 : 20);

  function pointOn(radius: number, angleDeg: number): { x: number; y: number } {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  }

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isMajor = i % 5 === 0;
    const angle = (i / 60) * 360;
    const outer = pointOn(outerR, angle);
    const inner = pointOn(isMajor ? tickInnerRMajor : tickInnerRMinor, angle);
    return (
      <Line
        key={i}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={isMajor ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.14)"}
        strokeWidth={isMajor ? 2 : 1}
      />
    );
  });

  const labels = showNumbers
    ? Array.from({ length: 12 }, (_, i) => {
        const value = i === 0 ? 60 : i * 5;
        const angle = (i / 12) * 360;
        const p = pointOn(tickInnerRMajor - 16, angle);
        return (
          <SvgText key={i} x={p.x} y={p.y + 5} fontSize={14} fontWeight="600" fill="rgba(255,255,255,0.45)" textAnchor="middle">
            {value}
          </SvgText>
        );
      })
    : null;

  const needleTip = pointOn(needleLength, progressAngleDeg);

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={outerR} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      {ticks}
      {labels}
      <Line x1={center} y1={center} x2={needleTip.x} y2={needleTip.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={center} cy={center} r={4} fill={color} />
    </Svg>
  );
}
