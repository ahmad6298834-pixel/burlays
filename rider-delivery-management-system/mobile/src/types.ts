export type Rider = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};

export type Order = {
  id: number;
  orderNumber: string;
  riderId: number | null;
  riderName: string;
  customerName: string;
  customerPhone: string | null;
  locationId: number | null;
  locationName: string;
  deliveryCharge: number | string;
  totalBill: number | string;
  paymentMethod: string;
  orderDate: string;
  orderTime: string;
  status: "Assigned" | "Delivered" | "Cancelled";
  deliveredDate: string | null;
  deliveredTime: string | null;
  createdAt: string;
};

export type RiderDashboard = {
  riderName: string;
  totalAssignedOrders: number;
  totalDeliveredOrders: number;
  totalPendingOrders: number;
  totalCancelledOrders: number;
  totalOrders: number;
  todayAssignedOrders: number;
  todayDeliveredOrders: number;
  todayDeliveryEarnings: number;
  totalDeliveryEarnings: number;
  date: string;
};
