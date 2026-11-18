/**
 * Display formatting for prices and counts. Digits are grouped by hand rather than with
 * Intl's en-ZA locale, which uses a comma as the decimal separator and would print
 * R1 069,99 where shops in South Africa write R1 069.99.
 */

const NBSP = " ";

/** Groups thousands with a non-breaking space, so a figure stays on one line. */
function group(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** "R12 499", or "R1 069.99" when the price has cents. */
export function formatRand(value: number): string {
  const cents = Math.round(value * 100);
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  return `R${group(whole)}${rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`}`;
}

/** "23%". Rounded down, so a saving is never overstated. */
export function formatPct(fraction: number): string {
  return `${Math.floor(fraction * 100 + 1e-9)}%`;
}

/** "3 986". */
export function formatCount(count: number): string {
  return group(count);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${group(count)} ${count === 1 ? one : many}`;
}
