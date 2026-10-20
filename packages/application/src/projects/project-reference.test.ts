import { describe, expect, it } from 'vitest';
import {
  formatProjectReference,
  nextProjectReference,
  projectReferenceSeriesPattern,
} from './project-reference';

describe('project references', () => {
  it('starts each yearly series at 001', () => {
    expect(nextProjectReference('ARN', 2026, [])).toBe('ARN-2026-001');
  });

  it('continues after the highest number, never reusing gaps', () => {
    const existing = ['ARN-2026-001', 'ARN-2026-004', 'ARN-2026-002'];
    expect(nextProjectReference('ARN', 2026, existing)).toBe('ARN-2026-005');
  });

  it('ignores other years, other prefixes and malformed references', () => {
    const existing = ['ARN-2025-120', 'LTL-2026-050', 'ARN-2026-01x', 'ARN-2026-', 'ARN-2026-003'];
    expect(nextProjectReference('ARN', 2026, existing)).toBe('ARN-2026-004');
  });

  it('keeps every digit once a year passes 999 projects', () => {
    expect(nextProjectReference('ARN', 2026, ['ARN-2026-999'])).toBe('ARN-2026-1000');
    expect(nextProjectReference('ARN', 2026, ['ARN-2026-1000', 'ARN-2026-999'])).toBe(
      'ARN-2026-1001',
    );
  });

  it('formats and matches series consistently', () => {
    expect(formatProjectReference('PRJ', 2027, 7)).toBe('PRJ-2027-007');
    expect(projectReferenceSeriesPattern('PRJ', 2027)).toBe('PRJ-2027-%');
  });
});
