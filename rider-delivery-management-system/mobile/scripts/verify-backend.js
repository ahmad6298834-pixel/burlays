#!/usr/bin/env node
/**
 * Verifies that a backend URL is reachable and looks like a real permanent
 * deployment (not a temporary dev sandbox) BEFORE you spend time building an APK
 * against it.
 *
 * Usage:
 *   node scripts/verify-backend.js https://your-production-domain.com
 *   node scripts/verify-backend.js            (reads EXPO_PUBLIC_API_URL from mobile/.env or the shell)
 *
 * Run this from your laptop while connected to the SAME network your phone will
 * use (or better, from a different network / mobile data entirely) to make sure
 * it is reachable from outside this development machine.
 */

const fs = require("fs");
const path = require("path");

const FORBIDDEN_PATTERNS = [
  { pattern: /e2b\.app/i, reason: "a temporary e2b.app development sandbox URL" },
  { pattern: /sandbox/i, reason: "a temporary sandbox URL" },
  { pattern: /localhost/i, reason: "localhost (unreachable from a real phone)" },
  { pattern: /127\.0\.0\.1/, reason: "a loopback address (unreachable from a real phone)" },
  { pattern: /10\.0\.2\.2/, reason: "the Android-emulator-only alias (unreachable from a real phone)" },
  { pattern: /YOUR-PRODUCTION-DOMAIN|REPLACE_/i, reason: "an unfilled placeholder" },
];

function loadDotEnvValue(key) {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : undefined;
}

async function main() {
  const url = process.argv[2] || process.env.EXPO_PUBLIC_API_URL || loadDotEnvValue("EXPO_PUBLIC_API_URL");

  if (!url) {
    console.error("❌ No URL provided. Usage: node scripts/verify-backend.js https://your-domain.com");
    process.exit(1);
  }

  console.log(`\nChecking backend URL: ${url}\n`);

  const problems = FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(url));
  if (problems.length > 0) {
    console.error("❌ This URL is NOT safe to ship in the APK:");
    for (const { reason } of problems) console.error(`   - It looks like ${reason}.`);
    console.error("\nDeploy your backend to a permanent host and use that domain instead.\n");
    process.exit(1);
  }

  if (!/^https:\/\//i.test(url)) {
    console.error("❌ URL must start with https:// for a production build.\n");
    process.exit(1);
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, { method: "GET" });
    const body = await res.json().catch(() => null);
    if (res.ok && body && body.ok) {
      console.log("✅ Backend is reachable and healthy: /api/health returned { ok: true }");
      console.log("✅ This URL is safe to use for EXPO_PUBLIC_API_URL.\n");
      process.exit(0);
    }
    console.error(`❌ Backend responded but health check failed (status ${res.status}).\n`);
    process.exit(1);
  } catch (err) {
    console.error(`❌ Could not reach ${url}/api/health — ${err.message}`);
    console.error("   Make sure the backend is deployed, running, and publicly accessible.\n");
    process.exit(1);
  }
}

main();
