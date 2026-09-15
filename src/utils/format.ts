export function formatCurrency(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return `Rs. ${value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date + (date.length === 10 ? "T00:00:00" : "")) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return "-";
  const [h, m] = time.split(":");
  if (h === undefined || m === undefined) return time;
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${suffix}`;
}

export function todayISO(): string {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export function nowTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function statusBadgeClasses(status: string): string {
  switch (status) {
    case "Delivered":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "Cancelled":
      return "bg-rose-100 text-rose-700 border border-rose-200";
    default:
      return "bg-amber-100 text-amber-700 border border-amber-200";
  }
}

export function balanceLabel(balance: number): { label: string; classes: string } {
  if (balance > 0) {
    return {
      label: `${formatCurrency(balance)} payable to rider`,
      classes: "text-emerald-700",
    };
  }
  if (balance < 0) {
    return {
      label: `${formatCurrency(Math.abs(balance))} owed by rider`,
      classes: "text-rose-700",
    };
  }
  return { label: "Settled", classes: "text-slate-500" };
}
