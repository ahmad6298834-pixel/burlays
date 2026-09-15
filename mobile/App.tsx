import { useEffect, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { API_CONFIG_ERROR } from "./src/config";
import { getOrderIdFromNotification } from "./src/notifications";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import MyOrdersScreen from "./src/screens/MyOrdersScreen";
import OrderDetailScreen from "./src/screens/OrderDetailScreen";

type Tab = "dashboard" | "orders";

/**
 * Shown instead of the Login screen whenever this build has no valid, permanent
 * backend URL configured (e.g. it still points at a temporary dev sandbox, or
 * nothing was configured at all). This prevents confusing raw network errors and
 * makes the real problem obvious immediately when the app is opened.
 */
function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.configError}>
      <Text style={styles.configErrorIcon}>⚠️</Text>
      <Text style={styles.configErrorTitle}>App Not Configured</Text>
      <Text style={styles.configErrorText}>{message}</Text>
    </View>
  );
}

function AuthedApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Tapping a "New Order Ready" push notification opens that order directly — both
  // while the app is backgrounded/foregrounded, and on a cold start from a killed app.
  useEffect(() => {
    const openFromNotification = (data: Record<string, unknown> | undefined) => {
      const orderId = getOrderIdFromNotification(data);
      if (orderId) {
        setTab("orders");
        setSelectedOrderId(orderId);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        openFromNotification(response.notification.request.content.data as Record<string, unknown>);
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => subscription.remove();
  }, []);

  if (selectedOrderId !== null) {
    return (
      <OrderDetailScreen
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "dashboard" ? (
          <DashboardScreen key={`dash-${refreshKey}`} />
        ) : (
          <MyOrdersScreen key={`orders-${refreshKey}`} onOpenOrder={setSelectedOrderId} />
        )}
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab("dashboard")}>
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, tab === "dashboard" && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab("orders")}>
          <Text style={styles.tabIcon}>📦</Text>
          <Text style={[styles.tabLabel, tab === "orders" && styles.tabLabelActive]}>My Orders</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Root() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return token ? <AuthedApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        {API_CONFIG_ERROR ? (
          <ConfigErrorScreen message={API_CONFIG_ERROR} />
        ) : (
          <AuthProvider>
            <Root />
          </AuthProvider>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  configError: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#fef2f2" },
  configErrorIcon: { fontSize: 44, marginBottom: 12 },
  configErrorTitle: { fontSize: 18, fontWeight: "800", color: "#991b1b", marginBottom: 10 },
  configErrorText: { fontSize: 14, color: "#7f1d1d", textAlign: "center", lineHeight: 20 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  tabLabelActive: { color: "#4f46e5" },
});
