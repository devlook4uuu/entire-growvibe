import React from "react";
import Svg, { Path } from "react-native-svg";

export default function CircleArrow({size, color, strokeWidth}) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M11.1188 2.99805C6.55944 3.45084 2.99854 7.29857 2.99854 11.9782C2.99854 16.9624 7.03806 21.0029 12.0211 21.0029C16.6995 21.0029 20.5464 17.4412 20.9991 12.8807"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
      <Path
        d="M20.5576 3.4943L11.0483 13.0595M20.5576 3.4943C20.0635 2.99954 16.7351 3.04566 16.0315 3.05567M20.5576 3.4943C21.0517 3.98905 21.0056 7.32199 20.9956 8.0266"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
    </Svg>
  );
}
