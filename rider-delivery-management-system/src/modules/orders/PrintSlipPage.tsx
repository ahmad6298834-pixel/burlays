"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import type { Order } from "@/types";

export default function PrintSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [width, setWidth] = useState<"58" | "80">("80");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrder(d);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading receipt...</div>;
  if (!order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  const widthClass = width === "58" ? "w-[58mm]" : "w-[80mm]";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <Link href="/orders" className="text-sm text-indigo-600 hover:underline">
          ← Back to Orders
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Paper size:</span>
            <button
              onClick={() => setWidth("58")}
              className={`rounded-md border px-2 py-1 text-xs ${
                width === "58" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setWidth("80")}
              className={`rounded-md border px-2 py-1 text-xs ${
                width === "80" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"
              }`}
            >
              80mm
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            🖨️ Print Slip
          </button>
        </div>
      </div>

      <div
        id="print-receipt"
        className={`mx-auto ${widthClass} bg-white p-3 font-mono text-[12px] leading-tight text-black shadow-sm`}
      >
        <div className="text-center">
          <p className="text-[15px] font-bold">RIDER DASH</p>
          <p>Delivery Management</p>
          <p>------------------------------</p>
        </div>
        <table className="w-full">
          <tbody>
            <Row label="Order #" value={order.orderNumber} />
            <Row label="Date" value={formatDate(order.orderDate)} />
            <Row label="Time" value={formatTime(order.orderTime)} />
          </tbody>
        </table>
        <p>------------------------------</p>
        <table className="w-full">
          <tbody>
            <Row label="Rider" value={order.riderName} />
            <Row label="Customer" value={order.customerName} />
            <Row label="Location" value={order.locationName} />
          </tbody>
        </table>
        <p>------------------------------</p>
        <table className="w-full">
          <tbody>
            <Row label="Delivery Charge" value={formatCurrency(order.deliveryCharge)} />
            <Row label="Total Bill" value={formatCurrency(order.totalBill)} />
            <Row label="Payment Method" value={order.paymentMethod} />
            <Row label="Status" value={order.status} />
          </tbody>
        </table>
        <p>------------------------------</p>
        <div className="text-center">
          <p className="font-bold">Thank you for your order!</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td className="align-top">{label}</td>
      <td className="text-right align-top">{value}</td>
    </tr>
  );
}
