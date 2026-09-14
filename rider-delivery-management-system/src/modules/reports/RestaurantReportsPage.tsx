"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Input, Label, Select, StatCard } from "@/components/ui";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { ORDER_TYPE_LABELS } from "@/types";
import type { Location, PaymentMethod, Rider, RestaurantOrderType } from "@/types";

type ReportRow = {
  id: number;
  orderNumber: string;
  orderType: string;
  orderDate: string;
  orderTime: string;
  items: { name: string; sizeName: string | null; quantity: number; lineTotal: number; extras: string[] }[];
  totalQuantity: number;
  foodTotal: number;
  customerDeliveryCharge: number;
  grandTotal: number;
  paymentMethod: string;
  riderName: string | null;
  riderDeliveryEarning: number;
  deliveryStatus: string | null;
};

type Report = {
  range: { from: string; to: string };
  totals: {
    orders: number;
    foodSales: number;
    customerDeliveryCharges: number;
    totalSales: number;
    riderDeliveryEarnings: number;
  };
  typeSummary: { orderType: string; orders: number; foodTotal: number; customerDeliveryCharge: number; grandTotal: number }[];
  dailySales: { date: string; orders: number; foodTotal: number; customerDeliveryCharge: number; grandTotal: number }[];
  menuItemSales: { name: string; quantity: number; total: number }[];
  dealSales: { name: string; quantity: number; total: number }[];
  paymentSummary: { paymentMethod: string; orders: number; total: number }[];
  riderEarnings: { riderName: string; deliveries: number; earnings: number; customerCharges: number }[];
  detail: ReportRow[];
};

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

/** Simple reusable table shell matching the existing report styling. */
function MiniTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <EmptyState message="No data for this selection." />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`px-4 py-2 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`px-4 py-2 ${ci > 0 ? "text-right" : "font-medium text-slate-900"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function RestaurantReportsPage() {
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orderType, setOrderType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [riderId, setRiderId] = useState("");
  const [locationId, setLocationId] = useState("");

  const [riders, setRiders] = useState<Rider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/riders").then((r) => r.json()).then(setRiders);
    fetch("/api/locations").then((r) => r.json()).then(setLocations);
    fetch("/api/restaurant/payment-methods").then((r) => r.json()).then(setPayments);
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    if (orderType) p.set("orderType", orderType);
    if (paymentMethod) p.set("paymentMethod", paymentMethod);
    if (riderId) p.set("riderId", riderId);
    if (locationId) p.set("locationId", locationId);

    fetch(`/api/reports/restaurant?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [preset, from, to, orderType, paymentMethod, riderId, locationId]);

  return (
    <div>
      <Card className="mb-4">
        <Label>Period</Label>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                preset === p.key
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Order Type</Label>
            <Select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              <option value="">All types</option>
              <option value="dine-in">Dine-In</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </Select>
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">All methods</option>
              {payments.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Rider</Label>
            <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
              <option value="">All riders</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-500">Loading report...</p>}

      {data && !loading && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {formatDate(data.range.from)} → {formatDate(data.range.to)}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <StatCard label="Total Orders" value={data.totals.orders} accent="indigo" />
            <StatCard label="Food Sales" value={formatCurrency(data.totals.foodSales)} accent="emerald" />
            <StatCard
              label="Customer Delivery Charges"
              value={formatCurrency(data.totals.customerDeliveryCharges)}
              hint="Billed to customers"
              accent="amber"
            />
            <StatCard label="Total Sales" value={formatCurrency(data.totals.totalSales)} accent="emerald" />
            <StatCard
              label="Rider Delivery Earnings"
              value={formatCurrency(data.totals.riderDeliveryEarnings)}
              hint="From location config"
              accent="rose"
            />
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Sales by Order Type</h3>
          <MiniTable
            headers={["Order Type", "Orders", "Food", "Cust. Delivery", "Total"]}
            rows={data.typeSummary.map((t) => [
              ORDER_TYPE_LABELS[t.orderType as RestaurantOrderType] ?? t.orderType,
              t.orders,
              formatCurrency(t.foodTotal),
              formatCurrency(t.customerDeliveryCharge),
              formatCurrency(t.grandTotal),
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Daily Sales</h3>
          <MiniTable
            headers={["Date", "Orders", "Food", "Cust. Delivery", "Total"]}
            rows={data.dailySales.map((d) => [
              formatDate(d.date),
              d.orders,
              formatCurrency(d.foodTotal),
              formatCurrency(d.customerDeliveryCharge),
              formatCurrency(d.grandTotal),
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Menu Item Sales</h3>
          <MiniTable
            headers={["Item", "Qty", "Total"]}
            rows={data.menuItemSales.map((m) => [m.name, m.quantity, formatCurrency(m.total)])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Deal Sales</h3>
          <MiniTable
            headers={["Deal", "Qty", "Total"]}
            rows={data.dealSales.map((d) => [d.name, d.quantity, formatCurrency(d.total)])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Payment Method Summary</h3>
          <MiniTable
            headers={["Payment Method", "Orders", "Total"]}
            rows={data.paymentSummary.map((p) => [p.paymentMethod, p.orders, formatCurrency(p.total)])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">
            Rider Delivery Earnings{" "}
            <span className="font-normal text-slate-400">(delivered orders, from location config)</span>
          </h3>
          <MiniTable
            headers={["Rider", "Deliveries", "Rider Earning", "Cust. Charged"]}
            rows={data.riderEarnings.map((r) => [
              r.riderName,
              r.deliveries,
              formatCurrency(r.earnings),
              formatCurrency(r.customerCharges),
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Order Detail</h3>
          {data.detail.length === 0 ? (
            <EmptyState message="No orders found for this selection." />
          ) : (
            <div className="space-y-3">
              {data.detail.map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{o.orderNumber}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(o.orderDate)} · {formatTime(o.orderTime)}
                      </p>
                    </div>
                    <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
                      {ORDER_TYPE_LABELS[o.orderType as RestaurantOrderType] ?? o.orderType}
                    </Badge>
                  </div>

                  <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.quantity} × {it.name}
                        {it.sizeName ? ` (${it.sizeName})` : ""}
                        {it.extras.length ? ` + ${it.extras.join(", ")}` : ""} — {formatCurrency(it.lineTotal)}
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Qty</dt>
                      <dd className="font-medium text-slate-900">{o.totalQuantity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Food Total</dt>
                      <dd className="font-medium text-slate-900">{formatCurrency(o.foodTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Cust. Delivery Charge</dt>
                      <dd className="font-medium text-slate-900">{formatCurrency(o.customerDeliveryCharge)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Grand Total</dt>
                      <dd className="font-bold text-slate-900">{formatCurrency(o.grandTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Payment</dt>
                      <dd className="text-slate-800">{o.paymentMethod}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Rider</dt>
                      {/* Dine-in and takeaway have no rider by definition. */}
                      <dd className="text-slate-800">{o.riderName ?? "N/A"}</dd>
                      {o.orderType === "delivery" && (
                        <dd className="text-[11px] text-slate-400">
                          Earning {formatCurrency(o.riderDeliveryEarning)}
                          {o.deliveryStatus ? ` · ${o.deliveryStatus}` : ""}
                        </dd>
                      )}
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
