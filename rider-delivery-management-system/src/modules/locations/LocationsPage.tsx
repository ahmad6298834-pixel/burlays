"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import type { Location } from "@/types";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState("");
  const [charge, setCharge] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        setLocations(d);
        setLoading(false);
      });
  };

  useEffect(load, []);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCharge("");
    setError("");
    setShowForm(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setName(loc.name);
    setCharge(String(loc.deliveryCharge));
    setError("");
    setShowForm(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }
    if (charge === "" || Number.isNaN(Number(charge)) || Number(charge) < 0) {
      setError("Enter a valid delivery charge");
      return;
    }
    const url = editing ? `/api/locations/${editing.id}` : "/api/locations";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, deliveryCharge: Number(charge) }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      return;
    }
    setShowForm(false);
    load();
  };

  const toggleActive = async (loc: Location) => {
    await fetch(`/api/locations/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !loc.active }),
    });
    load();
  };

  const remove = async (loc: Location) => {
    if (!confirm(`Delete location "${loc.name}"? Past orders will keep their saved delivery charge.`)) return;
    await fetch(`/api/locations/${loc.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Delivery Locations"
        subtitle="Manage delivery zones and their standard charges"
        action={<Button onClick={openAdd}>+ Add Location</Button>}
      />

      {loading && <p className="text-sm text-slate-500">Loading locations...</p>}

      {!loading && locations.length === 0 && (
        <EmptyState message="No locations yet. Add one like 'Motorway Camp' with its delivery charge." />
      )}

      {/* Mobile: card list */}
      {!loading && locations.length > 0 && (
        <div className="space-y-3 md:hidden">
          {locations.map((loc) => (
            <Card key={loc.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{loc.name}</p>
                  <p className="text-sm text-slate-600">Delivery charge: {formatCurrency(loc.deliveryCharge)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                    loc.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {loc.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" onClick={() => openEdit(loc)}>
                  Edit
                </Button>
                <Button variant={loc.active ? "secondary" : "primary"} className="w-full" onClick={() => toggleActive(loc)}>
                  {loc.active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="danger" className="w-full" onClick={() => remove(loc)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop / tablet: full table */}
      {!loading && locations.length > 0 && (
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Delivery Charge</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{loc.name}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(loc.deliveryCharge)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        loc.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {loc.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => openEdit(loc)}>
                        Edit
                      </Button>
                      <Button variant={loc.active ? "secondary" : "primary"} onClick={() => toggleActive(loc)}>
                        {loc.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="danger" onClick={() => remove(loc)}>
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
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editing ? "Edit Location" : "Add Location"}</h2>
            <div className="space-y-3">
              <div>
                <Label>Location Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Motorway Camp" />
              </div>
              <div>
                <Label>Delivery Charge (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={charge}
                  onChange={(e) => setCharge(e.target.value)}
                  placeholder="e.g. 80"
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={submit}>{editing ? "Save Changes" : "Add Location"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
