"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency, formatDate, formatTime, statusBadgeClasses } from "@/utils/format";
import { ORDER_STATUSES } from "@/types";
import type { Order, Rider, Location } from "@/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [riderId, setRiderId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/riders")
      .then((r) => r.json())
      .then(setRiders);
    fetch("/api/locations")
      .then((r) => r.json())
      .then(setLocations);
  }, []);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (riderId) params.set("riderId", riderId);
    if (locationId) params.set("locationId", locationId);
    if (date) params.set("date", date);
    if (status) params.set("status", status);
    fetch(`/api/orders?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d);
        setLoading(false);
      });
  };

  useEffect(() => load(), [search, riderId, locationId, date, status]);

  // Automatic background refresh so a rider marking an order Delivered on their phone
  // shows up here without the admin needing to manually reload the page.
  useEffect(() => {
    const interval = setInterval(() => load(true), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, riderId, locationId, date, status]);

  const updateStatus = async (order: Order, newStatus: string) => {
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  const removeOrder = async (order: Order) => {
    if (
      !confirm(
        `Delete order "${order.orderNumber}" for ${order.customerName}? This cannot be undone and will remove it from reports and rider earnings.`
      )
    )
      return;
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Unable to delete order.");
      return;
    }
    load();
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="View and manage all delivery orders"
        action={
          <Link href="/orders/new">
            <Button>+ Assign Order</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Search</Label>
            <Input
              placeholder="Customer, order #, rider, location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-500">Loading orders...</p>}

      {!loading && orders.length === 0 && <EmptyState message="No orders match your filters." />}

      {/* Mobile: card list (easy to read & tap on a phone) */}
      {!loading && orders.length > 0 && (
        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(order.orderDate)} · {formatTime(order.orderTime)}
                  </p>
                </div>
                <Badge className={statusBadgeClasses(order.status)}>{order.status}</Badge>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Customer</dt>
                  <dd className="font-medium text-slate-900">{order.customerName}</dd>
                  {order.customerPhone && <dd className="text-xs text-slate-500">{order.customerPhone}</dd>}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Rider</dt>
                  <dd className="font-medium text-slate-900">{order.riderName}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
                  <dd className="text-slate-800">{order.locationName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Charge</dt>
                  <dd className="font-medium text-slate-900">{formatCurrency(order.deliveryCharge)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Bill · {order.paymentMethod}</dt>
                  <dd className="font-medium text-slate-900">{formatCurrency(order.totalBill)}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <Label>Update Status</Label>
                <Select value={order.status} onChange={(e) => updateStatus(order, e.target.value)}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link href={`/orders/${order.id}/edit`} className="contents">
                  <Button variant="secondary" className="w-full">
                    ✏️ Edit
                  </Button>
                </Link>
                <Link href={`/orders/${order.id}/print`} className="contents">
                  <Button variant="secondary" className="w-full">
                    🖨️ Print
                  </Button>
                </Link>
                <Button variant="danger" className="w-full" onClick={() => removeOrder(order)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop / tablet: full table */}
      {!loading && orders.length > 0 && (
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Charge</th>
                <th className="px-4 py-3 text-right">Bill</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(order.orderDate)}
                    <br />
                    <span className="text-xs text-slate-400">{formatTime(order.orderTime)}</span>
                  </td>
                  <td className="px-4 py-3">{order.riderName}</td>
                  <td className="px-4 py-3">{order.customerName}</td>
                  <td className="px-4 py-3 text-slate-500">{order.customerPhone || "-"}</td>
                  <td className="px-4 py-3">{order.locationName}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(order.deliveryCharge)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(order.totalBill)}</td>
                  <td className="px-4 py-3">{order.paymentMethod}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={order.status}
                      onChange={(e) => updateStatus(order, e.target.value)}
                      className="!py-1"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/orders/${order.id}/edit`}>
                        <Button variant="ghost">✏️ Edit</Button>
                      </Link>
                      <Link href={`/orders/${order.id}/print`}>
                        <Button variant="ghost">🖨️ Print</Button>
                      </Link>
                      <Button variant="danger" onClick={() => removeOrder(order)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
