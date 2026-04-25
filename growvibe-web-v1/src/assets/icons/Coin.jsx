export default function Coin({ size = 24, color = "currentColor", strokeWidth = 1.5 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 9.94C14.79 8.81 13.5 7.97 12 7.97C10.34 7.97 9 8.97 9 10.19C9 11.41 10.34 12.41 12 12.41C13.66 12.41 15 13.41 15 14.63C15 15.85 13.66 16.85 12 16.85C10.5 16.85 9.21 16.01 9 14.88"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.5V7.97M12 16.85V18.32"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
