import { describe, expect, it } from 'vitest';
import { formatLocationCardEntry } from '../AccessibleLog';

describe('formatLocationCardEntry', () => {
  it('exposes both pieces of canvas location-card copy to the DOM log', () => {
    expect(formatLocationCardEntry({
      title: 'Cathedral of the Last Canticle',
      kicker: 'A broken hymn still circles the nave',
    })).toBe('Arrived at Cathedral of the Last Canticle. A broken hymn still circles the nave');
  });
});
