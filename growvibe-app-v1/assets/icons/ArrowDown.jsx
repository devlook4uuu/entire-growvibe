import React from "react";
import Svg, { Path } from "react-native-svg";

export default function ArrowDown({ size, color, strokeWidth = "2" }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 5V19M12 19L19 12M12 19L5 12"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
}

