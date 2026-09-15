import type { InferSelectModel } from "drizzle-orm";
import type { riders, locations, orders, riderTransactions, customers } from "@/db/schema";

export type Rider = InferSelectModel<typeof riders>;
export type Location = InferSelectModel<typeof locations>;
export type Order = InferSelectModel<typeof orders>;
export type RiderTransaction = InferSelectModel<typeof riderTransactions>;
export type Customer = InferSelectModel<typeof customers>;

export type RiderFinancials = {
  riderId: number;
  deliveredCount: number;
  earnings: number;
  advances: number;
  payments: number;
  adjustments: number;
  balance: number;
};

export type RiderWithFinancials = Omit<Rider, "passwordHash" | "pushToken"> & {
  hasAppLogin: boolean;
  financials: RiderFinancials;
};

export const PAYMENT_METHODS = ["Cash", "Online", "Other"] as const;
export const ORDER_STATUSES = ["Assigned", "Delivered", "Cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/* ---------- Burlays Restaurant module ---------- */
import type {
  menuCategories,
  menuItems,
  menuItemSizes,
  menuExtras,
  deals,
  dealItems,
  paymentMethods,
  restaurantSettings,
} from "@/db/schema";

export type MenuCategory = InferSelectModel<typeof menuCategories>;
export type MenuItem = InferSelectModel<typeof menuItems>;
export type MenuItemSize = InferSelectModel<typeof menuItemSizes>;
export type MenuExtra = InferSelectModel<typeof menuExtras>;
export type Deal = InferSelectModel<typeof deals>;
export type DealItem = InferSelectModel<typeof dealItems>;

export type MenuItemWithSizes = MenuItem & {
  categoryName: string | null;
  sizes: MenuItemSize[];
};

export type DealWithItems = Deal & { items: DealItem[] };

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type RestaurantSettings = InferSelectModel<typeof restaurantSettings>;

/**
 * Fallback restaurant name used only until the database-backed settings row
 * loads. The authoritative value always comes from `restaurant_settings`.
 */
export const RESTAURANT_NAME = "Burlays";

/* ---------- Burlays POS orders ---------- */
import type {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderDealItems,
  restaurantOrderItemExtras,
} from "@/db/schema";

export type RestaurantOrder = InferSelectModel<typeof restaurantOrders>;
export type RestaurantOrderItem = InferSelectModel<typeof restaurantOrderItems>;
export type RestaurantOrderDealItem = InferSelectModel<typeof restaurantOrderDealItems>;

export type RestaurantOrderItemExtra = InferSelectModel<typeof restaurantOrderItemExtras>;

export type RestaurantOrderLine = RestaurantOrderItem & {
  dealItems: RestaurantOrderDealItem[];
  extras: RestaurantOrderItemExtra[];
};
export type RestaurantOrderFull = RestaurantOrder & {
  items: RestaurantOrderLine[];
  /** Live status of the linked delivery order (delivery sales only). */
  deliveryStatus?: string | null;
};

export type RestaurantOrderListRow = RestaurantOrder & { deliveryStatus: string | null };

export const PAYMENT_STATUSES = ["PENDING", "RECEIVED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_TYPES = ["dine-in", "takeaway", "delivery"] as const;
export type RestaurantOrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<RestaurantOrderType, string> = {
  "dine-in": "Dine-In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};
