"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, Input, Label, Select, StatCard } from "@/components/ui";
import { formatCurrency, formatTime, todayISO } from "@/utils/format";
import type { Order, Rider } from "@/types";

type RiderReport = {
  riderId: number | null;
  riderName: string;
  orders: Order[];
  totalDeliveryCharges: number;
  totalBill: number;
};

type ReportResponse = {
  date: string;
  report: RiderReport[];
  grandTotals: { totalOrders: number; totalDeliveryCharges: number; totalBill: number };
};

export default function RiderReportsPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [date, setDate] = useState(todayISO());
  const [riderId, setRiderId] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then(setRiders);
  }, []);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ date });
    if (riderId) params.set("riderId", riderId);
    fetch(`/api/reports/daily?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => load(), [date, riderId]);

  // Keep today's report live as riders mark orders Delivered from the mobile app.
  useEffect(() => {
    const interval = setInterval(() => load(true), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, riderId]);

  return (
    <div>
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-500">Loading report...</p>}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Orders Delivered" value={data.grandTotals.totalOrders} accent="indigo" />
            <StatCard label="Total Delivery Charges" value={formatCurrency(data.grandTotals.totalDeliveryCharges)} accent="amber" />
            <StatCard label="Total Bill Amount" value={formatCurrency(data.grandTotals.totalBill)} accent="emerald" />
          </div>

          {data.report.length === 0 ? (
            <EmptyState message="No delivered orders found for this date." />
          ) : (
            <div className="space-y-6">
              {data.report.map((r) => (
                <Card key={r.riderId ?? r.riderName} className="p-0">
                  <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-slate-900">{r.riderName}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span>
                        Deliveries: <b className="text-slate-900">{r.orders.length}</b>
                      </span>
                      <span>
                        Charges: <b className="text-slate-900">{formatCurrency(r.totalDeliveryCharges)}</b>
                      </span>
                      <span>
                        Bill: <b className="text-slate-900">{formatCurrency(r.totalBill)}</b>
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2">Order #</th>
                          <th className="px-4 py-2">Time</th>
                          <th className="px-4 py-2">Customer</th>
                          <th className="px-4 py-2">Location</th>
                          <th className="px-4 py-2 text-right">Delivery Charge</th>
                          <th className="px-4 py-2 text-right">Bill</th>
                          <th className="px-4 py-2">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {r.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="px-4 py-2 font-medium text-slate-900">{o.orderNumber}</td>
                            <td className="px-4 py-2 text-slate-500">{formatTime(o.orderTime)}</td>
                            <td className="px-4 py-2">{o.customerName}</td>
                            <td className="px-4 py-2">{o.locationName}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(o.deliveryCharge)}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(o.totalBill)}</td>
                            <td className="px-4 py-2">{o.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
