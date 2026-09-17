"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency, formatDate, formatTime, statusBadgeClasses } from "@/utils/format";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type { Rider, RestaurantOrderListRow, RestaurantOrderType } from "@/types";

type Tab = "all" | "delivery" | "dine-in" | "takeaway";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "delivery", label: "Delivery / Assignment" },
  { key: "dine-in", label: "Dine-In" },
  { key: "takeaway", label: "Takeaway" },
];

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState<RestaurantOrderListRow[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<RestaurantOrderListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    setNotice("");
    fetch("/api/restaurant/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then((d: (Rider & { active: boolean })[]) => setRiders(d.filter((r) => r.active)));
    load();
    // Keep the list live as riders deliver orders from the mobile app.
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, []);

  /** Assign or re-assign the rider; the backend moves the linked delivery order. */
  const assignRider = async (orderId: number, riderId: string) => {
    setError("");
    const res = await fetch(`/api/restaurant/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId: riderId ? Number(riderId) : null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update rider");
      return;
    }
    load(true);
  };

  /** Deletes the order via the backend and removes it from the listing. */
  const deleteOrder = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/restaurant/orders/${confirmDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to delete order.");
      setDeleting(false);
      setConfirmDelete(null);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== confirmDelete.id));
    setNotice("Order deleted successfully.");
    setDeleting(false);
    setConfirmDelete(null);
  };

  const visible = orders.filter((o) => tab === "all" || o.orderType === tab);

  return (
    <div>
      <PageHeader
        title={`${RESTAURANT_NAME} — Orders`}
        subtitle="Delivery orders flow into the existing rider assignment workflow. Dine-in and takeaway never reach riders."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading orders...</p>}
      {!loading && visible.length === 0 && <EmptyState message="No orders found for this filter." />}

      <div className="space-y-3">
        {visible.map((o) => {
          const isDelivery = o.orderType === "delivery";
          return (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{o.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(o.orderDate)} · {formatTime(o.orderTime)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      isDelivery
                        ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border border-slate-200 bg-slate-100 text-slate-700"
                    }
                  >
                    {ORDER_TYPE_LABELS[o.orderType as RestaurantOrderType] ?? o.orderType}
                  </Badge>
                  {/* Delivery orders show the live status of their linked delivery record. */}
                  {isDelivery && o.deliveryStatus && (
                    <Badge className={statusBadgeClasses(o.deliveryStatus)}>{o.deliveryStatus}</Badge>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {/* Customer details are meaningless for dine-in, so they are hidden. */}
                {o.customerName && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Customer</dt>
                    <dd className="font-medium text-slate-900">{o.customerName}</dd>
                    {o.customerPhone && <dd className="text-xs text-slate-500">{o.customerPhone}</dd>}
                  </div>
                )}
                {isDelivery && o.locationName && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
                    <dd className="text-slate-800">{o.locationName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Food Total</dt>
                  <dd className="font-medium text-slate-900">{formatCurrency(o.subtotal)}</dd>
                </div>
                {isDelivery && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Customer Delivery Charge</dt>
                    <dd className="font-medium text-slate-900">{formatCurrency(o.customerDeliveryCharge)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    Customer Total · {o.paymentMethod}
                  </dt>
                  <dd className="font-bold text-slate-900">{formatCurrency(o.total)}</dd>
                </div>
                {isDelivery && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Rider Delivery Earning</dt>
                    <dd className="font-medium text-amber-700">{formatCurrency(o.riderDeliveryEarning)}</dd>
                    <dd className="text-[11px] text-slate-400">Internal — not on customer receipt</dd>
                  </div>
                )}
              </dl>

              {/* Rider assignment is only ever offered for delivery orders. */}
              {isDelivery && (
                <div className="mt-3">
                  <Label>Assigned Rider</Label>
                  <Select value={o.riderId ? String(o.riderId) : ""} onChange={(e) => assignRider(o.id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-slate-400">
                    Changing the rider moves the order and notifies the new rider.
                  </p>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link href={`/restaurant/orders/${o.id}/edit`} className="contents">
                  <Button variant="secondary" className="w-full">
                    ✏️ Update
                  </Button>
                </Link>
                <Link href={`/restaurant/orders/${o.id}/receipt`} className="contents">
                  <Button variant="secondary" className="w-full">
                    🧾 Receipt
                  </Button>
                </Link>
                <Link href={`/restaurant/orders/${o.id}/kitchen`} className="contents">
                  <Button variant="secondary" className="w-full">
                    👨‍🍳 Kitchen
                  </Button>
                </Link>
              </div>

              <div className="mt-2">
                <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(o)}>
                  🗑️ Delete Order
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-slate-900">Delete order?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Are you sure you want to delete this order?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {confirmDelete.orderNumber}
              {confirmDelete.customerName ? ` · ${confirmDelete.customerName}` : ""}
              {" — this cannot be undone."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(null);
                  setDeleting(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" disabled={deleting} onClick={deleteOrder}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
