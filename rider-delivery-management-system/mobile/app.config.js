// Dynamic Expo config (replaces app.json) so we can VALIDATE the backend URL at
// config-evaluation time. This runs during `expo start`, `expo prebuild`, and
// every EAS Build — so a build can no longer silently succeed while pointing at
// a dead/temporary URL (like a development sandbox link).

/**
 * URL patterns that must NEVER be shipped in a real build. This is exactly the
 * class of bug that caused "Sandbox Not Found": someone pointed the app at a
 * temporary cloud dev-sandbox preview link instead of a permanent backend.
 */
const FORBIDDEN_PATTERNS = [
  { pattern: /e2b\.app/i, reason: "an e2b.app development sandbox preview URL" },
  { pattern: /sandbox/i, reason: "a temporary sandbox URL" },
  { pattern: /localhost/i, reason: "localhost (not reachable from a real phone)" },
  { pattern: /127\.0\.0\.1/, reason: "a loopback address (not reachable from a real phone)" },
  { pattern: /10\.0\.2\.2/, reason: "the Android-emulator-only loopback alias" },
  { pattern: /YOUR-PRODUCTION-DOMAIN|REPLACE_/i, reason: "an unfilled placeholder value" },
];

// EAS Build always sets EAS_BUILD=true, so real cloud/local production builds are
// always strictly validated. Plain `expo start` (local development) is allowed to
// fall back to a dev URL so engineers can still iterate without a live backend.
const isRealBuild = process.env.EAS_BUILD === "true" || process.env.EXPO_PUBLIC_STRICT_CONFIG === "true";

function assertValidBackendUrl(url) {
  if (!isRealBuild) return; // local `expo start` — allow the dev fallback in src/config.ts

  if (!url || typeof url !== "string" || url.trim().length === 0) {
    throw new Error(
      "\n\n🚫 RiderDash build blocked: EXPO_PUBLIC_API_URL is not set.\n" +
        "Set it to your PERMANENT production backend URL (e.g. https://riderdash.example.com)\n" +
        "in mobile/eas.json (build.<profile>.env.EXPO_PUBLIC_API_URL) or mobile/.env before building.\n" +
        "See mobile/README.md for the full deployment + build steps.\n\n"
    );
  }

  if (!/^https:\/\//i.test(url)) {
    throw new Error(
      `\n\n🚫 RiderDash build blocked: EXPO_PUBLIC_API_URL ("${url}") must start with https://.\n` +
        "A real production backend must be served over HTTPS.\n\n"
    );
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `\n\n🚫 RiderDash build blocked: EXPO_PUBLIC_API_URL ("${url}") looks like ${reason}.\n` +
          "This is exactly the bug that caused 'Sandbox Not Found' on a previously built APK.\n" +
          "Deploy the Next.js backend to a PERMANENT host (Vercel, Railway, Render, etc.),\n" +
          "then set EXPO_PUBLIC_API_URL to that permanent https:// domain and rebuild.\n" +
          "See mobile/README.md → 'Deploy a permanent backend' for step-by-step instructions.\n\n"
      );
    }
  }
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
assertValidBackendUrl(apiUrl);

module.exports = {
  expo: {
    name: "RiderDash Rider",
    slug: "riderdash-rider",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "riderdash",
    android: {
      package: "com.riderdash.rider",
      // INTERNET: required for all API calls. POST_NOTIFICATIONS/VIBRATE/RECEIVE_BOOT_COMPLETED
      // are required (Android 13+) for push notifications delivered via expo-notifications.
      permissions: ["INTERNET", "POST_NOTIFICATIONS", "VIBRATE", "RECEIVE_BOOT_COMPLETED"],
    },
    // expo-notifications wires up the native Android notification channel/receiver
    // config automatically at build time (no google-services.json needed client-side;
    // FCM push routing credentials are configured once via `eas credentials` — see
    // mobile/README.md).
    plugins: [
      [
        "expo-notifications",
        {
          color: "#4f46e5",
        },
      ],
    ],
    extra: {
      // Baked into the compiled app so src/config.ts can read it at runtime too
      // (belt-and-suspenders alongside the EXPO_PUBLIC_API_URL env var).
      apiUrl,
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? "REPLACE_WITH_EAS_PROJECT_ID",
      },
    },
  },
};
