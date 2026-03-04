import { describe, it, expect, beforeEach } from 'vitest';
import { AutoCloseFilter } from '../../src/signals/auto-close-filter.js';

describe('AutoCloseFilter', () => {
  let acf: AutoCloseFilter;

  beforeEach(() => {
    acf = new AutoCloseFilter();
  });

  it('should detect auto-close bracket pair', () => {
    acf.isAutoClose('(', 1000, 5);          // opening bracket
    const result = acf.isAutoClose(')', 1005, 5); // closing within 5ms
    expect(result).toBe(true);
  });

  it('should not filter opening bracket followed by different char', () => {
    acf.isAutoClose('(', 1000, 5);
    const result = acf.isAutoClose('a', 1005, 5);
    expect(result).toBe(false);
  });

  it('should detect auto-indent (whitespace within 10ms)', () => {
    expect(acf.isAutoIndent('    ', 5)).toBe(true);
  });

  it('should not filter normal whitespace typing', () => {
    expect(acf.isAutoIndent('    ', 500)).toBe(false);
  });
});
