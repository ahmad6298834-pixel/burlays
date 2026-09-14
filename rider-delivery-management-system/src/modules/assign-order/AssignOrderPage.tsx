"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency, nowTimeHHMM, todayISO } from "@/utils/format";
import { ORDER_STATUSES, PAYMENT_METHODS } from "@/types";
import type { Location, Rider } from "@/types";

type CustomerLookup = {
  id: number;
  phone: string;
  name: string;
  defaultLocationId: number | null;
  defaultLocationName: string | null;
};

export default function AssignOrderPage() {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [totalBill, setTotalBill] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [orderDate, setOrderDate] = useState(todayISO());
  const [orderTime, setOrderTime] = useState(nowTimeHHMM());
  const [status, setStatus] = useState<string>(ORDER_STATUSES[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [lookupStatus, setLookupStatus] = useState<"idle" | "checking" | "found" | "new">("idle");
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLookedUpPhone = useRef<string>("");
  // Always holds the latest fetched locations, so async callbacks (like the debounced
  // phone lookup below) never act on a stale/empty list — avoiding any race condition
  // that could otherwise leave the Delivery Charge field at 0.
  const locationsRef = useRef<Location[]>([]);

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then((d: (Rider & { active: boolean })[]) => setRiders(d.filter((r) => r.active)));
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: Location[]) => {
        const active = d.filter((l) => l.active);
        locationsRef.current = active;
        setLocations(active);
      });
  }, []);

  /**
   * Looks up a location's currently configured delivery charge directly from the
   * loaded Location records (fetched from the database via /api/locations, never
   * hardcoded) and fills the Delivery Charge field immediately. Used both when the
   * admin manually picks a location from the dropdown and when a returning
   * customer's saved default location is auto-selected by phone lookup.
   */
  const applyLocation = (newLocationId: string) => {
    setLocationId(newLocationId);
    const location = locationsRef.current.find((l) => String(l.id) === newLocationId);
    if (location) {
      setDeliveryCharge(String(location.deliveryCharge));
    }
  };

  // Look up the customer by phone number as the admin types it (debounced), so the
  // Assign Order form auto-fills name + delivery location for a returning customer.
  useEffect(() => {
    const digits = customerPhone.trim();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    if (digits.length < 7) {
      setLookupStatus("idle");
      return;
    }

    lookupTimer.current = setTimeout(async () => {
      if (digits === lastLookedUpPhone.current) return;
      lastLookedUpPhone.current = digits;
      setLookupStatus("checking");
      try {
        const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(digits)}`);
        const data = await res.json();
        const customer: CustomerLookup | null = data.customer;
        if (customer) {
          setCustomerName(customer.name);
          if (customer.defaultLocationId) {
            applyLocation(String(customer.defaultLocationId));
          }
          setLookupStatus("found");
        } else {
          setLookupStatus("new");
        }
      } catch {
        setLookupStatus("idle");
      }
    }, 500);

    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone]);

  const submit = async () => {
    setError("");
    if (!customerPhone.trim()) return setError("Customer phone number is required");
    if (!customerName.trim()) return setError("Customer name is required");
    if (!locationId) return setError("Please select a delivery location");
    if (!riderId) return setError("Please select a rider");
    if (totalBill === "" || Number.isNaN(Number(totalBill)) || Number(totalBill) < 0)
      return setError("Enter a valid total bill amount");

    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
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
    const created = await res.json();
    router.push(`/orders/${created.id}/print?created=1`);
  };

  return (
    <div>
      <PageHeader title="Assign Order / Delivery" subtitle="Create a new delivery order and assign it to a rider" />

      <Card className="max-w-3xl">
        {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Customer Phone Number</Label>
            <Input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 03001234567"
            />
            {lookupStatus === "checking" && <p className="mt-1 text-xs text-slate-400">Checking customer records...</p>}
            {lookupStatus === "found" && (
              <p className="mt-1 text-xs font-medium text-emerald-600">
                ✅ Existing customer found — name &amp; location auto-filled. You can still edit them below.
              </p>
            )}
            {lookupStatus === "new" && (
              <p className="mt-1 text-xs text-slate-400">New customer — this number will be saved for next time.</p>
            )}
          </div>
          <div>
            <Label>Customer Name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Ali" />
          </div>
          <div>
            <Label>Delivery Location</Label>
            <Select value={locationId} onChange={(e) => applyLocation(e.target.value)}>
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
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Customer Order / Invoice Number</Label>
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Leave blank to auto-generate"
            />
          </div>
          <div>
            <Label>Delivery Charge (Rs.)</Label>
            <Input
              type="number"
              min="0"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Auto-filled from location. You can override if needed.</p>
          </div>
          <div>
            <Label>Total Bill Amount (Rs.)</Label>
            <Input
              type="number"
              min="0"
              value={totalBill}
              onChange={(e) => setTotalBill(e.target.value)}
              placeholder="e.g. 2500"
            />
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

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.push("/orders")}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : "Save & Print Slip"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
