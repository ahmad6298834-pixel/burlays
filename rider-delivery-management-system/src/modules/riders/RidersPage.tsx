"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { formatCurrency, balanceLabel } from "@/utils/format";
import type { RiderWithFinancials } from "@/types";

export default function RidersPage() {
  const [riders, setRiders] = useState<RiderWithFinancials[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RiderWithFinancials | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    fetch("/api/riders")
      .then((r) => r.json())
      .then((d) => {
        setRiders(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // Keep delivered counts / earnings / balances current as riders complete deliveries.
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setError("");
    setShowForm(true);
  };

  const openEdit = (rider: RiderWithFinancials) => {
    setEditing(rider);
    setName(rider.name);
    setPhone(rider.phone ?? "");
    setEmail(rider.email ?? "");
    setPassword("");
    setError("");
    setShowForm(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Rider name is required");
      return;
    }
    const url = editing ? `/api/riders/${editing.id}` : "/api/riders";
    const method = editing ? "PATCH" : "POST";
    const payload: Record<string, unknown> = { name, phone, email };
    if (password.trim()) payload.password = password.trim();
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      return;
    }
    setShowForm(false);
    load();
  };

  const toggleActive = async (rider: RiderWithFinancials) => {
    await fetch(`/api/riders/${rider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rider.active }),
    });
    load();
  };

  const removeRider = async (rider: RiderWithFinancials) => {
    if (
      !confirm(
        `Delete rider "${rider.name}"? This cannot be undone. Their past orders will be kept for records, but their advance/ledger transactions will be removed.`
      )
    )
      return;
    const res = await fetch(`/api/riders/${rider.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Unable to delete rider.");
      return;
    }
    load();
  };

  const filtered = riders.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Riders"
        subtitle="Manage your delivery riders, their balances, and Rider App login access"
        action={<Button onClick={openAdd}>+ Add Rider</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Input placeholder="Search riders..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <p className="text-sm text-slate-500">Loading riders...</p>}

      {!loading && filtered.length === 0 && <EmptyState message="No riders found. Add your first rider to get started." />}

      {/* Mobile: card list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3 md:hidden">
          {filtered.map((rider) => {
            const bal = balanceLabel(rider.financials.balance);
            return (
              <Card key={rider.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/riders/${rider.id}`} className="block truncate font-semibold text-slate-900 hover:text-indigo-600">
                      {rider.name}
                    </Link>
                    <p className="text-xs text-slate-500">{rider.phone || "No phone"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                      rider.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {rider.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-2 text-xs">
                  {rider.hasAppLogin ? (
                    <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">{rider.email}</Badge>
                  ) : (
                    <span className="text-slate-400">App login not set up</span>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Deliveries</dt>
                    <dd className="font-medium text-slate-900">{rider.financials.deliveredCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Earnings</dt>
                    <dd className="font-medium text-slate-900">{formatCurrency(rider.financials.earnings)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Balance</dt>
                    <dd className={`font-medium ${bal.classes}`}>{bal.label}</dd>
                  </div>
                </dl>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="secondary" className="w-full" onClick={() => openEdit(rider)}>
                    Edit
                  </Button>
                  <Button
                    variant={rider.active ? "secondary" : "primary"}
                    className="w-full"
                    onClick={() => toggleActive(rider)}
                  >
                    {rider.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="danger" className="w-full" onClick={() => removeRider(rider)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Desktop / tablet: full table */}
      {!loading && filtered.length > 0 && (
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">App Login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Deliveries</th>
                <th className="px-4 py-3 text-right">Earnings</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rider) => {
                const bal = balanceLabel(rider.financials.balance);
                return (
                  <tr key={rider.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/riders/${rider.id}`} className="hover:text-indigo-600">
                        {rider.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{rider.phone || "-"}</td>
                    <td className="px-4 py-3">
                      {rider.hasAppLogin ? (
                        <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
                          {rider.email}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Not set up</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          rider.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {rider.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{rider.financials.deliveredCount}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(rider.financials.earnings)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${bal.classes}`}>{bal.label}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => openEdit(rider)}>
                          Edit
                        </Button>
                        <Button variant={rider.active ? "secondary" : "primary"} onClick={() => toggleActive(rider)}>
                          {rider.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button variant="danger" onClick={() => removeRider(rider)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editing ? "Edit Rider" : "Add Rider"}</h2>
            <div className="space-y-3">
              <div>
                <Label>Rider Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmad" />
              </div>
              <div>
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rider App Login (optional)
                </p>
                <div className="space-y-2">
                  <div>
                    <Label>Email / Username</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ahmad@riderdash.com"
                    />
                  </div>
                  <div>
                    <Label>{editing ? "New Password (leave blank to keep current)" : "Password"}</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set a password for the Android app"
                    />
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={submit}>{editing ? "Save Changes" : "Add Rider"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
