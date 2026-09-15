import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../AuthContext";
import { fetchDashboard } from "../api";
import { formatCurrency } from "../format";
import type { RiderDashboard } from "../types";

export default function DashboardScreen() {
  const { token, rider, logout, pushStatus } = useAuth();
  const [data, setData] = useState<RiderDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await fetchDashboard(token);
      setData(d);
    } catch {
      // If the token became invalid (e.g. rider was deactivated), sign out.
      await logout();
    }
  }, [token, logout]);

  useEffect(() => {
    load();
    // Auto-refresh so counts/earnings update as soon as an order status changes,
    // without the rider needing to manually pull-to-refresh.
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{rider?.name ?? "Rider"}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {pushStatus === "denied" && (
        <View style={styles.notifBanner}>
          <Text style={styles.notifBannerText}>
            🔕 Notifications are turned off. Enable them in your phone&apos;s Settings so you don&apos;t miss new
            orders.
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        <StatCard label="Assigned Orders" value={data?.totalAssignedOrders ?? 0} color="#b45309" bg="#fef3c7" />
        <StatCard label="Delivered Orders" value={data?.totalDeliveredOrders ?? 0} color="#047857" bg="#d1fae5" />
        <StatCard label="Pending Orders" value={data?.totalPendingOrders ?? 0} color="#b45309" bg="#fef3c7" />
        <StatCard label="Cancelled" value={data?.totalCancelledOrders ?? 0} color="#be123c" bg="#ffe4e6" />
      </View>

      <Text style={styles.sectionTitle}>Today</Text>
      <View style={styles.grid}>
        <StatCard label="Today's Assigned" value={data?.todayAssignedOrders ?? 0} color="#4338ca" bg="#e0e7ff" />
        <StatCard label="Today's Delivered" value={data?.todayDeliveredOrders ?? 0} color="#047857" bg="#d1fae5" />
      </View>

      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>Today&apos;s Delivery Earnings</Text>
        <Text style={styles.earningsValue}>{formatCurrency(data?.todayDeliveryEarnings)}</Text>
        <View style={styles.divider} />
        <Text style={styles.earningsLabel}>Total Delivery Earnings</Text>
        <Text style={styles.earningsValueSmall}>{formatCurrency(data?.totalDeliveryEarnings)}</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 13, color: "#64748b" },
  name: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fee2e2", borderRadius: 8 },
  logoutText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  notifBanner: { backgroundColor: "#fef3c7", borderRadius: 10, padding: 12, marginBottom: 14 },
  notifBannerText: { color: "#92400e", fontSize: 12, lineHeight: 17 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  statCard: { flexBasis: "47%", borderRadius: 14, padding: 16 },
  statValue: { fontSize: 26, fontWeight: "800" },
  statLabel: { fontSize: 12, color: "#475569", marginTop: 4, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#334155", marginTop: 12, marginBottom: 10 },
  earningsCard: { backgroundColor: "#4f46e5", borderRadius: 16, padding: 20, marginTop: 16 },
  earningsLabel: { color: "#e0e7ff", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  earningsValue: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 },
  earningsValueSmall: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 4 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 14 },
});
