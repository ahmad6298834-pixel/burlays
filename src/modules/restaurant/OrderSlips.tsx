"use client";

import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type { RestaurantOrderFull, RestaurantOrderType, RestaurantSettings } from "@/types";

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td className="align-top">{label}</td>
      <td className="text-right align-top">{value}</td>
    </tr>
  );
}

const typeLabel = (t: string) => ORDER_TYPE_LABELS[t as RestaurantOrderType] ?? t;

/**
 * KITCHEN TICKET — strictly what the kitchen needs to cook.
 *
 * Contains ONLY the restaurant name, order number, order type and each line's
 * item / size / quantity / extras. Deliberately EXCLUDES customer name, phone,
 * rider, delivery location, delivery charge, totals and payment info.
 */
export function KitchenSlip({
  order,
  settings,
  width,
}: {
  order: RestaurantOrderFull;
  settings: RestaurantSettings | null;
  width: "58" | "80";
}) {
  return (
    <div
      className={`print-slip slip-kitchen mx-auto ${
        width === "58" ? "w-[58mm]" : "w-[80mm]"
      } bg-white p-3 font-mono text-[13px] leading-tight text-black`}
    >
      <div className="text-center">
        <p className="text-[17px] font-bold tracking-wide">{(settings?.name ?? RESTAURANT_NAME).toUpperCase()}</p>
        <p className="text-[15px] font-bold">ORDER #{order.orderNumber}</p>
        <p className="text-[15px] font-bold">{typeLabel(order.orderType).toUpperCase()}</p>
      </div>

      <p>------------------------------</p>

      {order.items.map((line) => (
        <div key={line.id} className="mb-2">
          <p className="text-[14px] font-bold">
            {line.name}
            {line.sizeName ? ` - ${line.sizeName}` : ""} x{line.quantity}
          </p>
          {line.dealItems.length > 0 && (
            <div className="pl-3">
              {line.dealItems.map((d) => (
                <p key={d.id}>
                  - {d.name}
                  {d.sizeName ? ` - ${d.sizeName}` : ""} x{d.quantity}
                </p>
              ))}
            </div>
          )}
          {line.extras.length > 0 && (
            <div className="pl-3">
              {line.extras.map((e) => (
                <p key={e.id}>+ {e.name}</p>
              ))}
            </div>
          )}
        </div>
      ))}

      <p>------------------------------</p>
      <p className="text-center">** END OF ORDER **</p>
    </div>
  );
}

/**
 * CUSTOMER RECEIPT — everything the customer needs.
 *
 * Shows the customer delivery charge (what they pay). The rider delivery
 * earning is internal and is NEVER printed here nor added to the total.
 * There is no separate rider slip anywhere in the system.
 */
export function CustomerSlip({
  order,
  settings,
  width,
}: {
  order: RestaurantOrderFull;
  settings: RestaurantSettings | null;
  width: "58" | "80";
}) {
  const isDelivery = order.orderType === "delivery";

  return (
    <div
      className={`print-slip slip-customer mx-auto ${
        width === "58" ? "w-[58mm]" : "w-[80mm]"
      } bg-white p-3 font-mono text-[12px] leading-tight text-black`}
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
          <Row label="Type" value={typeLabel(order.orderType)} />
          <Row label="Date" value={formatDate(order.orderDate)} />
          <Row label="Time" value={formatTime(order.orderTime)} />
          {order.customerName && <Row label="Customer" value={order.customerName} />}
          {order.customerPhone && <Row label="Contact" value={order.customerPhone} />}
          {isDelivery && order.locationName && <Row label="Location" value={order.locationName} />}
          {isDelivery && <Row label="Rider" value={order.riderName ?? "Unassigned"} />}
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
          {isDelivery && <Row label="Delivery Charge" value={formatCurrency(order.customerDeliveryCharge)} />}
          <Row label="Payment" value={order.paymentMethod} />
          <Row label="Payment Status" value={order.paymentStatus} />
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
  );
}
