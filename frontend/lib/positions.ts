export const POSITION_COLORS: Record<string, string> = {
  PG: "#D1336F",
  SG: "#E68A42",
  SF: "#19CAA1",
  PF: "#21B8D6",
  C:  "#A872D0",
};

export function positionBg(position: string): string {
  const color = POSITION_COLORS[position];
  if (!color) return "#F5F5F5";
  return `${color}15`;
}

export function positionFilledBg(position: string): string {
  const color = POSITION_COLORS[position];
  if (!color) return "#F5F5F5";
  return `${color}60`;
}