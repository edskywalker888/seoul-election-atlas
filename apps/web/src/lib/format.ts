// Display formatters. Vote percentages are stored at full precision;
// rounding happens ONLY here, per project rules.

export function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function formatVotes(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatMargin(a: number, b: number): string {
  return `${Math.abs(a - b).toFixed(2)}pp`;
}

export function formatTurnout(n: number): string {
  return formatPct(n);
}
