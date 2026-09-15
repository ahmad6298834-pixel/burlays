import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, clearPushToken, fetchMe, login as apiLogin, registerPushToken } from "./api";
import { registerForPushNotifications } from "./notifications";
import type { Rider } from "./types";

const TOKEN_KEY = "riderdash_token";

type AuthContextValue = {
  token: string | null;
  rider: Rider | null;
  loading: boolean;
  error: string | null;
  pushStatus: "idle" | "granted" | "denied" | "unsupported" | "error";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Requests permission + registers this device's Expo push token with the backend. */
async function syncPushToken(authToken: string) {
  const result = await registerForPushNotifications();
  if (result.status === "granted") {
    try {
      await registerPushToken(authToken, result.token);
    } catch {
      // Non-fatal — the rider can still use the app without push notifications.
    }
  }
  return result.status;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<AuthContextValue["pushStatus"]>("idle");

  // Restore session on app start, and immediately re-validate the rider is still
  // active — a deactivated rider must be signed out even with a saved token.
  useEffect(() => {
    (async () => {
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setLoading(false);
        return;
      }
      try {
        const me = await fetchMe(savedToken);
        setToken(savedToken);
        setRider(me);
        const status = await syncPushToken(savedToken);
        setPushStatus(status);
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await apiLogin(email, password);
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setRider(result.rider);
      const status = await syncPushToken(result.token);
      setPushStatus(status);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await clearPushToken(token);
      } catch {
        // Ignore — logging out locally must always succeed even if this call fails.
      }
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRider(null);
    setPushStatus("idle");
  }, [token]);

  const value = useMemo(
    () => ({ token, rider, loading, error, pushStatus, login, logout }),
    [token, rider, loading, error, pushStatus, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
