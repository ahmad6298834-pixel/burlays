"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type { RestaurantOrderFull, RestaurantOrderType, RestaurantSettings } from "@/types";

/**
 * Customer-facing thermal receipt.
 *
 * Deliberately shows ONLY the customer delivery charge. The rider delivery
 * earning is internal and is never printed here or included in the total.
 */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<RestaurantOrderFull | null>(null);
  const [width, setWidth] = useState<"58" | "80">("80");
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/restaurant/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch(`/api/restaurant/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrder(d?.id ? d : null);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading receipt...</div>;
  if (!order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  const isDelivery = order.orderType === "delivery";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <Link href="/restaurant/pos" className="text-sm text-indigo-600 hover:underline">
          ← Back to POS
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Paper:</span>
            {(["58", "80"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  width === w ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"
                }`}
              >
                {w}mm
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/restaurant/orders/${id}/kitchen`}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              👨‍🍳 Kitchen Ticket
            </Link>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              🧾 Print Receipt
            </button>
          </div>
        </div>
      </div>

      <div
        id="print-receipt"
        className={`mx-auto ${width === "58" ? "w-[58mm]" : "w-[80mm]"} bg-white p-3 font-mono text-[12px] leading-tight text-black shadow-sm`}
      >
        <div className="text-center">
          <p className="text-[15px] font-bold">{settings?.name ?? RESTAURANT_NAME}</p>
          {settings?.phone && <p>{settings.phone}</p>}
          {settings?.address && <p>{settings.address}</p>}
          <p>Customer Receipt</p>
          <p>------------------------------</p>
        </div>

        <table className="w-full">
          <tbody>
            <Row label="Order #" value={order.orderNumber} />
            <Row label="Type" value={ORDER_TYPE_LABELS[order.orderType as RestaurantOrderType] ?? order.orderType} />
            <Row label="Date" value={formatDate(order.orderDate)} />
            <Row label="Time" value={formatTime(order.orderTime)} />
            {order.customerName && <Row label="Customer" value={order.customerName} />}
            {order.customerPhone && <Row label="Phone" value={order.customerPhone} />}
            {isDelivery && order.locationName && <Row label="Location" value={order.locationName} />}
          </tbody>
        </table>

        <p>------------------------------</p>

        {order.items.map((line) => (
          <div key={line.id} className="mb-1">
            <div className="flex justify-between">
              <span className="pr-2">
                {line.quantity} × {line.name}
                {line.sizeName ? ` (${line.sizeName})` : ""}
              </span>
              <span className="whitespace-nowrap">{formatCurrency(line.lineTotal)}</span>
            </div>
            {line.dealItems.length > 0 && (
              <div className="pl-3 text-[11px]">
                {line.dealItems.map((d) => (
                  <div key={d.id}>
                    - {d.quantity} × {d.name}
                    {d.sizeName ? ` (${d.sizeName})` : ""}
                  </div>
                ))}
              </div>
            )}
            {line.extras.length > 0 && (
              <div className="pl-3 text-[11px]">
                {line.extras.map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <span>+ {e.name}</span>
                    <span>{formatCurrency(e.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <p>------------------------------</p>

        <table className="w-full">
          <tbody>
            <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
            {/* Only the customer-facing charge is ever printed. */}
            {isDelivery && <Row label="Delivery Charge" value={formatCurrency(order.customerDeliveryCharge)} />}
            <Row label="Payment" value={order.paymentMethod} />
          </tbody>
        </table>

        <p>------------------------------</p>
        <div className="flex justify-between text-[14px] font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        <p>------------------------------</p>
        <p className="text-center">{settings?.receiptFooter ?? "Thank you for your order!"}</p>
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
