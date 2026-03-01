import "../global.css";
import React, { createContext, useCallback, useState } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { EmergencyModal } from "../src/components/EmergencyModal";

interface EmergencyContextValue {
  showEmergency: boolean;
  triggerEmergency: (message: string) => void;
  dismissEmergency: () => void;
}

export const EmergencyContext = createContext<EmergencyContextValue>({
  showEmergency: false,
  triggerEmergency: () => {},
  dismissEmergency: () => {},
});

export default function RootLayout() {
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState("");

  const triggerEmergency = useCallback((msg: string) => {
    setEmergencyMessage(msg);
    setShowEmergency(true);
  }, []);

  const dismissEmergency = useCallback(() => {
    setShowEmergency(false);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <EmergencyContext.Provider
          value={{ showEmergency, triggerEmergency, dismissEmergency }}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="dev-chat" options={{ presentation: "modal" }} />
          </Stack>

          {showEmergency && (
            <EmergencyModal
              message={emergencyMessage}
              onCall={() => dismissEmergency()}
              onDispatch={() => dismissEmergency()}
              onDismiss={dismissEmergency}
            />
          )}
        </EmergencyContext.Provider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
