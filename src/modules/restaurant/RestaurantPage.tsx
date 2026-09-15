"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import ImagePicker from "@/components/ImagePicker";
import type {
  DealWithItems,
  Deal,
  MenuCategory,
  MenuExtra,
  MenuItemWithSizes,
  PaymentMethod,
  RestaurantSettings,
} from "@/types";

type Tab = "info" | "categories" | "menu" | "deals" | "extras" | "payments";
type SizeRow = { name: string; price: string };
type DealLine = { menuItemId: string; sizeId: string; quantity: string };
type Send = (url: string, method: string, body?: unknown) => Promise<boolean>;
type Busy = { saving: boolean; run: (fn: () => Promise<unknown>) => Promise<void> };

const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "Restaurant Info" },
  { key: "categories", label: "Categories" },
  { key: "menu", label: "Menu Items" },
  { key: "deals", label: "Deals" },
  { key: "extras", label: "Extras / Add-ons" },
  { key: "payments", label: "Payment Methods" },
];

/** Shared search + active-filter bar used by every master-data screen. */
function Filters({
  search,
  setSearch,
  status,
  setStatus,
  placeholder,
}: {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <Input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">All statuses</option>
        <option value="active">Active only</option>
        <option value="inactive">Inactive only</option>
      </Select>
    </div>
  );
}

function matches(name: string, active: boolean, search: string, status: string) {
  const bySearch = name.toLowerCase().includes(search.toLowerCase());
  const byStatus = status === "all" || (status === "active" ? active : !active);
  return bySearch && byStatus;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function RestaurantSettingsPage() {
  const [tab, setTab] = useState<Tab>("info");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItemWithSizes[]>([]);
  const [dealList, setDealList] = useState<DealWithItems[]>([]);
  const [extras, setExtras] = useState<MenuExtra[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [info, setInfo] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Global in-flight flag: disables every save/delete button while a request runs.
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    const [c, i, d, e, pm, st] = await Promise.all([
      fetch("/api/restaurant/categories").then((r) => r.json()),
      fetch("/api/restaurant/menu-items").then((r) => r.json()),
      fetch("/api/restaurant/deals").then((r) => r.json()),
      fetch("/api/restaurant/extras").then((r) => r.json()),
      fetch("/api/restaurant/payment-methods").then((r) => r.json()),
      fetch("/api/restaurant/settings").then((r) => r.json()),
    ]);
    setCategories(c);
    setItems(i);
    setDealList(d);
    setExtras(e);
    setPayments(pm);
    setInfo(st);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  /** Shared request helper; surfaces API errors such as soft-delete guards. */
  const send: Send = async (url, method, body) => {
    if (saving) return false; // guard against duplicate submissions
    setError("");
    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong");
        return false;
      }
      await loadAll();
      return true;
    } catch {
      setError("Could not reach the server. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`${info?.name ?? "Burlays"} — Settings`}
        subtitle="All restaurant master data lives here. Nothing is hard-coded: the POS reads everything from these records."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setError("");
            }}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading settings...</p>}

      {!loading && tab === "info" && <InfoTab saving={saving} info={info} send={send} />}
      {!loading && tab === "categories" && <CategoriesTab saving={saving} categories={categories} send={send} />}
      {!loading && tab === "menu" && <MenuItemsTab saving={saving} items={items} categories={categories} send={send} />}
      {!loading && tab === "deals" && <DealsTab saving={saving} deals={dealList} items={items} send={send} />}
      {!loading && tab === "extras" && <ExtrasTab saving={saving} extras={extras} send={send} />}
      {!loading && tab === "payments" && <PaymentsTab saving={saving} payments={payments} send={send} />}
    </div>
  );
}

/* ---------------------------- Restaurant Info ---------------------------- */

