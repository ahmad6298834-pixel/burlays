import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../AuthContext";
import { fetchMyOrders } from "../api";
import { formatCurrency, formatDate, statusColor } from "../format";
import type { Order } from "../types";

const TABS = [
  { key: "Assigned", label: "Assigned" },
  { key: "Delivered", label: "Delivered" },
  { key: "Cancelled", label: "Cancelled" },
] as const;

export default function MyOrdersScreen({ onOpenOrder }: { onOpenOrder: (orderId: number) => void }) {
  const { token, logout } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("Assigned");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (status: string, silent = false) => {
      if (!token) return;
      try {
        const list = await fetchMyOrders(token, status);
        setOrders(list);
      } catch {
        await logout();
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [token, logout]
  );

  useEffect(() => {
    setLoading(true);
    load(tab);
  }, [tab, load]);

  // Auto-refresh so a newly assigned order (or admin edit) appears without the rider
  // needing to manually pull-to-refresh.
  useEffect(() => {
    const interval = setInterval(() => load(tab, true), 8000);
    return () => clearInterval(interval);
  }, [tab, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(tab);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading && orders.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No {tab.toLowerCase()} orders.</Text>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const colors = statusColor(item.status);
          return (
            <TouchableOpacity style={styles.card} onPress={() => onOpenOrder(item.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.customer}>{item.customerName}</Text>
              {!!item.customerPhone && <Text style={styles.meta}>📞 {item.customerPhone}</Text>}
              <Text style={styles.meta}>📍 {item.locationName}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>{formatDate(item.orderDate)}</Text>
                <Text style={styles.bill}>{formatCurrency(item.totalBill)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  tabRow: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 12, paddingTop: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  tabActive: { backgroundColor: "#eef2ff" },
  tabText: { color: "#64748b", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#4338ca" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderNumber: { fontWeight: "700", color: "#0f172a", fontSize: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  customer: { fontSize: 15, color: "#1e293b", fontWeight: "600" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, alignItems: "center" },
  bill: { fontWeight: "700", color: "#0f172a", fontSize: 15 },
});
