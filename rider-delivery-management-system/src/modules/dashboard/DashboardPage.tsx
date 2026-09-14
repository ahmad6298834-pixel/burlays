"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/utils/format";

type DashboardData = {
  totalRiders: number;
  activeRiders: number;
  totalLocations: number;
  activeLocations: number;
  todayDeliveredOrders: number;
  todayTotalOrders: number;
  todayDeliveryCharges: number;
  todayTotalBill: number;
  totalOutstandingAdvances: number;
  ridersWithOutstanding: { id: number; name: string; balance: number }[];

  // Restaurant (Burlays POS)
  todayDineInOrders: number;
  todayTakeawayOrders: number;
  todayRestaurantDeliveryOrders: number;
  todayRestaurantOrders: number;
  todayFoodSales: number;
  todayCustomerDeliveryCharges: number;
  todayTotalSales: number;

  // Delivery workflow
  todayAssignedDeliveries: number;
  todayRiderDeliveryEarnings: number;
  pendingDeliveries: number;

  date: string;
};

/** Small section heading, matching the existing dashboard typography. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">{children}</h2>;
}

const QUICK_ACTIONS = [
  { href: "/restaurant/pos", icon: "🧾", label: "New Restaurant Order", desc: "Take a dine-in, takeaway or delivery order" },
  { href: "/restaurant", icon: "🍕", label: "Menu", desc: "Categories, items and prices" },
  { href: "/restaurant", icon: "🎁", label: "Deals", desc: "Manage combo deals" },
  { href: "/restaurant/orders", icon: "👨‍🍳", label: "Kitchen Orders", desc: "View and print kitchen tickets" },
  { href: "/orders/new", icon: "➕", label: "Assign Delivery", desc: "Create a delivery order for a rider" },
  { href: "/riders", icon: "🏍️", label: "Riders", desc: "Add or update riders" },
  { href: "/locations", icon: "📍", label: "Locations", desc: "Delivery zones and charges" },
  { href: "/reports", icon: "📅", label: "Reports", desc: "Daily rider delivery report" },
  { href: "/restaurant", icon: "⚙️", label: "Settings", desc: "Restaurant master data" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // Automatic background refresh so today's stats reflect rider deliveries and new
    // orders in near real time without requiring a manual page reload.
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={data ? `Overview for today — ${new Date(data.date).toDateString()}` : "Loading overview..."}
      />

      {loading && <p className="text-sm text-slate-500">Loading dashboard...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total Riders" value={data.totalRiders} hint={`${data.activeRiders} active`} accent="indigo" />
            <StatCard label="Total Locations" value={data.totalLocations} hint={`${data.activeLocations} active`} accent="indigo" />
            <StatCard
              label="Today's Delivered Orders"
              value={data.todayDeliveredOrders}
              hint={`${data.todayTotalOrders} orders today`}
              accent="emerald"
            />
            <StatCard label="Today's Delivery Charges" value={formatCurrency(data.todayDeliveryCharges)} accent="amber" />
            <StatCard label="Today's Total Bill Amount" value={formatCurrency(data.todayTotalBill)} accent="amber" />
            <StatCard
              label="Outstanding Rider Advances"
              value={formatCurrency(data.totalOutstandingAdvances)}
              hint="Owed by riders"
              accent="rose"
            />
          </div>

          <SectionTitle>Restaurant — Today</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Today's Dine-In Orders" value={data.todayDineInOrders} accent="indigo" />
            <StatCard label="Today's Takeaway Orders" value={data.todayTakeawayOrders} accent="indigo" />
            <StatCard label="Today's Delivery Orders" value={data.todayRestaurantDeliveryOrders} accent="indigo" />
            <StatCard
              label="Today's Total Restaurant Orders"
              value={data.todayRestaurantOrders}
              hint="All order types"
              accent="slate"
            />
            <StatCard label="Today's Food Sales" value={formatCurrency(data.todayFoodSales)} accent="emerald" />
            <StatCard
              label="Today's Customer Delivery Charges"
              value={formatCurrency(data.todayCustomerDeliveryCharges)}
              hint="Billed to customers"
              accent="amber"
            />
            <StatCard
              label="Today's Total Sales"
              value={formatCurrency(data.todayTotalSales)}
              hint="Food + customer delivery"
              accent="emerald"
            />
          </div>

          <SectionTitle>Delivery — Today</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Today's Assigned Deliveries" value={data.todayAssignedDeliveries} accent="amber" />
            <StatCard label="Today's Delivered Orders" value={data.todayDeliveredOrders} accent="emerald" />
            <StatCard
              label="Today's Rider Delivery Earnings"
              value={formatCurrency(data.todayRiderDeliveryEarnings)}
              hint="Paid to riders — not customer charges"
              accent="amber"
            />
            <StatCard
              label="Pending Deliveries"
              value={data.pendingDeliveries}
              hint="Awaiting delivery"
              accent="rose"
            />
          </div>

          <SectionTitle>Riders</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total Riders" value={data.totalRiders} accent="indigo" />
            <StatCard label="Active Riders" value={data.activeRiders} accent="emerald" />
            <StatCard
              label="Today's Rider Earnings"
              value={formatCurrency(data.todayRiderDeliveryEarnings)}
              accent="amber"
            />
            <StatCard
              label="Outstanding Rider Balance"
              value={formatCurrency(data.totalOutstandingAdvances)}
              hint="Owed by riders"
              accent="rose"
            />
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Riders with Outstanding Balance</h2>
            {data.ridersWithOutstanding.length === 0 ? (
              <EmptyState message="All rider accounts are settled." />
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Rider</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.ridersWithOutstanding.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <Link href={`/riders/${r.id}`} className="hover:text-indigo-600">
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {r.balance > 0 ? (
                            <span className="text-emerald-700">Payable to rider</span>
                          ) : (
                            <span className="text-rose-700">Owed by rider</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(Math.abs(r.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <SectionTitle>Quick Actions</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 hover:bg-slate-50"
              >
                <p className="text-2xl">{a.icon}</p>
                <p className="mt-2 font-semibold">{a.label}</p>
                <p className="text-sm text-slate-500">{a.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
