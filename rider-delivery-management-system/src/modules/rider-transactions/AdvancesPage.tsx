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
  const [success, setSuccess] = useState("");

  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState("");

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
    const interval = setInterval(loadRiders, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterRider) params.set("riderId", filterRider);
    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d);
        setLoading(false);
      });
  }, [filterRider]);

  const openForm = () => {
    setEditingTx(null);
    setRiderId("");
    setType("advance");
    setAmount("");
    setDate(todayISO());
    setNote("");
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (tx: Transaction) => {
    setEditingTx(tx);
    setRiderId(String(tx.riderId));
    setType(tx.type);
    setAmount(String(tx.amount));
    setDate(tx.date);
    setNote(tx.note ?? "");
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const submit = async () => {
    if (!riderId) return setError("Please select a rider");
    if (amount === "" || Number.isNaN(Number(amount)) || Number(amount) === 0)
      return setError("Enter a valid amount");
    if (!date) return setError("Date is required");

    const payload: Record<string, unknown> = {
      riderId: Number(riderId),
      type,
      amount: Number(amount),
      date,
      note,
    };

    if (editingTx) {
      payload.id = editingTx.id;
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong");
        return;
      }
      setShowForm(false);
      setSuccess("Advance/Ledger entry updated successfully.");
      loadRiders();
      loadTransactions(true);
      setTimeout(() => setSuccess(""), 4000);
    } else {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong");
        return;
      }
      setShowForm(false);
      loadRiders();
      loadTransactions();
    }
  };

  const confirmDelete = async () => {
    if (!deletingTx) return;
    setDeleteError("");
    const res = await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deletingTx.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error ?? "Failed to delete");
      return;
    }
    setDeletingTx(null);
    setSuccess("Advance/Ledger entry deleted successfully.");
    loadRiders();
    loadTransactions(true);
    setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <div>
      <PageHeader
        title="Advances / Ledger"
        subtitle="Record rider advances, payments and view running balances"
        action={<Button onClick={openForm}>+ New Transaction</Button>}
      />

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

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
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => openEditForm(tx)}>
                  Update
                </Button>
                <Button variant="secondary" onClick={() => { setDeletingTx(tx); setDeleteError(""); }}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop / tablet: full table */}
      {!loading && transactions.length > 0 && (
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Actions</th>
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
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openEditForm(tx)}>
                        Update
                      </Button>
                      <Button variant="secondary" onClick={() => { setDeletingTx(tx); setDeleteError(""); }}>
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

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingTx ? "Update Transaction" : "New Rider Transaction"}
            </h2>
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
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={submit}>{editingTx ? "Save Changes" : "Save"}</Button>
            </div>
          </div>
        </div>
      )}

      {deletingTx && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Delete Transaction</h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the {TYPE_LABELS[deletingTx.type]?.toLowerCase() ?? deletingTx.type} entry
              of <span className="font-medium">{formatCurrency(deletingTx.amount)}</span> for{" "}
              <span className="font-medium">{deletingTx.riderName}</span>?
            </p>
            {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingTx(null)}>
                Cancel
              </Button>
              <Button onClick={confirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
