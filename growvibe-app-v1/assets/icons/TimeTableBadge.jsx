import Svg, { Rect } from "react-native-svg";

export default function TimeTableBadge({ size, color, strokeWidth }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 9 10"
      fill="none"
    >
      <Rect
        x="1.12179"
        y="1.46799"
        width="6.73077"
        height="6.73077"
        rx="3.36538"
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
