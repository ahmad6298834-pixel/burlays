"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type {
  DealWithItems,
  Location,
  MenuCategory,
  MenuExtra,
  MenuItemWithSizes,
  PaymentMethod,
  RestaurantOrderFull,
  RestaurantSettings,
  Rider,
  RestaurantOrderType,
} from "@/types";

/** A line held in the local cart before the order is saved. */
type CartLine = {
  key: string;
  lineType: "item" | "deal";
  menuItemId: number | null;
  dealId: number | null;
  name: string;
  sizeId: number | null;
  sizeName: string | null;
  unitPrice: number;
  quantity: number;
  extras: { id: number; name: string; price: number }[];
};

export default function EditRestaurantOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const orderId = Number(id);

  const [order, setOrder] = useState<RestaurantOrderFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [orderType, setOrderType] = useState<RestaurantOrderType>("dine-in");
  const [orderNumber, setOrderNumber] = useState("");

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItemWithSizes[]>([]);
  const [deals, setDeals] = useState<DealWithItems[]>([]);
  const [extras, setExtras] = useState<MenuExtra[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const locationsRef = useRef<Location[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [locationId, setLocationId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [customerDeliveryCharge, setCustomerDeliveryCharge] = useState("0");
  const [riderEarning, setRiderEarning] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentOptions, setPaymentOptions] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [itemPrompt, setItemPrompt] = useState<MenuItemWithSizes | null>(null);
  const [promptSizeId, setPromptSizeId] = useState<number | null>(null);
  const [promptExtras, setPromptExtras] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    fetch("/api/restaurant/categories")
      .then((r) => r.json())
      .then(setCategories);
    fetch("/api/restaurant/menu-items")
      .then((r) => r.json())
      .then((d: MenuItemWithSizes[]) => setItems(d.filter((i) => i.active)));
    fetch("/api/restaurant/deals")
      .then((r) => r.json())
      .then((d: DealWithItems[]) => setDeals(d.filter((x) => x.active)));
    fetch("/api/restaurant/payment-methods")
      .then((r) => r.json())
      .then((d: PaymentMethod[]) => setPaymentOptions(d.filter((m) => m.active)));
    fetch("/api/restaurant/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch("/api/restaurant/extras")
      .then((r) => r.json())
      .then((d: MenuExtra[]) => setExtras(d.filter((x) => x.active)));
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: Location[]) => {
        const active = d.filter((l) => l.active);
        locationsRef.current = active;
        setLocations(active);
      });
    fetch("/api/riders")
      .then((r) => r.json())
      .then((d: (Rider & { active: boolean })[]) => setRiders(d.filter((r) => r.active)));
  }, []);

  // Load the existing order once and pre-fill every editable field in place.
  useEffect(() => {
    fetch(`/api/restaurant/orders/${orderId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RestaurantOrderFull | null) => {
        if (!d?.id) {
          setLoading(false);
          return;
        }
        setOrder(d);
        setOrderType(d.orderType as RestaurantOrderType);
        setOrderNumber(d.orderNumber);
        setCustomerName(d.customerName ?? "");
        setCustomerPhone(d.customerPhone ?? "");
        setLocationId(d.locationId ? String(d.locationId) : "");
        setRiderId(d.riderId ? String(d.riderId) : "");
        setCustomerDeliveryCharge(String(d.customerDeliveryCharge ?? "0"));
        setRiderEarning(Number(d.riderDeliveryEarning ?? 0));
        setPaymentMethod(d.paymentMethod);
        // Rebuild the cart exactly as the POS would have created it, so torn-down
        // line modifiers (sizes/extras/deal contents) survive the round trip.
        const cartFromOrder: CartLine[] = (d.items ?? []).map((line) => {
          if (line.lineType === "deal") {
            const key = `deal-${line.dealId}`;
            return {
              key,
              lineType: "deal",
              menuItemId: null,
              dealId: line.dealId,
              name: line.name,
              sizeId: null,
              sizeName: null,
              unitPrice: Number(line.unitPrice),
              quantity: line.quantity,
              extras: [],
            };
          }
          const extrasForKey = line.extras.map((e) => e.extraId ?? 0).sort();
          const key = `item-${line.menuItemId}-${line.sizeId ?? 0}-${extrasForKey.join(".")}`;
          return {
            key,
            lineType: "item",
            menuItemId: line.menuItemId,
            dealId: null,
            name: line.name,
            sizeId: line.sizeId,
            sizeName: line.sizeName,
            unitPrice: Number(line.unitPrice),
            quantity: line.quantity,
            extras: line.extras.map((e) => ({
              id: Number(e.extraId),
              name: e.name,
              price: Number(e.price),
            })),
          };
        });
        setCart(cartFromOrder);
        setLoading(false);
        setLoaded(true);
      });
  }, [orderId]);

  const applyLocation = (newLocationId: string) => {
    setLocationId(newLocationId);
    const loc = locationsRef.current.find((l) => String(l.id) === newLocationId);
    if (loc) {
      setRiderEarning(Number(loc.deliveryCharge));
      setCustomerDeliveryCharge(String(loc.deliveryCharge));
    } else {
      setRiderEarning(0);
    }
  };

  const selectItem = (item: MenuItemWithSizes) => {
    if (!item.hasSizes && extras.length === 0) {
      addToCart(item, null, []);
      return;
    }
    setItemPrompt(item);
    setPromptSizeId(item.hasSizes ? null : 0);
    setPromptExtras([]);
  };

  const addToCart = (item: MenuItemWithSizes, sizeId: number | null, extraIds: number[]) => {
    const size = sizeId ? item.sizes.find((s) => s.id === sizeId) : undefined;
    const chosen = extraIds
      .map((id) => extras.find((e) => e.id === id))
      .filter((e): e is MenuExtra => Boolean(e))
      .map((e) => ({ id: e.id, name: e.name, price: Number(e.price) }));

    const base = size ? Number(size.price) : Number(item.price);
    const unitPrice = base + chosen.reduce((sum, e) => sum + e.price, 0);
    const key = `item-${item.id}-${size?.id ?? 0}-${chosen.map((e) => e.id).sort().join(".")}`;

    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        {
          key,
          lineType: "item",
          menuItemId: item.id,
          dealId: null,
          name: item.name,
          sizeId: size?.id ?? null,
          sizeName: size?.name ?? null,
          unitPrice,
          quantity: 1,
          extras: chosen,
        },
      ];
    });
    setItemPrompt(null);
  };

  const addDeal = (deal: DealWithItems) => {
    const key = `deal-${deal.id}`;
    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        {
          key,
          lineType: "deal",
          menuItemId: null,
          dealId: deal.id,
          name: deal.name,
          sizeId: null,
          sizeName: null,
          unitPrice: Number(deal.price),
          quantity: 1,
          extras: [],
        },
      ];
    });
  };

  const changeQty = (key: string, delta: number) =>
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const isDelivery = orderType === "delivery";
  const custCharge = isDelivery ? Number(customerDeliveryCharge) || 0 : 0;
  const total = subtotal + custCharge;

  const visibleItems = items.filter(
    (i) =>
      (activeCategory === "all" || String(i.categoryId) === activeCategory) &&
      i.name.toLowerCase().includes(search.toLowerCase())
  );

  // Payment creations/deactivations can retire a method the order still uses;
  // keep it selectable so the slip keeps printing the existing value.
  const paymentChoices: { id: number; name: string }[] = paymentOptions.some((m) => m.name === paymentMethod)
    ? paymentOptions
    : [{ id: -1, name: paymentMethod }, ...paymentOptions];

  const save = async () => {
    setError("");
    if (cart.length === 0) return setError("Cart is empty — add at least one item");
    setSaving(true);

    const res = await fetch(`/api/restaurant/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType,
        customerName: orderType === "dine-in" ? null : customerName,
        customerPhone: orderType === "dine-in" ? null : customerPhone,
        locationId: isDelivery ? (locationId ? Number(locationId) : null) : null,
        riderId: isDelivery ? (riderId ? Number(riderId) : null) : null,
        customerDeliveryCharge: custCharge,
        paymentMethod,
        lines: cart.map((l) => ({
          lineType: l.lineType,
          menuItemId: l.menuItemId,
          dealId: l.dealId,
          sizeId: l.sizeId,
          quantity: l.quantity,
          extraIds: l.extras.map((e) => e.id),
        })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update order");
      return;
    }
    const saved = await res.json();
    setOrder(saved);
    setUpdated(true);
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading order...</div>;
  if (!loaded || !order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  const showCustomer = orderType !== "dine-in";

  return (
    <div>
      <PageHeader
        title={`${settings?.name ?? RESTAURANT_NAME} — Update Order`}
        subtitle={`Updating ${orderNumber} in place. The order number and id never change.`}
        action={
          <Button variant="secondary" onClick={() => router.push("/restaurant/orders")}>
            ← Back to Orders
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {updated && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-800">Order updated successfully.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => router.push(`/restaurant/orders/${orderId}/receipt`)}>
              🧾 Print Customer Receipt
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/restaurant/orders/${orderId}/kitchen`)}>
              👨‍🍳 Print Kitchen Ticket
            </Button>
            <Button variant="secondary" onClick={() => router.push("/restaurant/orders")}>
              Go to Orders
            </Button>
          </div>
        </Card>
      )}

      {/* Order type + number (fixed while editing) */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label>Order Type</Label>
            <p className="text-sm font-semibold text-slate-900">
              {ORDER_TYPE_LABELS[orderType]} <span className="font-normal text-slate-500">(locked while editing)</span>
            </p>
          </div>
          <div className="sm:text-right">
            <Label>Order Number (unchanged)</Label>
            <p className="font-mono text-lg font-bold text-slate-900">{orderNumber}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* -------------------------------- MENU -------------------------------- */}
        <div className="lg:col-span-2">
          <Card className="mb-4">
            <Input placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  activeCategory === "all" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                All
              </button>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(String(c.id))}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeCategory === String(c.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </Card>

          {deals.length > 0 && activeCategory === "all" && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Deals</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {deals.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => addDeal(d)}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left hover:bg-amber-100"
                  >
                    <div className="mb-2 grid h-20 w-full place-items-center overflow-hidden rounded-lg bg-amber-100">
                      {d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl text-amber-300">🎁</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                    <p className="text-sm font-bold text-amber-700">{formatCurrency(d.price)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {d.items.map((i) => `${i.quantity}× ${i.menuItemName}`).join(", ")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <h3 className="mb-2 text-sm font-semibold text-slate-700">Menu Items</h3>
          {visibleItems.length === 0 ? (
            <EmptyState message="No menu items found. Add them in Burlays Menu." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="mb-2 grid h-20 w-full place-items-center overflow-hidden rounded-lg bg-slate-50">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl text-slate-300">🍽️</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-sm text-indigo-700">
                    {item.hasSizes
                      ? `${formatCurrency(Math.min(...item.sizes.map((s) => Number(s.price))))}+`
                      : formatCurrency(item.price)}
                  </p>
                  {item.hasSizes && <p className="mt-1 text-xs text-slate-400">Choose size</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* -------------------------------- CART -------------------------------- */}
        <div className="space-y-4">
          {showCustomer && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Customer</h3>
              <div className="space-y-3">
                <div>
                  <Label>Customer Phone {orderType === "takeaway" ? "(optional)" : ""}</Label>
                  <Input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="03001234567"
                  />
                </div>
                <div>
                  <Label>Customer Name {orderType === "takeaway" ? "(optional)" : ""}</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>

                {isDelivery && (
                  <>
                    <div>
                      <Label>Delivery Location</Label>
                      <Select value={locationId} onChange={(e) => applyLocation(e.target.value)}>
                        <option value="">Select location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Rider (optional — can assign later)</Label>
                      <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                        <option value="">Not assigned</option>
                        {riders.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Customer Delivery Charge (Rs.)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={customerDeliveryCharge}
                        onChange={(e) => setCustomerDeliveryCharge(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-400">Billed to the customer and shown on the receipt.</p>
                    </div>
                    {locationId && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rider Delivery Earning
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(riderEarning)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          From the location&apos;s configuration. Internal only — not on the customer receipt and not
                          added to the customer total.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {paymentChoices.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Cart ({cart.length})</h3>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No items yet. Tap a menu item to add it.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((l) => (
                  <div key={l.key} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {l.name}
                          {l.sizeName ? ` (${l.sizeName})` : ""}
                        </p>
                        {l.extras.length > 0 && (
                          <p className="text-xs text-slate-500">{l.extras.map((e) => `+ ${e.name}`).join(", ")}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          {formatCurrency(l.unitPrice)} each
                          {l.lineType === "deal" && <Badge className="ml-1 bg-amber-100 text-amber-700">Deal</Badge>}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(l.unitPrice * l.quantity)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="secondary" onClick={() => changeQty(l.key, -1)}>
                        −
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                      <Button variant="secondary" onClick={() => changeQty(l.key, 1)}>
                        +
                      </Button>
                      <Button variant="ghost" className="ml-auto text-rose-600" onClick={() => removeLine(l.key)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {isDelivery && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery Charge</span>
                  <span className="font-medium">{formatCurrency(custCharge)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Button className="mt-4 w-full" onClick={save} disabled={saving || cart.length === 0}>
              {saving ? "Saving..." : "💾 Save Changes"}
            </Button>
          </Card>
        </div>
      </div>

      {/* Size + extras chooser */}
      {itemPrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">{itemPrompt.name}</h2>
            <p className="mb-4 text-sm text-slate-500">
              {itemPrompt.hasSizes ? "Select a size" : "Add extras (optional)"}
            </p>

            {itemPrompt.hasSizes && (
              <div className="mb-4 space-y-2">
                {itemPrompt.sizes
                  .filter((s) => s.active)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPromptSizeId(s.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                        promptSizeId === s.id
                          ? "border-indigo-600 bg-indigo-50"
                          : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
                      }`}
                    >
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="font-semibold text-indigo-700">{formatCurrency(s.price)}</span>
                    </button>
                  ))}
              </div>
            )}

            {extras.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Extras / Add-ons</p>
                <div className="space-y-1">
                  {extras.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={promptExtras.includes(e.id)}
                          onChange={(ev) =>
                            setPromptExtras((prev) =>
                              ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id)
                            )
                          }
                        />
                        {e.name}
                      </span>
                      <span className="text-slate-600">+{formatCurrency(e.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setItemPrompt(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={itemPrompt.hasSizes && !promptSizeId}
                onClick={() => addToCart(itemPrompt, promptSizeId || null, promptExtras)}
              >
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}