import { describe, it, expect } from 'vitest';
import { getFovRadiusFromBattery } from '../flashlight';

describe('getFovRadiusFromBattery', () => {
  it('returns 3 (minimum) when battery is 0', () => {
    expect(getFovRadiusFromBattery(0)).toBe(3);
  });

  it('returns 3 for negative battery values', () => {
    expect(getFovRadiusFromBattery(-10)).toBe(3);
  });

  it('returns 4 for battery 1–25', () => {
    expect(getFovRadiusFromBattery(1)).toBe(4);
    expect(getFovRadiusFromBattery(12)).toBe(4);
    expect(getFovRadiusFromBattery(25)).toBe(4);
  });

  it('returns 6 for battery 26–50', () => {
    expect(getFovRadiusFromBattery(26)).toBe(6);
    expect(getFovRadiusFromBattery(38)).toBe(6);
    expect(getFovRadiusFromBattery(50)).toBe(6);
  });

  it('returns 7 for battery 51–75', () => {
    expect(getFovRadiusFromBattery(51)).toBe(7);
    expect(getFovRadiusFromBattery(63)).toBe(7);
    expect(getFovRadiusFromBattery(75)).toBe(7);
  });

  it('returns 8 (maximum) for battery 76–100', () => {
    expect(getFovRadiusFromBattery(76)).toBe(8);
    expect(getFovRadiusFromBattery(88)).toBe(8);
    expect(getFovRadiusFromBattery(100)).toBe(8);
  });

  it('returns 8 for battery above 100', () => {
    expect(getFovRadiusFromBattery(150)).toBe(8);
  });
});
