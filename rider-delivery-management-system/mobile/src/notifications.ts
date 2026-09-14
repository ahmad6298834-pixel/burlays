import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Controls how notifications are presented while the Rider App is in the foreground.
 * Without this, Android silently drops foreground notifications instead of showing
 * a banner + sound like it does automatically for background/killed-app delivery.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_CHANNEL_ID = "orders";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Order Notifications",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#4f46e5",
    sound: "default",
  });
}

export type PushRegistrationResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

/**
 * Requests Android notification permission (required at runtime on Android 13+) and
 * returns this device's Expo push token, ready to send to the backend. Returns
 * "unsupported" on simulators/emulators, which cannot receive real push notifications.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  try {
    if (!Device.isDevice) {
      return { status: "unsupported" };
    }

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      return { status: "denied" };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return { status: "granted", token: tokenResponse.data };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Extracts the orderId (if any) from a notification's data payload. */
export function getOrderIdFromNotification(data: Record<string, unknown> | undefined): number | null {
  if (!data) return null;
  const raw = data.orderId;
  if (raw === undefined || raw === null) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}
