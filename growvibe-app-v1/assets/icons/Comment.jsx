import { View, Text } from "react-native";
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function Comment({ size, color, strokeWidth }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M2 10.5C2 5.5 6 3 12 3C18 3 22 5.5 22 10.5C22 15.5 18 18 12 18V21C12 21 2 18 2 10.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
      <Path
        d="M8 8.5H16M8 12.5H12"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
    </Svg>
  );
}
