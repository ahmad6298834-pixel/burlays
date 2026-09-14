# RiderDash — Rider Mobile App (Android)

This is the companion **Rider Mobile Application** for the RiderDash Delivery
Management System. It is built with **Expo / React Native** and talks to the
**same backend/database** as the admin web app (no separate backend, no local
storage of business data — everything is fetched live from the API).

## ⚠️ "Sandbox Not Found" — what happened and how it's fixed

If a previously built APK showed **"Sandbox Not Found"** when opened, it means
that build was pointed at a **temporary development preview URL**
(`*.e2b.app`) instead of a permanent backend. That preview link only exists
while a development session is active — once the session ends, the link stops
resolving, and the app can no longer reach any server at all.

**This has been fixed at the code level so it cannot happen silently again:**

- `mobile/app.config.js` now **refuses to produce an EAS build** if
  `EXPO_PUBLIC_API_URL` is missing, non-HTTPS, still a placeholder, or matches
  a known temporary/sandbox pattern (`e2b.app`, `sandbox`, `localhost`,
  `127.0.0.1`, `10.0.2.2`). The build fails immediately with a clear error
  instead of silently producing a broken APK.
- `mobile/src/config.ts` performs the same check again at **runtime**, as a
  second line of defense. If a bad URL somehow still ends up in a build, the
  app shows a clear **"App Not Configured"** screen instead of confusing
  network errors.
- The Login screen now shows the **currently configured server URL** and has
  a **"Test Connection"** button so anyone can instantly verify (from the
  phone itself) whether the app can reach the backend.
- A new script, `npm run verify-backend`, lets you check a URL is reachable
  and safe **before** spending time on a build.

You now simply need to deploy the backend somewhere permanent (see below) and
rebuild — the tooling will not let you repeat this mistake.

## Features

- Rider Login (email/username + password, no public sign-up)
- Rejects login immediately if the admin has deactivated the account
- Rider Dashboard: assigned / delivered / pending / cancelled counts, today's
  stats, today's & total delivery earnings — auto-refreshes every 8 seconds
- My Orders: tabs for Assigned, Delivered, Cancelled — only the logged-in
  rider's own orders are ever shown or reachable; also auto-refreshes
- Order Detail screen — opening an order never changes its status
- Explicit **"Mark as Delivered"** button with a confirmation dialog; only
  then is the order updated in the shared database (updates admin dashboards,
  daily reports, and the rider ledger immediately since they are computed live)
- **Push notifications** ("New Order Ready") via the Expo Push Notification
  Service when the admin assigns (or reassigns) an order to a rider — works
  while the app is foregrounded, backgrounded, or fully closed. Tapping the
  notification opens that order directly.
- Customer phone number shown on orders (matches the Admin Web App's
  phone-based customer lookup)

## Project layout

```
mobile/
  App.tsx                  – app shell / tab navigation + notification-tap routing
  app.config.js            – Expo app config WITH build-time backend URL validation
  scripts/verify-backend.js – standalone reachability/safety checker (run before building)
  src/
    api.ts                 – typed fetch client for the backend API
    config.ts              – resolves + validates the backend base URL at runtime
    notifications.ts       – push permission request + Expo push token registration
    AuthContext.tsx        – login/logout + session persistence + push token sync
    screens/
      LoginScreen.tsx       – login form + "Test Connection" diagnostics
      DashboardScreen.tsx
      MyOrdersScreen.tsx
      OrderDetailScreen.tsx
  eas.json                 – EAS Build profiles (used to produce the APK)
```

## Step 1 — Deploy a PERMANENT backend (this is the part that was missing)

The mobile app must call a backend that is **always online**, not a temporary
dev preview. Pick any host that can run this Next.js project + PostgreSQL
permanently. The simplest free-tier options:

