import { describe, expect, it } from 'vitest';
import { toFormData } from '../src/helpers/toFormData';

describe('toFormData', () => {
  it('appends primitive values', () => {
    const fd = toFormData({ name: 'Alice', age: 30 });
    expect(fd.get('name')).toBe('Alice');
    expect(fd.get('age')).toBe('30');
  });

  it('serializes Date values to ISO strings', () => {
    const fd = toFormData({ created: new Date('2025-01-01T00:00:00.000Z') });
    expect(fd.get('created')).toBe('2025-01-01T00:00:00.000Z');
  });

  it('serializes nested objects with dot notation by default', () => {
    const fd = toFormData({ user: { name: 'Bob' } });
    expect(fd.get('user.name')).toBe('Bob');
  });

  it('serializes Set values instead of silently dropping the field', () => {
    const fd = toFormData({ tags: new Set(['a', 'b']) });
    expect(fd.get('tags[0]')).toBe('a');
    expect(fd.get('tags[1]')).toBe('b');
  });

  it('serializes Map values instead of silently dropping the field', () => {
    const fd = toFormData({ meta: new Map([['k', 'v']]) });
    expect(fd.get('meta.k')).toBe('v');
  });

  it('serializes a Map with bracket notation when options.brackets is set', () => {
    const fd = toFormData({ meta: new Map([['k', 'v']]) }, undefined, undefined, undefined, {
      brackets: true,
    });
    expect(fd.get('meta[k]')).toBe('v');
  });

  it('does not hang on a self-referencing Set', () => {
    const set: Set<unknown> = new Set();
    set.add(set);
    expect(() => toFormData({ tags: set })).not.toThrow();
  });

  it('does not hang on a self-referencing Map', () => {
    const map: Map<string, unknown> = new Map();
    map.set('self', map);
    expect(() => toFormData({ meta: map })).not.toThrow();
  });
});
