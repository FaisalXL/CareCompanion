import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Home, Clock, UserRound } from "lucide-react-native";
import { colors, shadows } from "../../src/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "web" ? 16 : 28,
          left: 24,
          right: 24,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.glass,
          borderTopWidth: 0,
          elevation: 0,
          paddingBottom: 0,
          paddingTop: 0,
          ...shadows.lg,
        },
        tabBarActiveTintColor: colors.sage,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingVertical: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
          tabBarAccessibilityLabel: "Home screen - ambient patient status",
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => <Clock color={color} size={22} />,
          tabBarAccessibilityLabel: "Activity timeline - patient history",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserRound color={color} size={22} />,
          tabBarAccessibilityLabel: "Patient profile and device settings",
        }}
      />
    </Tabs>
  );
}