function InfoTab({ info, send, saving }: { info: RestaurantSettings | null; send: Send; saving: boolean }) {
  const [name, setName] = useState(info?.name ?? "");
  const [phone, setPhone] = useState(info?.phone ?? "");
  const [address, setAddress] = useState(info?.address ?? "");
  const [footer, setFooter] = useState(info?.receiptFooter ?? "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaved(false);
    if (await send("/api/restaurant/settings", "PATCH", { name, phone, address, receiptFooter: footer }))
      setSaved(true);
  };

  return (
    <Card className="max-w-xl">
      {saved && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Receipts and the POS now use these details.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <Label>Restaurant Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Burlays" />
        </div>
        <div>
          <Label>Phone (optional)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Address (optional)</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label>Receipt Footer</Label>
          <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>
    </Card>
  );
}

/* ------------------------------- Categories ------------------------------- */

function CategoriesTab({ categories, send, saving }: { categories: MenuCategory[]; send: Send; saving: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [name, setName] = useState("");

  const openAdd = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };
  const openEdit = (c: MenuCategory) => {
    setEditing(c);
    setName(c.name);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    const ok = editing
      ? await send(`/api/restaurant/categories/${editing.id}`, "PATCH", { name })
      : await send("/api/restaurant/categories", "POST", { name, sortOrder: categories.length });
    if (ok) setOpen(false);
  };

  const visible = categories.filter((c) => matches(c.name, c.active, search, status));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} disabled={saving}>+ Add Category</Button>
      </div>
      <Filters {...{ search, setSearch, status, setStatus }} placeholder="Search categories..." />

      {visible.length === 0 ? (
        <EmptyState message="No categories match. Add one like 'Pizza' or 'Drinks'." />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{c.name}</p>
                <StatusPill active={c.active} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" disabled={saving} onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button
                  variant={c.active ? "secondary" : "primary"}
                  className="w-full"
                  disabled={saving}
                  onClick={() => send(`/api/restaurant/categories/${c.id}`, "PATCH", { active: !c.active })}
                >
                  {c.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    if (confirm(`Delete category "${c.name}"?`)) send(`/api/restaurant/categories/${c.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal saving={saving} title={editing ? "Edit Category" : "Add Category"} onClose={() => setOpen(false)} onSave={save}>
          <Label>Category Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pizza" />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Menu Items ------------------------------- */

function MenuItemsTab({
  items,
  categories,
  send,
  saving,
}: {
  items: MenuItemWithSizes[];
  categories: MenuCategory[];
  send: Send;
  saving: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemWithSizes | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [hasSizes, setHasSizes] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sizes, setSizes] = useState<SizeRow[]>([]);

  const defaultSizes: SizeRow[] = [
    { name: "Small", price: "" },
    { name: "Medium", price: "" },
    { name: "Large", price: "" },
  ];

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCategoryId("");
    setDescription("");
    setPrice("");
    setHasSizes(false);
    setImageUrl(null);
    setSizes(defaultSizes);
    setOpen(true);
  };

  const openEdit = (item: MenuItemWithSizes) => {
    setEditing(item);
    setName(item.name);
    setCategoryId(String(item.categoryId ?? ""));
    setDescription(item.description ?? "");
    setPrice(String(item.price));
    setHasSizes(item.hasSizes);
    setImageUrl(item.imageUrl ?? null);
    setSizes(item.sizes.length ? item.sizes.map((s) => ({ name: s.name, price: String(s.price) })) : defaultSizes);
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      name,
      categoryId: categoryId || null,
      description,
      price: hasSizes ? 0 : Number(price || 0),
      hasSizes,
      imageUrl: imageUrl ?? "",
      sizes: hasSizes
        ? sizes.filter((s) => s.name.trim()).map((s) => ({ name: s.name, price: Number(s.price || 0) }))
        : [],
    };
    const ok = editing
      ? await send(`/api/restaurant/menu-items/${editing.id}`, "PATCH", payload)
      : await send("/api/restaurant/menu-items", "POST", payload);
    if (ok) setOpen(false);
  };

  const visible = items.filter(
    (i) =>
      matches(i.name, i.active, search, status) &&
      (categoryFilter === "all" || String(i.categoryId) === categoryFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} disabled={saving}>+ Add Menu Item</Button>
      </div>
      <Filters {...{ search, setSearch, status, setStatus }} placeholder="Search items (pizza, water, drink)..." />
      <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {visible.length === 0 ? (
        <EmptyState message="No menu items match. Add pizzas, cold drinks, water and more." />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.categoryName ?? "Uncategorised"}</p>
                  {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                </div>
                </div>
                <StatusPill active={item.active} />
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {item.hasSizes ? (
                  item.sizes.map((s) => (
                    <Badge key={s.id} className="border border-indigo-200 bg-indigo-50 text-indigo-700">
                      {s.name}: {formatCurrency(s.price)}
                    </Badge>
                  ))
                ) : (
                  <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                    {formatCurrency(item.price)}
                  </Badge>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" disabled={saving} onClick={() => openEdit(item)}>
                  Edit
                </Button>
                <Button
                  variant={item.active ? "secondary" : "primary"}
                  className="w-full"
                  disabled={saving}
                  onClick={() => send(`/api/restaurant/menu-items/${item.id}`, "PATCH", { active: !item.active })}
                >
                  {item.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    if (confirm(`Delete "${item.name}"?`)) send(`/api/restaurant/menu-items/${item.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={editing ? "Edit Menu Item" : "Add Menu Item"}
          onClose={() => setOpen(false)}
          onSave={save}
          saveLabel={editing ? "Save Changes" : "Add Item"}
        >
          <div className="space-y-3">
            <div>
              <Label>Item Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Large Cold Drink" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <ImagePicker value={imageUrl} onChange={setImageUrl} label="Menu Item Image (optional)" />

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={hasSizes} onChange={(e) => setHasSizes(e.target.checked)} />
              This item has sizes (e.g. Pizza: Small / Medium / Large)
            </label>

            {!hasSizes ? (
              <div>
                <Label>Price (Rs.)</Label>
                <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pizza Size Prices</p>
                {sizes.map((s, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={s.name}
                      placeholder="Size"
                      onChange={(e) => setSizes(sizes.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    />
                    <Input
                      type="number"
                      min="0"
                      value={s.price}
                      placeholder="Price"
                      onChange={(e) => setSizes(sizes.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))}
                    />
                    <Button variant="ghost" onClick={() => setSizes(sizes.filter((_, i) => i !== idx))}>
                      ✕
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setSizes([...sizes, { name: "", price: "" }])}>
                  + Add Size
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------- Deals --------------------------------- */

function DealsTab({ deals, items, send, saving }: { deals: DealWithItems[]; items: MenuItemWithSizes[]; send: Send; saving: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [dealImage, setDealImage] = useState<string | null>(null);
  const [lines, setLines] = useState<DealLine[]>([{ menuItemId: "", sizeId: "", quantity: "1" }]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setDescription("");
    setDealImage(null);
    setLines([{ menuItemId: "", sizeId: "", quantity: "1" }]);
    setOpen(true);
  };

  const openEdit = (deal: DealWithItems) => {
    setEditing(deal);
    setName(deal.name);
    setPrice(String(deal.price));
    setDescription(deal.description ?? "");
    setDealImage(deal.imageUrl ?? null);
    setLines(
      deal.items.length
        ? deal.items.map((i) => ({
            menuItemId: String(i.menuItemId ?? ""),
            sizeId: String(i.sizeId ?? ""),
            quantity: String(i.quantity),
          }))
        : [{ menuItemId: "", sizeId: "", quantity: "1" }]
    );
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      name,
      price: Number(price || 0),
      description,
      imageUrl: dealImage ?? "",
      items: lines
        .filter((l) => l.menuItemId)
        .map((l) => ({
          menuItemId: Number(l.menuItemId),
          sizeId: l.sizeId ? Number(l.sizeId) : null,
          quantity: Number(l.quantity || 1),
        })),
    };
    const ok = editing
      ? await send(`/api/restaurant/deals/${editing.id}`, "PATCH", payload)
      : await send("/api/restaurant/deals", "POST", payload);
    if (ok) setOpen(false);
  };

  const visible = deals.filter((d) => matches(d.name, d.active, search, status));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} disabled={saving}>+ Add Deal</Button>
      </div>
      <Filters {...{ search, setSearch, status, setStatus }} placeholder="Search deals..." />

      {visible.length === 0 ? (
        <EmptyState message="No deals match. A deal bundles items at one fixed price." />
      ) : (
        <div className="space-y-3">
          {visible.map((deal) => (
            <Card key={deal.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  {deal.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={deal.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{deal.name}</p>
                  <p className="text-sm font-medium text-indigo-700">{formatCurrency(deal.price)} (fixed)</p>
                  {deal.description && <p className="mt-1 text-sm text-slate-600">{deal.description}</p>}
                </div>
                </div>
                <StatusPill active={deal.active} />
              </div>

              <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                {deal.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity} × {i.menuItemName}
                    {i.sizeName ? ` (${i.sizeName})` : ""}
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" disabled={saving} onClick={() => openEdit(deal)}>
                  Edit
                </Button>
                <Button
                  variant={deal.active ? "secondary" : "primary"}
                  className="w-full"
                  disabled={saving}
                  onClick={() => send(`/api/restaurant/deals/${deal.id}`, "PATCH", { active: !deal.active })}
                >
                  {deal.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    if (confirm(`Delete deal "${deal.name}"?`)) send(`/api/restaurant/deals/${deal.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={editing ? "Edit Deal" : "Add Deal"}
          onClose={() => setOpen(false)}
          onSave={save}
          saveLabel={editing ? "Save Changes" : "Add Deal"}
        >
          <div className="space-y-3">
            <div>
              <Label>Deal Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family Deal 1" />
            </div>
            <div>
              <Label>Fixed Deal Price (Rs.)</Label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <ImagePicker value={dealImage} onChange={setDealImage} label="Deal Image (optional)" />

            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deal Items</p>
              {lines.map((line, idx) => {
                const item = items.find((i) => String(i.id) === line.menuItemId);
                return (
                  <div key={idx} className="space-y-2 border-b border-slate-100 pb-2 last:border-0">
                    <Select
                      value={line.menuItemId}
                      onChange={(e) =>
                        setLines(lines.map((l, i) => (i === idx ? { ...l, menuItemId: e.target.value, sizeId: "" } : l)))
                      }
                    >
                      <option value="">Select item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                    <div className="flex gap-2">
                      {item?.hasSizes && (
                        <Select
                          value={line.sizeId}
                          onChange={(e) =>
                            setLines(lines.map((l, i) => (i === idx ? { ...l, sizeId: e.target.value } : l)))
                          }
                        >
                          <option value="">Any size</option>
                          {item.sizes.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      )}
                      <Input
                        type="number"
                        min="1"
                        value={line.quantity}
                        placeholder="Qty"
                        onChange={(e) =>
                          setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                        }
                      />
                      <Button variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                variant="secondary"
                onClick={() => setLines([...lines, { menuItemId: "", sizeId: "", quantity: "1" }])}
              >
                + Add Item
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------- Extras --------------------------------- */

function ExtrasTab({ extras, send, saving }: { extras: MenuExtra[]; send: Send; saving: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuExtra | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const openAdd = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setOpen(true);
  };
  const openEdit = (x: MenuExtra) => {
    setEditing(x);
    setName(x.name);
    setPrice(String(x.price));
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name, price: Number(price || 0) };
    const ok = editing
      ? await send(`/api/restaurant/extras/${editing.id}`, "PATCH", payload)
      : await send("/api/restaurant/extras", "POST", payload);
    if (ok) setOpen(false);
  };

  const visible = extras.filter((x) => matches(x.name, x.active, search, status));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} disabled={saving}>+ Add Extra</Button>
      </div>
      <Filters {...{ search, setSearch, status, setStatus }} placeholder="Search extras..." />

      {visible.length === 0 ? (
        <EmptyState message="No extras match. Add things like extra cheese or sauces." />
      ) : (
        <div className="space-y-3">
          {visible.map((x) => (
            <Card key={x.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{x.name}</p>
                  <p className="text-sm text-slate-600">{formatCurrency(x.price)}</p>
                </div>
                <StatusPill active={x.active} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" disabled={saving} onClick={() => openEdit(x)}>
                  Edit
                </Button>
                <Button
                  variant={x.active ? "secondary" : "primary"}
                  className="w-full"
                  disabled={saving}
                  onClick={() => send(`/api/restaurant/extras/${x.id}`, "PATCH", { active: !x.active })}
                >
                  {x.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    if (confirm(`Delete extra "${x.name}"?`)) send(`/api/restaurant/extras/${x.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal saving={saving} title={editing ? "Edit Extra" : "Add Extra"} onClose={() => setOpen(false)} onSave={save}>
          <div className="space-y-3">
            <div>
              <Label>Extra Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Extra Cheese" />
            </div>
            <div>
              <Label>Price (Rs.)</Label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- Payment Methods ---------------------------- */

function PaymentsTab({ payments, send, saving }: { payments: PaymentMethod[]; send: Send; saving: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");

  const openAdd = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };
  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setName(m.name);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    const ok = editing
      ? await send(`/api/restaurant/payment-methods/${editing.id}`, "PATCH", { name })
      : await send("/api/restaurant/payment-methods", "POST", { name, sortOrder: payments.length });
    if (ok) setOpen(false);
  };

  const visible = payments.filter((m) => matches(m.name, m.active, search, status));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} disabled={saving}>+ Add Payment Method</Button>
      </div>
      <Filters {...{ search, setSearch, status, setStatus }} placeholder="Search payment methods..." />

      {visible.length === 0 ? (
        <EmptyState message="No payment methods match." />
      ) : (
        <div className="space-y-3">
          {visible.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{m.name}</p>
                <StatusPill active={m.active} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="w-full" disabled={saving} onClick={() => openEdit(m)}>
                  Edit
                </Button>
                <Button
                  variant={m.active ? "secondary" : "primary"}
                  className="w-full"
                  disabled={saving}
                  onClick={() => send(`/api/restaurant/payment-methods/${m.id}`, "PATCH", { active: !m.active })}
                >
                  {m.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    if (confirm(`Delete "${m.name}"? Past orders keep their saved payment method.`))
                      send(`/api/restaurant/payment-methods/${m.id}`, "DELETE");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal saving={saving} title={editing ? "Edit Payment Method" : "Add Payment Method"} onClose={() => setOpen(false)} onSave={save}>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Card" />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------- Modal --------------------------------- */

function Modal({
  title,
  children,
  onClose,
  onSave,
  saveLabel = "Save",
  saving = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
