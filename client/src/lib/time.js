/* Time helpers for the daily planner. */
export const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// Index of the block covering `date` in a 16-block daily plan (sleep wraps past midnight).
export function currentBlockIndex(date, daily) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 21 * 60 || m < 6 * 60) return daily.length - 1;
  return daily.findIndex((b) => m >= toMin(b.time) && m < toMin(b.time) + b.duration);
}
export const fmtDuration = (d) => (d >= 120 && d % 60 === 0 ? `${d / 60} H` : `${d} MIN`);
export const pad2 = (n) => String(n).padStart(2, "0");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Resolve with `promise`'s value, but never sooner than `ms` (rejections also wait).
export async function withMinDelay(promise, ms) {
  const [result] = await Promise.allSettled([promise, sleep(ms)]);
  if (result.status === "rejected") throw result.reason;
  return result.value;
}
