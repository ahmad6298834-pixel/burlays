import { API_BASE_URL, API_CONFIG_ERROR } from "./config";
import type { Order, Rider, RiderDashboard } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Simple reachability check used by the Login screen's "Test Connection" button. */
export async function checkServerHealth(): Promise<{ ok: boolean; message: string }> {
  if (API_CONFIG_ERROR) {
    return { ok: false, message: API_CONFIG_ERROR };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { method: "GET" });
    if (!res.ok) return { ok: false, message: `Server responded with status ${res.status}.` };
    return { ok: true, message: `Connected to ${API_BASE_URL}` };
  } catch {
    return { ok: false, message: `Could not reach ${API_BASE_URL}. Check your internet connection.` };
  }
}

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  if (API_CONFIG_ERROR) {
    // Fail fast with a clear, human message instead of a confusing network error.
    throw new ApiError(API_CONFIG_ERROR, 0);
  }

  const { token, headers, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    // Network/DNS-level failure — e.g. the configured backend is unreachable or offline.
    throw new ApiError(
      `Unable to reach the server at ${API_BASE_URL}. Please check your internet connection or contact the administrator.`,
      0
    );
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (body && (body.error as string)) || "Something went wrong. Please try again.";
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export function login(email: string, password: string) {
  return request<{ token: string; rider: Rider }>("/api/rider-auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string) {
  return request<Rider>("/api/rider/me", { token });
}

export function fetchDashboard(token: string) {
  return request<RiderDashboard>("/api/rider/dashboard", { token });
}

export function fetchMyOrders(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Order[]>(`/api/rider/orders${query}`, { token });
}

export function fetchOrder(token: string, orderId: number) {
  return request<Order>(`/api/rider/orders/${orderId}`, { token });
}

export function markOrderDelivered(token: string, orderId: number) {
  return request<Order>(`/api/rider/orders/${orderId}/deliver`, { method: "POST", token });
}

/** Registers this device's Expo push token so the backend can send "New Order Ready" pushes. */
export function registerPushToken(token: string, pushToken: string) {
  return request<{ ok: boolean }>("/api/rider/push-token", {
    method: "POST",
    token,
    body: JSON.stringify({ pushToken }),
  });
}

/** Clears the push token on logout so a signed-out device stops receiving pushes. */
export function clearPushToken(token: string) {
  return request<{ ok: boolean }>("/api/rider/push-token", { method: "DELETE", token });
}