**Option A — Vercel (web app) + Neon or Supabase (Postgres)**
1. Push this repository to GitHub.
2. Create a free Postgres database at [neon.tech](https://neon.tech) or
   [supabase.com](https://supabase.com) and copy its connection string.
3. Import the repo into [vercel.com](https://vercel.com) → New Project.
4. In the Vercel project's Environment Variables, set:
   - `DATABASE_URL` = the connection string from step 2
   - `JWT_SECRET` = a long random string (used to sign rider login tokens)
5. Deploy. Vercel gives you a permanent URL like
   `https://riderdash.vercel.app`.
6. Run the schema migration once against that database:
   ```bash
   DATABASE_URL="<your-neon-or-supabase-url>" npx drizzle-kit push
   ```

**Option B — Railway / Render**
Both can host the Next.js app and a managed Postgres instance together in one
project, and also give you a permanent `https://` domain. Steps are the same
in spirit: set `DATABASE_URL` + `JWT_SECRET`, deploy, run `drizzle-kit push`
once.

Whichever you choose, the important result is: **you end up with one
permanent `https://...` URL that is always online**, which is what both the
Admin Web App and the Rider APK will use.

## Step 2 — Verify the backend is reachable from OUTSIDE your dev machine

Before building the APK, confirm the URL works from a different network than
the one hosting your dev environment (e.g. your phone's mobile data, or a
friend's wifi) — this is exactly the check that would have caught the sandbox
mistake earlier:

```bash
cd mobile
npm run verify-backend -- https://your-production-domain.com
```

This prints ✅ if the domain is safe (not a sandbox/localhost link) **and**
`/api/health` responds successfully. You can also just open
`https://your-production-domain.com/api/health` directly in your phone's
browser over mobile data — you should see `{"ok":true}`.

## Step 3 — Point the app at that backend

Set the URL in **one** of these places before building:

- Create `mobile/.env` (copy `mobile/.env.example`) and set:
  ```
  EXPO_PUBLIC_API_URL=https://your-production-domain.com
  ```
- OR set `env.EXPO_PUBLIC_API_URL` inside **both** build profiles in
  `mobile/eas.json` (this is what EAS actually reads during a cloud build —
  do this one if you're using `eas build`)

If you forget this step, `eas build` (or `expo prebuild`) will now **fail
immediately** with a clear error instead of producing a broken APK.

## Step 4 — Install dependencies

```bash
cd mobile
npm install
```

## Step 5 — (Optional) Run it in development first

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your Android phone to sanity-check
login/orders/dashboard against your new permanent backend before doing a full
build.

## Step 6 — Build the installable Android APK

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure       # links the project to your Expo account (first time only)
eas build --platform android --profile preview
```

- The `preview` profile produces a **standalone `.apk`** (not `.aab`).
- When the build finishes, EAS prints a direct HTTPS download link. Open that
  link on the phone (or download and transfer the file) to install it. You
  may need to allow "Install unknown apps" for your browser/file manager.
- This does **not** publish anything to the Google Play Store.

### Alternative: local build with Android Studio / Gradle

```bash
cd mobile
npx expo prebuild -p android
cd android
./gradlew assembleRelease
```

The APK will be at
`mobile/android/app/build/outputs/apk/release/app-release.apk`.

## Push Notifications — one-time production setup (required for "New Order Ready")

Push notifications use the **Expo Push Notification Service** — Expo's own
hosted, production push-delivery system (it routes to Android's FCM
automatically). This is NOT a temporary sandbox and works with the app
backgrounded or fully closed. All the app/backend code is already wired up;
you only need to do this **once** before your first real build:

```bash
cd mobile
eas credentials
# Select: Android → your build profile → Push Notifications: FCM v1
# Choose "Set up a new FCM V1 service account key" and follow the prompts
# (this creates/links a free Firebase project behind the scenes — no
# separate Firebase console work is required for basic push delivery)
```

That's it — no `google-services.json` or extra app code is needed for basic
push notifications. After this one-time setup, every EAS build automatically
includes working push credentials.

**Note:** push notifications cannot be tested in Expo Go or on an emulator —
you need a **real Android device** running a build produced by `eas build`
(the `preview` APK from Step 6 above is sufficient).

## Step 7 — Manual QA checklist (run this once you have the new APK)

1. Open the app → the Login screen shows your real production URL under
   "Server", and "Test Connection" reports ✅.
2. In the Admin Web App (same production URL), create a rider with an
   email + password.
3. Log into the APK with those credentials → grant the notification
   permission prompt when asked → Dashboard loads.
4. In the Admin Web App, enter a **new** customer phone number (e.g.
   `03001234567`) + name + location, and assign the order to that rider.
5. The rider's phone receives a **"New Order Ready"** push notification
   with the order number, customer name, location, and delivery charge —
   even if the app is backgrounded or closed.
6. Tap the notification → the app opens directly to that order.
7. Order details show, status is still "Assigned" (opening it does not
   change anything).
8. Tap "Mark as Delivered" → confirm → status becomes "Delivered".
9. In the Admin Web App's Orders page → the same order automatically shows
   "Delivered" within a few seconds (no manual refresh needed).
10. Rider Dashboard (in the APK) → delivered count and delivery earnings
    increase automatically.
11. Admin's Daily Rider Report (for that date) → the order appears with the
    correct delivery charge and bill.
12. In the Admin Web App, create a **second** order and type in the **same**
    phone number (`03001234567`) — Customer Name, Location, and Delivery
    Charge auto-fill from the saved customer record. Admin can still edit
    them before saving.
13. Reassign an order from one rider to another in the Admin Web App → it
    disappears from the old rider's "My Orders" and appears in the new
    rider's list, who also receives a fresh "New Order Ready" notification.
14. Deactivate the rider from the Admin Web App → the rider is immediately
    signed out of the APK on their next request, cannot log back in, and
    stops receiving notifications — while their historical orders/ledger
    remain fully visible to Admin.

If every step above works against your **permanent** URL, both apps are
correctly sharing the same live backend/database.
