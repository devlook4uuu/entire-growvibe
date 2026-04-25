import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export default function WhiteFadeGradient() {
  return (
    <View className="w-full h-full">
      <Svg width="100%" height="100%" viewBox="0 0 744 566" fill="none">
        <Defs>
          <LinearGradient
            id="paint0_linear_1286_225"
            x1="518.5"
            y1="0"
            x2="518.5"
            y2="574"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0.0382523" stopColor="white" stopOpacity="0" />
            <Stop offset="0.25" stopColor="white" stopOpacity="0.6" />
            <Stop offset="0.346154" stopColor="white" stopOpacity="0.8" />
            <Stop offset="0.490385" stopColor="white" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        <Rect
          x="-96"
          y="0"
          width="10370"
          height="900"
          fill="url(#paint0_linear_1286_225)"
        />
      </Svg>
    </View>
  );
}