import { describe, it, expect } from 'vitest';
import transformData from '../src/helpers/transformData';

describe('transformData', () => {
  it('returns data unchanged when no transforms', () => {
    expect(transformData(null, 'hello')).toBe('hello');
    expect(transformData(undefined, 'hello')).toBe('hello');
    expect(transformData([], 'hello')).toBe('hello');
  });

  it('applies a single transform', () => {
    const transforms = [(data: any) => data.toUpperCase()];
    expect(transformData(transforms, 'hello')).toBe('HELLO');
  });

  it('applies transforms in order (pipeline)', () => {
    const transforms = [
      (data: string) => `${data} world`,
      (data: string) => data.toUpperCase(),
    ];
    expect(transformData(transforms, 'hello')).toBe('HELLO WORLD');
  });

  it('passes headers to transform functions', () => {
    const headers = { 'content-type': 'application/json' };
    const transforms = [(data: any, h: any) => ({ data, type: h['content-type'] })];
    const result = transformData(transforms, 'test', headers);
    expect(result).toEqual({ data: 'test', type: 'application/json' });
  });

  it('skips non-function entries', () => {
    const transforms = ['not a function' as any, (data: string) => `${data}!`, null];
    expect(transformData(transforms, 'hello')).toBe('hello!');
  });

  it('handles non-array transforms gracefully', () => {
    expect(transformData('not an array' as any, 'data')).toBe('data');
  });
});
