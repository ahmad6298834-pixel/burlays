"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { ORDER_STATUSES, PAYMENT_METHODS } from "@/types";
import type { Location, Order, Rider } from "@/types";

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [riders, setRiders] = useState<Rider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const [riderId, setRiderId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [totalBill, setTotalBill] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [orderDate, setOrderDate] = useState("");
  const [orderTime, setOrderTime] = useState("");
  const [status, setStatus] = useState<string>(ORDER_STATUSES[0]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then(setRiders);
    fetch("/api/locations")
      .then((r) => r.json())
      .then(setLocations);
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((o: Order) => {
        setOrder(o);
        setRiderId(String(o.riderId ?? ""));
        setCustomerPhone(o.customerPhone ?? "");
        setCustomerName(o.customerName);
        setOrderNumber(o.orderNumber);
        setLocationId(String(o.locationId ?? ""));
        // Always show the order's OWN saved delivery charge on load — this is the
        // historical value charged at order time and must never be silently
        // recalculated from the location's current configured charge.
        setDeliveryCharge(String(o.deliveryCharge));
        setTotalBill(String(o.totalBill));
        setPaymentMethod(o.paymentMethod);
        setOrderDate(o.orderDate);
        setOrderTime(o.orderTime);
        setStatus(o.status);
        setLoading(false);
      });
  }, [id]);

  /**
   * Fired the moment the admin picks a Delivery Location. Looks up that location's
   * currently configured delivery charge directly from the loaded Location records
   * (fetched from the database via /api/locations, never hardcoded) and immediately
   * fills the Delivery Charge field. This runs synchronously in the change handler
   * instead of a delayed effect, so there is no race condition and no chance of the
   * field being left at 0 — the admin can still manually edit the value afterwards.
   */
  const handleLocationChange = (newLocationId: string) => {
    setLocationId(newLocationId);
    const location = locations.find((l) => String(l.id) === newLocationId);
    if (location) {
      setDeliveryCharge(String(location.deliveryCharge));
    }
  };

  const submit = async () => {
    setError("");
    setSuccess(false);
    if (!riderId) return setError("Please select a rider");
    if (!customerName.trim()) return setError("Customer name is required");
    if (!locationId) return setError("Please select a delivery location");
    if (totalBill === "" || Number.isNaN(Number(totalBill)) || Number(totalBill) < 0)
      return setError("Enter a valid total bill amount");

    setSubmitting(true);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riderId: Number(riderId),
        customerName,
        customerPhone,
        orderNumber,
        locationId: Number(locationId),
        deliveryCharge: Number(deliveryCharge),
        totalBill: Number(totalBill),
        paymentMethod,
        orderDate,
        orderTime,
        status,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      return;
    }
    setSuccess(true);
  };

  const removeOrder = async () => {
    if (
      !confirm(
        `Delete order "${order?.orderNumber}"? This cannot be undone and will remove it from reports and rider earnings.`
      )
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to delete order.");
      return;
    }
    router.push("/orders");
  };

  if (loading) return <p className="text-sm text-slate-500">Loading order...</p>;
  if (!order) return <p className="text-sm text-slate-500">Order not found.</p>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/orders" className="text-sm text-indigo-600 hover:underline">
          ← Back to Orders
        </Link>
      </div>
      <PageHeader
        title={`Edit Order ${order.orderNumber}`}
        subtitle="Update any field. Rider, location, and totals recalculate reports automatically."
      />

      <Card className="max-w-3xl">
        {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {success && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Order updated successfully. Dashboards, reports and rider ledgers now reflect the latest data.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Customer Phone Number</Label>
            <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g. 03001234567" />
          </div>
          <div>
            <Label>Customer Name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label>Delivery Location</Label>
            <Select value={locationId} onChange={(e) => handleLocationChange(e.target.value)}>
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {formatCurrency(l.deliveryCharge)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Rider Name</Label>
            <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
              <option value="">Select rider</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {!r.active ? " (inactive)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Customer Order / Invoice Number</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          <div>
            <Label>Delivery Charge (Rs.)</Label>
            <Input
              type="number"
              min="0"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              Auto-filled from location; the amount charged at order time is always preserved unless you edit it here.
            </p>
          </div>
          <div>
            <Label>Total Bill Amount (Rs.)</Label>
            <Input type="number" min="0" value={totalBill} onChange={(e) => setTotalBill(e.target.value)} />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Order Date</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <Label>Order Time</Label>
            <Input type="time" value={orderTime} onChange={(e) => setOrderTime(e.target.value)} />
          </div>
          <div>
            <Label>Order Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="danger" onClick={removeOrder} disabled={deleting}>
            {deleting ? "Deleting..." : "🗑️ Delete Order"}
          </Button>
          <Link href={`/orders/${id}/print`}>
            <Button variant="secondary">🖨️ Print Slip</Button>
          </Link>
          <Button variant="secondary" onClick={() => router.push("/orders")}>
            Back to Orders
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
