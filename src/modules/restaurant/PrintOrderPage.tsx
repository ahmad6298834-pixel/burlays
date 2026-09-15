"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { CustomerSlip, KitchenSlip } from "./OrderSlips";
import type { RestaurantOrderFull, RestaurantSettings } from "@/types";

type Target = "kitchen" | "customer" | "both";

/**
 * Print hub for a saved order.
 *
 * The Kitchen Ticket and Customer Receipt stay two separate slips and each can
 * be printed on its own. When a single slip is chosen, the other is hidden from
 * the print job via the `only-*` class (see globals.css).
 *
 * Opened with ?autoprint=1 straight after saving: the kitchen ticket prints
 * first, then the customer receipt, and the user is returned to Restaurant
 * Orders once printing finishes. If the browser blocks automatic printing the
 * user simply stays here and uses the buttons — we never redirect early.
 */
export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const autoprint = search.get("autoprint") === "1";

  const [order, setOrder] = useState<RestaurantOrderFull | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [width, setWidth] = useState<"58" | "80">("80");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Target>("both");
  const [note, setNote] = useState("");
  const started = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/restaurant/orders/${id}`).then((r) => r.json()),
      fetch("/api/restaurant/settings").then((r) => r.json()),
    ]).then(([o, s]) => {
      setOrder(o?.id ? o : null);
      setSettings(s);
      setLoading(false);
    });
  }, [id]);

  const goToOrders = useCallback(() => router.push("/restaurant/orders"), [router]);

  /** Prints one slip (or both) — the class is applied before the dialog opens. */
  const printSlip = useCallback((which: Target) => {
    setTarget(which);
    // Let React paint the class change before the (blocking) print dialog opens.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        window.print();
        resolve();
      }, 150);
    });
  }, []);

  // Auto flow after saving: kitchen ticket, then customer receipt, then leave.
  useEffect(() => {
    if (!autoprint || loading || !order || started.current) return;
    started.current = true;
    (async () => {
      setNote("Printing Kitchen Ticket…");
      await printSlip("kitchen");
      setNote("Printing Customer Receipt…");
      await printSlip("customer");
      setNote("Done. Returning to Restaurant Orders…");
      setTimeout(goToOrders, 800);
    })();
  }, [autoprint, loading, order, printSlip, goToOrders]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading slips...</div>;
  if (!order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/restaurant/orders" className="text-sm text-indigo-600 hover:underline">
            ← Restaurant Orders
          </Link>
          <span className="text-sm font-semibold text-slate-700">{order.orderNumber}</span>
        </div>

        {note && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{note}</p>}

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

        {/* Each slip prints separately. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => printSlip("kitchen")}>
            👨‍🍳 Print Kitchen Ticket
          </Button>
          <Button onClick={() => printSlip("customer")}>🧾 Print Customer Receipt</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => printSlip("both")}>
            🖨️ Print Both
          </Button>
          <Button variant="secondary" className="flex-1" onClick={goToOrders}>
            Done
          </Button>
        </div>
      </div>

      <div
        id="print-area"
        className={`mx-auto flex max-w-md flex-col items-center gap-6 ${
          target === "kitchen" ? "only-kitchen" : target === "customer" ? "only-customer" : ""
        }`}
      >
        <div className="w-full">
          <p className="no-print mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kitchen Ticket
          </p>
          <div className="shadow-sm">
            <KitchenSlip order={order} settings={settings} width={width} />
          </div>
        </div>
        <div className="w-full">
          <p className="no-print mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Customer Receipt
          </p>
          <div className="shadow-sm">
            <CustomerSlip order={order} settings={settings} width={width} />
          </div>
        </div>
      </div>
    </div>
  );
}
