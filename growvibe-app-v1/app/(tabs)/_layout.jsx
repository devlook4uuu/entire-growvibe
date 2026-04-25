import { Tabs, useRouter } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Chat from "../../assets/icons/Chat";
import Home from "../../assets/icons/Home";
import Profile from "../../assets/icons/Profile";
import Support from "../../assets/icons/Support";
import { ScreenWrapper } from "../../helpers/screenWrapper";
import { Colors } from "../../constant/colors";
import { hp, wp } from "../../helpers/dimension";
import { Fonts } from "../../constant/fonts";


export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <ScreenWrapper style={{ backgroundColor: "white", flex: 1 }}>
        <Tabs
          style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.primary,
            tabBarStyle: {
              backgroundColor: "white",
              paddingHorizontal: hp(1.2),
              paddingTop: hp(2.4),
              paddingBottom: insets.bottom,
              height: Platform.OS === "ios" ? hp(12) : hp(10) + insets.bottom,
              borderTopLeftRadius: hp(2),
              borderTopRightRadius: hp(2),
            },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              tabBarLabel: ({ color }) => (
                <Text
                  style={{
                    color,
                    fontSize: hp(1.3),
                    fontWeight: "500",
                    letterSpacing: -0.4,
                    fontFamily: Fonts.medium,
                  }}
                >
                  Home
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <Home color={color} size={hp(2.9)} strokeWidth={1.6} />
              ),
              tabBarButton: (props) => (
                <TouchableOpacity {...props} activeOpacity={1} />
              ),
            }}
          />

          <Tabs.Screen
            name="chat"
            options={{
              tabBarItemStyle: { marginRight: wp(20) },
              tabBarLabel: ({ color }) => (
                <Text
                  style={{
                    color,
                    fontSize: hp(1.3),
                    fontWeight: "500",
                    letterSpacing: -0.4,
                    fontFamily: Fonts.medium,
                  }}
                >
                  Chat
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <Chat color={color} size={hp(2.9)} strokeWidth={1.6} />
              ),
              tabBarButton: (props) => (
                <TouchableOpacity {...props} activeOpacity={1} />
              ),
            }}
          />

          <Tabs.Screen
            name="support"
            options={{
              tabBarLabel: ({ color }) => (
                <Text
                  style={{
                    color,
                    fontSize: hp(1.3),
                    fontWeight: "500",
                    letterSpacing: -0.4,
                    fontFamily: Fonts.medium,
                  }}
                >
                  Support
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <Support color={color} size={hp(2.9)} strokeWidth={1.6} />
              ),
              tabBarButton: (props) => (
                <TouchableOpacity {...props} activeOpacity={1} />
              ),
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              tabBarLabel: ({ color }) => (
                <Text
                  style={{
                    color,
                    fontWeight: "500",
                    fontSize: hp(1.3),
                    letterSpacing: -0.4,
                    fontFamily: Fonts.medium,
                  }}
                >
                  Profile
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <Profile color={color} size={hp(2.9)} strokeWidth={1.6} />
              ),
              tabBarButton: (props) => (
                <TouchableOpacity {...props} activeOpacity={1} />
              ),
            }}
          />
        </Tabs>

        <Pressable
          onPress={() => {
            try {
              // Navigate to admin profile screen
              router.push({
                pathname: '/profile',
              });
            } catch (error) {
              console.error('Error navigating to admin profile:', error);
              Alert.alert(
                'Navigation Error',
                'Unable to open admin profile. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            position: "absolute",
            bottom: Platform.OS === "ios" ? hp(8) : hp(5.7) + insets.bottom,
            left: "50%",
            transform: [{ translateX: -hp(4.5) }],
            width: hp(9),
            height: hp(9),
            zIndex: 1000,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
              // borderRadius: hp(4.5),
              // backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            {/* <Image
              transition={500}
              cachePolicy={"disk"}
              contentFit="cover"
              style={{ 
                width: hp(10), 
                height: hp(10), 
                // borderRadius: hp(4.5),
              }}
              source={require("../../assets/images/growvibe-light.png")}
              pointerEvents="none"
            /> */}
          </View>
        </Pressable>
      </ScreenWrapper>
    </View>
  );
}