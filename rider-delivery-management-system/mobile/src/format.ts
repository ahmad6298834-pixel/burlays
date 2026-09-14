export function formatCurrency(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return `Rs. ${value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  if (Number.isNaN(d.getTime())) return date;
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

export function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "Delivered":
      return { bg: "#d1fae5", text: "#047857" };
    case "Cancelled":
      return { bg: "#ffe4e6", text: "#be123c" };
    default:
      return { bg: "#fef3c7", text: "#b45309" };
  }
}
