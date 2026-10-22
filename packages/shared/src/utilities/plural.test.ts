import { describe, expect, it } from 'vitest';
import { isOrAre, pluralize, pluralWord, wasOrWere } from './plural';

describe('pluralize', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'task')).toBe('1 task');
    expect(pluralize(0, 'task')).toBe('0 tasks');
    expect(pluralize(7, 'milestone')).toBe('7 milestones');
  });

  it('accepts irregular plurals', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
    expect(pluralWord(1, 'person', 'people')).toBe('person');
  });

  it('agrees the verb with the count', () => {
    expect(isOrAre(1)).toBe('is');
    expect(isOrAre(3)).toBe('are');
    expect(wasOrWere(1)).toBe('was');
    expect(wasOrWere(0)).toBe('were');
  });
});
