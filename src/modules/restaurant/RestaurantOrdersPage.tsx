"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency, formatDate, formatTime, statusBadgeClasses } from "@/utils/format";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type {
  Location,
  PaymentMethod,
  Rider,
  RestaurantOrderFull,
  RestaurantOrderListRow,
  RestaurantOrderType,
} from "@/types";

type Tab = "all" | "delivery" | "dine-in" | "takeaway";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "delivery", label: "Delivery / Assignment" },
  { key: "dine-in", label: "Dine-In" },
  { key: "takeaway", label: "Takeaway" },
];

const paymentBadge = (s: string) =>
  s === "RECEIVED"
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border border-amber-200 bg-amber-50 text-amber-700";

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState<RestaurantOrderListRow[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** id of the row currently running an action — keeps its buttons disabled. */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RestaurantOrderFull | null>(null);
  const [editing, setEditing] = useState<RestaurantOrderFull | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    fetch("/api/restaurant/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(Array.isArray(d) ? d : []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then((d: (Rider & { active: boolean })[]) => setRiders(d.filter((r) => r.active)));
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: Location[]) => setLocations(d.filter((l) => l.active)));
    fetch("/api/restaurant/payment-methods")
      .then((r) => r.json())
      .then((d: PaymentMethod[]) => setPayments(d.filter((m) => m.active)));
    load();
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, []);

  /** Shared mutation helper; disables the row while in flight. */
  const patch = async (orderId: number, body: unknown) => {
    setError("");
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/restaurant/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not update the order");
        return null;
      }
      load(true);
      return await res.json();
    } finally {
      setBusyId(null);
    }
  };

  const verifyPayment = (orderId: number) => patch(orderId, { paymentStatus: "RECEIVED" });

  const removeOrder = async (o: RestaurantOrderListRow) => {
    if (!confirm(`Delete order ${o.orderNumber}?\n\nIt will be removed from the orders list, dashboard totals and sales reports. This cannot be undone.`))
      return;
    setError("");
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/restaurant/orders/${o.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not delete the order");
        return;
      }
      load(true);
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (id: number) => {
    const res = await fetch(`/api/restaurant/orders/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  const openEdit = async (id: number) => {
    const res = await fetch(`/api/restaurant/orders/${id}`);
    if (res.ok) setEditing(await res.json());
  };

  const visible = orders.filter((o) => tab === "all" || o.orderType === tab);

  return (
    <div>
      <PageHeader
        title={`${RESTAURANT_NAME} — Orders`}
        subtitle="Delivery orders flow into the existing rider assignment workflow. Dine-in and takeaway never reach riders."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

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
          const busy = busyId === o.id;
          return (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button onClick={() => openDetail(o.id)} className="min-w-0 text-left">
                  <p className="font-semibold text-slate-900 hover:text-indigo-600">{o.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(o.orderDate)} · {formatTime(o.orderTime)}
                  </p>
                </button>
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
                  <Badge className={paymentBadge(o.paymentStatus)}>
                    {o.paymentStatus === "RECEIVED" ? "Payment Received" : "Payment Pending"}
                  </Badge>
                  {isDelivery && o.deliveryStatus && (
                    <Badge className={statusBadgeClasses(o.deliveryStatus)}>{o.deliveryStatus}</Badge>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
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
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Total · {o.paymentMethod}</dt>
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

              {isDelivery && (
                <div className="mt-3">
                  <Label>Assigned Rider</Label>
                  <Select
                    value={o.riderId ? String(o.riderId) : ""}
                    disabled={busy}
                    onChange={(e) => patch(o.id, { riderId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Unassigned</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Payment must be confirmed explicitly — never automatically on save. */}
              {o.paymentStatus !== "RECEIVED" && (
                <Button className="mt-3 w-full" disabled={busy} onClick={() => verifyPayment(o.id)}>
                  {busy ? "Saving..." : "✅ Payment Received / Verify"}
                </Button>
              )}
              {o.paymentStatus === "RECEIVED" && o.paymentVerifiedAt && (
                <p className="mt-2 text-xs text-emerald-700">
                  Verified by {o.paymentVerifiedBy ?? "admin"} on {formatDate(String(o.paymentVerifiedAt).slice(0, 10))}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="secondary" className="w-full" onClick={() => openDetail(o.id)}>
                  👁️ Details
                </Button>
                <Button variant="secondary" className="w-full" disabled={busy} onClick={() => openEdit(o.id)}>
                  ✏️ Edit
                </Button>
                <Link href={`/restaurant/orders/${o.id}/print`} className="contents">
                  <Button variant="secondary" className="w-full">
                    🖨️ Print
                  </Button>
                </Link>
                <Button variant="danger" className="w-full" disabled={busy} onClick={() => removeOrder(o)}>
                  {busy ? "..." : "Delete"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {detail && <DetailModal order={detail} onClose={() => setDetail(null)} />}
      {editing && (
        <EditModal
          order={editing}
          locations={locations}
          riders={riders}
          payments={payments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Order Details ----------------------------- */

function DetailModal({ order, onClose }: { order: RestaurantOrderFull; onClose: () => void }) {
  const isDelivery = order.orderType === "delivery";
  // Dine-in has no customer/rider/delivery context; takeaway shows customer only if captured.
  const showCustomer = order.orderType !== "dine-in" && (order.customerName || order.customerPhone);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{order.orderNumber}</h2>
            <p className="text-xs text-slate-500">
              {formatDate(order.orderDate)} · {formatTime(order.orderTime)}
            </p>
          </div>
          <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
            {ORDER_TYPE_LABELS[order.orderType as RestaurantOrderType] ?? order.orderType}
          </Badge>
        </div>

        {showCustomer && (
          <div className="mb-3 rounded-lg border border-slate-200 p-3 text-sm">
            {order.customerName && (
              <p>
                <span className="text-slate-500">Customer:</span> {order.customerName}
              </p>
            )}
            {order.customerPhone && (
              <p>
                <span className="text-slate-500">Contact:</span> {order.customerPhone}
              </p>
            )}
            {isDelivery && (
              <>
                <p>
                  <span className="text-slate-500">Location:</span> {order.locationName ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Rider:</span> {order.riderName ?? "Unassigned"}
                </p>
              </>
            )}
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-slate-700">Items</h3>
        <div className="mb-3 space-y-2">
          {order.items.map((l) => (
            <div key={l.id} className="rounded-lg border border-slate-100 p-2 text-sm">
              <div className="flex justify-between font-medium text-slate-900">
                <span>
                  {l.quantity} × {l.name}
                  {l.sizeName ? ` (${l.sizeName})` : ""}
                  {l.lineType === "deal" && <span className="ml-1 text-xs text-amber-700">[Deal]</span>}
                </span>
                <span>{formatCurrency(l.lineTotal)}</span>
              </div>
              <p className="text-xs text-slate-500">Unit {formatCurrency(l.unitPrice)}</p>
              {l.dealItems.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-slate-500">
                  {l.dealItems.map((d) => (
                    <li key={d.id}>
                      {d.quantity} × {d.name}
                      {d.sizeName ? ` (${d.sizeName})` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {l.extras.length > 0 && (
                <ul className="mt-1 text-xs text-slate-500">
                  {l.extras.map((e) => (
                    <li key={e.id}>
                      + {e.name} ({formatCurrency(e.price)})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-medium">{formatCurrency(order.subtotal)}</dd>
          </div>
          {isDelivery && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Customer Delivery Charge</dt>
              <dd className="font-medium">{formatCurrency(order.customerDeliveryCharge)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <dt>Grand Total</dt>
            <dd>{formatCurrency(order.total)}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-slate-600">Payment Method</dt>
            <dd>{order.paymentMethod}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Payment Status</dt>
            <dd>
              <Badge className={paymentBadge(order.paymentStatus)}>{order.paymentStatus}</Badge>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Order Status</dt>
            <dd>{order.deliveryStatus ?? order.status}</dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end gap-2">
          <Link href={`/restaurant/orders/${order.id}/print`}>
            <Button variant="secondary">🖨️ Print Slips</Button>
          </Link>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Edit Order ------------------------------- */

function EditModal({
  order,
  locations,
  riders,
  payments,
  onClose,
  onSaved,
}: {
  order: RestaurantOrderFull;
  locations: Location[];
  riders: Rider[];
  payments: PaymentMethod[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDelivery = order.orderType === "delivery";
  const [customerName, setCustomerName] = useState(order.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone ?? "");
  const [locationId, setLocationId] = useState(order.locationId ? String(order.locationId) : "");
  const [riderId, setRiderId] = useState(order.riderId ? String(order.riderId) : "");
  const [charge, setCharge] = useState(String(order.customerDeliveryCharge));
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Changing location loads that location's configured charge; still overridable. */
  const pickLocation = (id: string) => {
    setLocationId(id);
    const loc = locations.find((l) => String(l.id) === id);
    if (loc) setCharge(String(loc.deliveryCharge));
  };

  const save = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurant/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod,
          ...(isDelivery
            ? {
                locationId: locationId ? Number(locationId) : null,
                riderId: riderId ? Number(riderId) : null,
                customerDeliveryCharge: Number(charge || 0),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not save changes");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Edit {order.orderNumber}</h2>
        <p className="mb-4 text-xs text-slate-500">
          Item prices are historical snapshots and are never re-priced by editing.
        </p>

        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="space-y-3">
          {order.orderType !== "dine-in" && (
            <>
              <div>
                <Label>Customer Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <Label>Customer Phone</Label>
                <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            </>
          )}

          {isDelivery && (
            <>
              <div>
                <Label>Delivery Location</Label>
                <Select value={locationId} onChange={(e) => pickLocation(e.target.value)}>
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Rider</Label>
                <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Customer Delivery Charge (Rs.)</Label>
                <Input type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} />
                <p className="mt-1 text-xs text-slate-400">
                  Billed to the customer. The rider&apos;s earning follows the location configuration separately.
                </p>
              </div>
            </>
          )}

          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {payments.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
              {!payments.some((m) => m.name === paymentMethod) && (
                <option value={paymentMethod}>{paymentMethod}</option>
              )}
            </Select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
