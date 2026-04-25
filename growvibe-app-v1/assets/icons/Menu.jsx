import Svg, { Path } from "react-native-svg";

export default function Menu({color,size,strokeWidth}) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
    >
      <Path
        d="M20 12L10 12"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
      <Path
        d="M20 5L4 5"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
      <Path
        d="M20 19L4 19"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></Path>
    </Svg>
  );
}
