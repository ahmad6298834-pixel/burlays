"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { balanceLabel, formatCurrency, formatDate, todayISO } from "@/utils/format";
import type { RiderWithFinancials } from "@/types";

type Transaction = {
  id: number;
  riderId: number;
  riderName: string;
  type: "advance" | "payment" | "adjustment";
  amount: string | number;
  date: string;
  note: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  advance: "Advance Given",
  payment: "Payment to Rider",
  adjustment: "Manual Adjustment",
};

export default function AdvancesPage() {
  const [riders, setRiders] = useState<RiderWithFinancials[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterRider, setFilterRider] = useState("");
  const [loading, setLoading] = useState(true);

  const [riderId, setRiderId] = useState("");
  const [type, setType] = useState<"advance" | "payment" | "adjustment">("advance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadRiders = () => fetch("/api/riders").then((r) => r.json()).then(setRiders);
  const loadTransactions = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (filterRider) params.set("riderId", filterRider);
    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRiders();
    // Keep rider balances current as delivered orders and new transactions come in.
    const interval = setInterval(loadRiders, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => loadTransactions(), [filterRider]);

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setRiderId(String(tx.riderId));
    setType(tx.type);
    setAmount(String(tx.amount));
    setDate(tx.date);
    setNote(tx.note ?? "");
    setError("");
    setShowForm(true);
  };

  const removeTx = async (tx: Transaction) => {
    if (!confirm(`Delete this ${TYPE_LABELS[tx.type] ?? tx.type} of ${formatCurrency(tx.amount)} for ${tx.riderName}?\n\nThe rider ledger and outstanding balance will be recalculated.`))
      return;
    setError("");
    setBusyId(tx.id);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not delete the transaction");
        return;
      }
      loadRiders();
      loadTransactions(true);
    } finally {
      setBusyId(null);
    }
  };

  const openForm = () => {
    setEditingTx(null);
    setRiderId("");
    setType("advance");
    setAmount("");
    setDate(todayISO());
    setNote("");
    setError("");
    setShowForm(true);
  };

  const submit = async () => {
    if (saving) return; // guard against double submission
    if (!riderId) return setError("Please select a rider");
    if (amount === "" || Number.isNaN(Number(amount)) || Number(amount) === 0)
      return setError("Enter a valid amount");
    if (!date) return setError("Date is required");

    setError("");
    setSaving(true);
    try {
      const body = { riderId: Number(riderId), type, amount: Number(amount), date, note };
      const res = editingTx
        ? await fetch(`/api/transactions/${editingTx.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong");
        return;
      }
      setShowForm(false);
      setEditingTx(null);
      loadRiders();
      loadTransactions(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Advances / Ledger"
        subtitle="Record rider advances, payments and view running balances"
        action={<Button onClick={openForm}>+ New Transaction</Button>}
      />

      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Rider Balances</h2>
        {riders.length === 0 ? (
          <EmptyState message="No riders yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {riders.map((rider) => {
              const bal = balanceLabel(rider.financials.balance);
              return (
                <Card key={rider.id}>
                  <div className="flex items-center justify-between">
                    <Link href={`/riders/${rider.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                      {rider.name}
                    </Link>
                    <span className={`text-sm font-medium ${bal.classes}`}>{bal.label}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Earnings: {formatCurrency(rider.financials.earnings)}</span>
                    <span>Advances: {formatCurrency(rider.financials.advances)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4 max-w-xs">
        <Label>Filter by Rider</Label>
        <Select value={filterRider} onChange={(e) => setFilterRider(e.target.value)}>
          <option value="">All riders</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading transactions...</p>}

      {!loading && transactions.length === 0 && <EmptyState message="No advance or payment transactions recorded yet." />}

      {/* Mobile: card list */}
      {!loading && transactions.length > 0 && (
        <div className="space-y-3 md:hidden">
          {transactions.map((tx) => (
            <Card key={tx.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{tx.riderName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(tx.date)} · {TYPE_LABELS[tx.type] ?? tx.type}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">{formatCurrency(tx.amount)}</p>
              </div>
              {tx.note && <p className="mt-2 text-sm text-slate-500">{tx.note}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="w-full" disabled={busyId === tx.id} onClick={() => openEdit(tx)}>
                  Edit
                </Button>
                <Button variant="danger" className="w-full" disabled={busyId === tx.id} onClick={() => removeTx(tx)}>
                  {busyId === tx.id ? "..." : "Delete"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop / tablet: full table */}
      {!loading && transactions.length > 0 && (
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{tx.riderName}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[tx.type] ?? tx.type}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(tx.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{tx.note || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" disabled={busyId === tx.id} onClick={() => openEdit(tx)}>
                        Edit
                      </Button>
                      <Button variant="danger" disabled={busyId === tx.id} onClick={() => removeTx(tx)}>
                        {busyId === tx.id ? "..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editingTx ? "Edit Transaction" : "New Rider Transaction"}</h2>
            <div className="space-y-3">
              <div>
                <Label>Rider</Label>
                <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                  <option value="">Select rider</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Transaction Type</Label>
                <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  <option value="advance">Advance Given (Khata)</option>
                  <option value="payment">Payment to Rider (Clear Balance)</option>
                  <option value="adjustment">Manual Adjustment (+/-)</option>
                </Select>
              </div>
              <div>
                <Label>Amount (Rs.){type === "adjustment" ? " — use negative to deduct" : ""}</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2000" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fuel advance" />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Saving..." : editingTx ? "Save Changes" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
