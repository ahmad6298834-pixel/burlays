import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../AuthContext";
import { ApiError, fetchOrder, markOrderDelivered } from "../api";
import { formatCurrency, formatDate, formatTime, statusColor } from "../format";
import type { Order } from "../types";

export default function OrderDetailScreen({
  orderId,
  onBack,
  onUpdated,
}: {
  orderId: number;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      // Opening the order only fetches its details — it never changes the status.
      const data = await fetchOrder(token, orderId);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load order.");
    }
  }, [token, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDeliver = () => {
    Alert.alert(
      "Mark as Delivered?",
      "This will confirm the delivery and update your earnings. This cannot be undone from the app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Mark Delivered", style: "default", onPress: doDeliver },
      ]
    );
  };

  const doDeliver = async () => {
    if (!token || !order) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await markOrderDelivered(token, order.id);
      setOrder(updated);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) {
    return (
      <View style={styles.centered}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!error && <Text style={styles.meta}>Loading order...</Text>}
      </View>
    );
  }

  const colors = statusColor(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back to My Orders</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{order.status}</Text>
          </View>
        </View>

        <Row label="Customer" value={order.customerName} />
        {!!order.customerPhone && <Row label="Phone" value={order.customerPhone} />}
        <Row label="Location" value={order.locationName} />
        <Row label="Delivery Charge" value={formatCurrency(order.deliveryCharge)} />
        <Row label="Total Bill" value={formatCurrency(order.totalBill)} />
        <Row label="Payment Method" value={order.paymentMethod} />
        <Row label="Order Date" value={formatDate(order.orderDate)} />
        <Row label="Order Time" value={formatTime(order.orderTime)} />
        {order.status === "Delivered" && (
          <Row label="Delivered At" value={`${formatDate(order.deliveredDate)} ${formatTime(order.deliveredTime)}`} />
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {order.status === "Assigned" && (
        <TouchableOpacity
          style={[styles.deliverBtn, submitting && styles.disabledBtn]}
          onPress={confirmDeliver}
          disabled={submitting}
        >
          <Text style={styles.deliverText}>{submitting ? "Updating..." : "✅ Mark as Delivered"}</Text>
        </TouchableOpacity>
      )}

      {order.status === "Delivered" && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>This order has already been delivered.</Text>
        </View>
      )}

      {order.status === "Cancelled" && (
        <View style={[styles.infoBanner, { backgroundColor: "#ffe4e6" }]}>
          <Text style={[styles.infoBannerText, { color: "#be123c" }]}>This order was cancelled by admin.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  backBtn: { marginBottom: 14 },
  backText: { color: "#4f46e5", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e2e8f0" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  orderNumber: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowLabel: { color: "#64748b", fontSize: 13 },
  rowValue: { color: "#0f172a", fontSize: 14, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  error: { color: "#dc2626", fontSize: 13, marginTop: 14, textAlign: "center" },
  meta: { color: "#94a3b8" },
  deliverBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  disabledBtn: { opacity: 0.6 },
  deliverText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  infoBanner: { backgroundColor: "#d1fae5", borderRadius: 12, padding: 14, marginTop: 20 },
  infoBannerText: { color: "#047857", textAlign: "center", fontWeight: "600" },
});
