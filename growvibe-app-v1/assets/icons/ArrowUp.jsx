import React from "react";
import Svg, { Path } from "react-native-svg";

export default function ArrowUp({ size, color, strokeWidth = "2" }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 19V5M12 5L19 12M12 5L5 12"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
}

