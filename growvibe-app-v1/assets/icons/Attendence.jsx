import Svg, { Path } from "react-native-svg";

export default function Attendence({ size, color, strokeWidth }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 10.7614 7.23858 13 10 13C12.7614 13 15 10.7614 15 8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Path
        d="M3 20C3 16.134 6.13401 13 10 13C11.9587 13 13.7295 13.8045 15 15.101"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Path
        d="M13 18.5C13 18.5 14.3485 19.0067 15 21C15 21 18.1765 16 21 15"
        stroke={color}
        strokeWidth={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
}
