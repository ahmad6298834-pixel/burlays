import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";

export const riders = pgTable("riders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  // Expo push token for the rider's currently signed-in Android device. Cleared on
  // logout/deactivation so a deactivated rider can never receive new-order pushes.
  pushToken: text("push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deliveryCharge: numeric("delivery_charge", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One record per unique customer phone number. This is the "customer master record"
 * used to auto-fill the Assign Order form. It intentionally holds only the CURRENT
 * best-known name/location for that phone number — every order keeps its own
 * independent snapshot (customerName/customerPhone/locationName/deliveryCharge on the
 * `orders` table), so editing a customer here never rewrites historical orders.
 */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  defaultLocationId: integer("default_location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  defaultLocationName: text("default_location_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  riderId: integer("rider_id").references(() => riders.id, { onDelete: "set null" }),
  riderName: text("rider_name").notNull(),
  customerName: text("customer_name").notNull(),
  // Snapshotted at order time, independent of the `customers` master record, so
  // editing a customer's profile later never changes this historical order.
  customerPhone: text("customer_phone"),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  locationName: text("location_name").notNull(),
  deliveryCharge: numeric("delivery_charge", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  totalBill: numeric("total_bill", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  orderDate: date("order_date").notNull(),
  orderTime: text("order_time").notNull(),
  status: text("status").notNull().default("Assigned"),
  deliveredDate: date("delivered_date"),
  deliveredTime: text("delivered_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riderTransactions = pgTable("rider_transactions", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id")
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // advance | payment | adjustment
  amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ==========================================================================
 * BURLASY RESTAURANT MODULE
 * Additive only — none of the delivery-management tables above are modified.
 * Nothing here is hard-coded: categories, items, sizes, deals and extras are
 * all admin-managed rows. Drinks (Small/Large Cold Drink) and Water are simply
 * menu items inside an admin-created category, so they stay fully configurable.
 * ========================================================================== */

/** Menu categories, e.g. Pizza, Burgers, Drinks. */
export const menuCategories = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A single sellable menu item. `price` is the item's own price and is used
 * whenever `hasSizes` is false. When `hasSizes` is true (e.g. Pizza), the
 * per-size rows in `menuItemSizes` carry the prices instead — so sizes are
 * never forced onto items that don't need them.
 */
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => menuCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  /** Optional picture URL/path. Binary data is NOT stored in Postgres. */
  imageUrl: text("image_url"),
  hasSizes: boolean("has_sizes").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-size pricing (Small / Medium / Large) for items where hasSizes = true. */
export const menuItemSizes = pgTable("menu_item_sizes", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Optional add-ons, e.g. extra cheese, sauces. Flexible and admin-managed. */
export const menuExtras = pgTable("menu_extras", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A deal/combo sold at its own fixed price, independent of its items' prices. */
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  /** Optional picture URL/path. Binary data is NOT stored in Postgres. */
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Line items that make up a deal. `sizeId` is optional and only used for sized
 * items (e.g. "Large Pizza" inside a deal). Item names are snapshotted so a
 * deal's historical composition stays readable even if an item is renamed.
 */
export const dealItems = pgTable("deal_items", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
  menuItemName: text("menu_item_name").notNull(),
  sizeId: integer("size_id").references(() => menuItemSizes.id, { onDelete: "set null" }),
  sizeName: text("size_name"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ==========================================================================
 * BURLASY RESTAURANT — POS ORDERS
 * Separate from the delivery-management `orders` table above, which remains the
 * rider-assignment/earnings record. A restaurant order is the customer-facing
 * sale; a rider delivery assignment is a distinct concern.
 * ========================================================================== */

/**
 * A POS sale. `orderNumber` is UNIQUE at the database level so a duplicate can
 * never be committed even under concurrent saves.
 *
 * Two deliberately separate delivery-charge fields (never mixed):
 *  - `customerDeliveryCharge` — what the customer is billed. Appears on the
 *    customer receipt and is included in `total`.
 *  - `riderDeliveryEarning`   — snapshot of the location's configured charge,
 *    used internally for rider earnings/ledger. NEVER shown on the receipt and
 *    NEVER added to the customer total.
 */
export const restaurantOrders = pgTable("restaurant_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  orderType: text("order_type").notNull(), // dine-in | takeaway | delivery
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  locationName: text("location_name"),
  riderId: integer("rider_id").references(() => riders.id, { onDelete: "set null" }),
  riderName: text("rider_name"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  customerDeliveryCharge: numeric("customer_delivery_charge", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  riderDeliveryEarning: numeric("rider_delivery_earning", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  total: numeric("total", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  /** PENDING until an admin explicitly verifies payment from Restaurant Orders. */
  paymentStatus: text("payment_status").notNull().default("PENDING"),
  paymentVerifiedAt: timestamp("payment_verified_at", { withTimezone: true }),
  paymentVerifiedBy: text("payment_verified_by"),
  status: text("status").notNull().default("New"),
  /** Soft delete: kept so historical reporting stays intact. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /**
   * Idempotency key sent by the POS. Unique, so a double-click / retry that
   * reaches the server twice can never create two orders.
   */
  clientRequestId: text("client_request_id").unique(),
  /**
   * Link to the delivery-management order created for DELIVERY sales only.
   * This is the bridge into the existing Assign Order / rider workflow: the linked
   * row is what the Rider App, rider earnings, ledger and daily reports already
   * read. Dine-in and takeaway orders never create one, so they can never appear
   * in any rider's My Orders.
   */
  deliveryOrderId: integer("delivery_order_id").references(() => orders.id, { onDelete: "set null" }),
  orderDate: date("order_date").notNull(),
  orderTime: text("order_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One cart line. `lineType` is "item" or "deal". All names/prices are snapshotted
 * so historical receipts stay accurate if the menu changes later.
 */
export const restaurantOrderItems = pgTable("restaurant_order_items", {
  id: serial("id").primaryKey(),
  restaurantOrderId: integer("restaurant_order_id")
    .notNull()
    .references(() => restaurantOrders.id, { onDelete: "cascade" }),
  lineType: text("line_type").notNull().default("item"),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  sizeId: integer("size_id").references(() => menuItemSizes.id, { onDelete: "set null" }),
  sizeName: text("size_name"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  lineTotal: numeric("line_total", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The individual products contained in a deal line, snapshotted onto the order. */
export const restaurantOrderDealItems = pgTable("restaurant_order_deal_items", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => restaurantOrderItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sizeName: text("size_name"),
  quantity: integer("quantity").notNull().default(1),
});

/**
 * Extras / add-ons chosen for a specific cart line (e.g. "Extra Cheese" on a pizza).
 * Name and price are snapshotted so historical tickets/receipts stay accurate if the
 * extra is later renamed, repriced or deactivated.
 */
export const restaurantOrderItemExtras = pgTable("restaurant_order_item_extras", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => restaurantOrderItems.id, { onDelete: "cascade" }),
  extraId: integer("extra_id").references(() => menuExtras.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
});

/**
 * Payment methods available in the Burlays POS. Admin-managed so they are no
 * longer hard-coded in the frontend. Kept separate from the rider/delivery
 * module's own payment options, which continue to use their existing constant.
 */
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Single-row table holding the restaurant's own details (name, contact, receipt
 * footer). Read by the POS, customer receipt and kitchen ticket so the branding
 * is database-driven rather than hard-coded.
 */
export const restaurantSettings = pgTable("restaurant_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Burlays"),
  phone: text("phone"),
  address: text("address"),
  receiptFooter: text("receipt_footer").default("Thank you for your order!"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admin users for the back-office. Separate from `riders`, which keep their own
 * credentials for the Rider Android App — the two auth flows never mix.
 * Passwords are always stored as bcrypt hashes, never plain text.
 */
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Super Admin"),
  username: text("username").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("SUPER_ADMIN"),
  /** Bumped on logout / password change so previously issued tokens stop working. */
  sessionVersion: integer("session_version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
