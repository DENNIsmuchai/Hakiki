const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount, currency = "KES") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "—";
  if (currency === "KES") return KES.format(amount);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(value, options = { dateStyle: "medium", timeStyle: "short" }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", options).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

const PHONE = /^(\+?254|0)(7\d{8}|1\d{8})$/;

export function formatPhoneNumber(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return raw;
}

export function isValidPhoneNumber(raw) {
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("254") ? digits : digits.startsWith("0") ? `254${digits.slice(1)}` : `254${digits}`;
  return PHONE.test(normalized) && normalized.length === 12;
}

export function formatRelativeTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min !== 1 ? "s" : ""} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? "s" : ""} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day !== 1 ? "s" : ""} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} month${mo !== 1 ? "s" : ""} ago`;
  const yr = Math.round(mo / 12);
  return `${yr} year${yr !== 1 ? "s" : ""} ago`;
}
