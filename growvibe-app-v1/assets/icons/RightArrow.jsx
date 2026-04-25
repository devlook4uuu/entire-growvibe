import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

export default function RightArrow({className,color,strokeWidth = "2"}) {
  return (
    <View className={className}>
    <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#fff" fill="none">
    <Path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke={color} strokeWidth={strokeWidth} stroke-linecap="round" stroke-linejoin="round" />
</Svg>
    </View>
  )
}