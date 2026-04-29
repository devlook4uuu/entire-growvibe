import { View, Text } from 'react-native'
import React from 'react'
import { ScreenWrapper } from '../../helpers/screenWrapper'
import { Colors } from '../../constant/colors'
import { wp } from '../../helpers/dimension'
import { Fonts } from '../../constant/fonts'

const comingsoon = () => {
    return (
        <ScreenWrapper>
            <View style={{ flex:1, justifyContent:'center', alignItems: 'center', backgroundColor: Colors.white }}>
                <Text style={{ paddingHorizontal: wp(4), paddingVertical: wp(1), fontFamily: Fonts.regular, backgroundColor: Colors.borderLight }}>Coming Soon</Text>
            </View>
        </ScreenWrapper>
    )
}

export default comingsoon