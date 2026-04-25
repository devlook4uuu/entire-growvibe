import React from "react";
import Svg, { Path } from "react-native-svg";

export default function Search({ size, color, strokeWidth }) {
  return (
    <Svg  viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M17 17L21 21"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
      <Path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
    </Svg>
  );
}
