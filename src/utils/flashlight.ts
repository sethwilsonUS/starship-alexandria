/**
 * FOV radius from flashlight battery (0–100).
 * At 0, radius is 3 (dim but never blind).
 */
export function getFovRadiusFromBattery(battery: number): number {
  if (battery <= 0) return 3;
  if (battery <= 25) return 4;
  if (battery <= 50) return 6;
  if (battery <= 75) return 7;
  return 8;
}
