import Constants from "expo-constants";

/**
 * The Rider App always talks to the SAME backend/database used by the Admin Web App.
 *
 * Resolution order:
 *  1. EXPO_PUBLIC_API_URL environment variable (set at build time, e.g. via `eas.json`)
 *  2. `extra.apiUrl` baked into app.config.js at build time
 *  3. Local dev fallback (Android emulator loopback alias) — DEV BUILDS ONLY
 *
 * IMPORTANT: `mobile/app.config.js` already refuses to produce a real EAS build if
 * EXPO_PUBLIC_API_URL is missing, non-HTTPS, or matches a known temporary/sandbox
 * pattern (this is what caused the "Sandbox Not Found" error on a previous APK).
 * The checks below are a second line of defense so the compiled app also refuses
 * to silently call a dead sandbox URL even if it somehow ended up in a build
 * (e.g. a local Gradle build that bypassed app.config.js's EAS_BUILD check).
 */

const FORBIDDEN_PATTERNS = [/e2b\.app/i, /sandbox/i, /YOUR-PRODUCTION-DOMAIN|REPLACE_/i];
const LOCAL_ONLY_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /10\.0\.2\.2/];

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
const configuredUrl = (process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "").trim();

const DEV_FALLBACK_URL = "http://10.0.2.2:3000";

let resolvedUrl = configuredUrl;
let configError: string | null = null;

if (!configuredUrl) {
  if (__DEV__) {
    // Local development only (Expo Go / emulator) — never reachable in a shipped APK.
    resolvedUrl = DEV_FALLBACK_URL;
  } else {
    configError =
      "This app was built without a backend URL configured. Please contact the administrator — " +
      "the APK needs to be rebuilt with EXPO_PUBLIC_API_URL set to the production backend.";
  }
} else if (FORBIDDEN_PATTERNS.some((p) => p.test(configuredUrl))) {
  configError =
    "This app is pointing at a temporary/development sandbox URL, not the permanent production " +
    "backend. Please contact the administrator to get an updated version of the app.";
} else if (!__DEV__ && LOCAL_ONLY_PATTERNS.some((p) => p.test(configuredUrl))) {
  configError =
    "This app is pointing at a local development address, which is not reachable from this device. " +
    "Please contact the administrator to get an updated version of the app.";
}

/** The resolved backend base URL. Only meaningful when `API_CONFIG_ERROR` is null. */
export const API_BASE_URL = resolvedUrl;

/**
 * Non-null when the app has no valid, permanent backend URL configured. The UI should
 * show this message instead of attempting (and failing) network requests.
 */
export const API_CONFIG_ERROR = configError;
