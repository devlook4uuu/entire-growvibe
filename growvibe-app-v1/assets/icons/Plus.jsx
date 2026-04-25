import React from "react";
import Svg, { Path } from "react-native-svg";

export default function Plus({ size, color, strokeWidth }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12.001 5.00003V19.002"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Path
        d="M19.002 12.002L4.99998 12.002"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
}
