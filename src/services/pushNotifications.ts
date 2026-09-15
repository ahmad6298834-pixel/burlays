/**
 * Sends push notifications to the Rider Android app via the Expo Push Notification
 * Service — Expo's own hosted, production push-delivery infrastructure (built on top
 * of FCM for Android). This is the standard, production-grade mechanism for any app
 * built with Expo/React Native; it is NOT a temporary development sandbox and works
 * correctly whether the Rider App is in the foreground, background, or fully closed.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * For this to actually deliver on a real device, the Rider APK must be built with EAS
 * and have FCM push credentials configured once via `eas credentials` (see
 * mobile/README.md). No extra work is required in this backend beyond calling the
 * Expo push endpoint — Expo handles routing to FCM automatically.
 */

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

function isValidExpoPushToken(token: string | null | undefined): token is string {
  return typeof token === "string" && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

/**
 * Sends a single push notification. Failures are logged but never thrown — a push
 * delivery problem must never block or fail the order create/update API request.
 */
export async function sendPushNotification(token: string | null | undefined, payload: PushPayload): Promise<void> {
  if (!isValidExpoPushToken(token)) return;

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        channelId: "orders",
        priority: "high",
      }),
    });

    if (!res.ok) {
      console.error("Expo push notification request failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Failed to send push notification", err);
  }
}

export type NotifiableRider = {
  id: number;
  active: boolean;
  pushToken: string | null;
};

export type NotifiableOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  locationName: string;
  deliveryCharge: number | string;
};

/**
 * "New Order Ready" notification sent whenever an order is (re)assigned to a rider
 * and is still in the "Assigned" state. Deactivated riders and riders without a
 * registered device are silently skipped (a deactivated rider must never receive
 * new-order notifications).
 */
export async function notifyRiderOfNewOrder(rider: NotifiableRider, order: NotifiableOrder): Promise<void> {
  if (!rider.active || !rider.pushToken) return;

  await sendPushNotification(rider.pushToken, {
    title: "New Order Ready",
    body: `Order #${order.orderNumber} is ready for delivery.`,
    data: {
      type: "new_order",
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      locationName: order.locationName,
      deliveryCharge: order.deliveryCharge,
    },
  });
}
