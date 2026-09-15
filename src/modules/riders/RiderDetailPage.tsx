"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { balanceLabel, formatCurrency, formatDate, statusBadgeClasses } from "@/utils/format";
import type { LedgerRow } from "@/modules/riders/riderFinancials.service";
import type { Order, Rider } from "@/types";

type RiderDetail = {
  rider: Rider;
  ledger: LedgerRow[];
  totals: { earnings: number; advances: number; adjustments: number; balance: number; deliveredCount: number };
  history: Order[];
};

export default function RiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RiderDetail | null>(null);
  const [tab, setTab] = useState<"history" | "ledger">("history");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = (silent = false) => {
      if (!silent) setLoading(true);
      fetch(`/api/riders/${id}`)
        .then((r) => r.json())
        .then((d) => {
          setData(d);
          setLoading(false);
        });
    };
    load();
    // Keep the ledger/history/balance current as this rider delivers orders or has
    // advances recorded elsewhere in the admin app.
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <p className="text-sm text-slate-500">Loading rider...</p>;
  if (!data || !data.rider) return <EmptyState message="Rider not found." />;

  const bal = balanceLabel(data.totals.balance);

  return (
    <div>
      <div className="mb-4">
        <Link href="/riders" className="text-sm text-indigo-600 hover:underline">
          ← Back to Riders
        </Link>
      </div>
      <PageHeader
        title={data.rider.name}
        subtitle={data.rider.phone ? `Phone: ${data.rider.phone}` : "Rider profile & delivery history"}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Deliveries Completed" value={data.totals.deliveredCount} accent="indigo" />
        <StatCard label="Total Delivery Earnings" value={formatCurrency(data.totals.earnings)} accent="emerald" />
        <StatCard label="Total Advances Taken" value={formatCurrency(data.totals.advances)} accent="amber" />
        <StatCard
          label="Remaining Balance"
          value={formatCurrency(Math.abs(data.totals.balance))}
          hint={bal.label}
          accent={data.totals.balance < 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "history" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"
          }`}
        >
          Delivery History
        </button>
        <button
          onClick={() => setTab("ledger")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ledger" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"
          }`}
        >
          Ledger / Account Statement
        </button>
      </div>

      {tab === "history" && (
        <div className="mt-4">
          {data.history.length === 0 ? (
            <EmptyState message="No orders assigned to this rider yet." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Delivery Charge</th>
                    <th className="px-4 py-3 text-right">Bill</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.history.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/orders/${order.id}/print`} className="hover:text-indigo-600">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatDate(order.orderDate)}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3">{order.locationName}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(order.deliveryCharge)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(order.totalBill)}</td>
                      <td className="px-4 py-3">{order.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <Badge className={statusBadgeClasses(order.status)}>{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === "ledger" && (
        <div className="mt-4">
          {data.ledger.length === 0 ? (
            <EmptyState message="No ledger entries yet." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Delivery Earnings</th>
                    <th className="px-4 py-3 text-right">Advance Taken</th>
                    <th className="px-4 py-3 text-right">Adjustment/Payment</th>
                    <th className="px-4 py-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.ledger.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-slate-600">{row.description}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        {row.deliveryEarnings ? formatCurrency(row.deliveryEarnings) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-700">
                        {row.advanceTaken ? formatCurrency(row.advanceTaken) : "-"}
                      </td>
                      <td className={`px-4 py-3 text-right ${row.adjustment < 0 ? "text-rose-700" : "text-slate-700"}`}>
                        {row.adjustment ? formatCurrency(row.adjustment) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(row.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
