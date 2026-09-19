export const MAX_SCANS_PER_DAY = 15;
export const SCAN_COOLDOWN_SECONDS = 30;

const SCANNER_ENABLED_KEY = "civicmitra_scanner_enabled";
const LAST_SCAN_TIMESTAMP_KEY = "civicmitra_last_scan_timestamp";
const DAILY_SCANS_COUNT_KEY = "civicmitra_daily_scans_";

export function isScannerEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(SCANNER_ENABLED_KEY);
    return val !== "false";
  } catch {
    return true;
  }
}

export function setScannerEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCANNER_ENABLED_KEY, enabled ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent("civicmitra:scanner-toggle", { detail: enabled })
    );
  } catch (e) {
    console.error("Failed to persist scanner enabled state:", e);
  }
}

export function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getDailyScansUsed(userId?: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const userPrefix = userId ? `${userId}_` : "";
    const key = `${DAILY_SCANS_COUNT_KEY}${userPrefix}${getTodayKey()}`;
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function recordDailyScan(userId?: string): number {
  if (typeof window === "undefined") return 1;
  try {
    const userPrefix = userId ? `${userId}_` : "";
    const key = `${DAILY_SCANS_COUNT_KEY}${userPrefix}${getTodayKey()}`;
    const current = getDailyScansUsed(userId);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    localStorage.setItem(LAST_SCAN_TIMESTAMP_KEY, String(Date.now()));
    return next;
  } catch {
    return 1;
  }
}

export function getCooldownRemainingSeconds(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(LAST_SCAN_TIMESTAMP_KEY);
    if (!raw) return 0;
    const lastScan = parseInt(raw, 10);
    const diffSeconds = Math.floor((Date.now() - lastScan) / 1000);
    const remaining = SCAN_COOLDOWN_SECONDS - diffSeconds;
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

export async function calculateImageHash(base64DataUrl: string): Promise<string> {
  try {
    // Strip data URL header
    const cleanBase64 = base64DataUrl.includes(",") 
      ? base64DataUrl.split(",")[1] 
      : base64DataUrl;

    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    console.warn("Failed to calculate crypto hash, falling back to simple hash:", err);
    let hash = 0;
    for (let i = 0; i < base64DataUrl.length; i++) {
      hash = ((hash << 5) - hash) + base64DataUrl.charCodeAt(i);
      hash |= 0;
    }
    return `simple_${Math.abs(hash).toString(16)}`;
  }
}
