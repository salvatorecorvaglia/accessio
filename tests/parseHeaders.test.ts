import { describe, it, expect } from 'vitest';
import parseHeaders from '../src/helpers/parseHeaders';

describe('parseHeaders', () => {
  it('returns empty object for null/undefined', () => {
    expect(parseHeaders(null)).toEqual({});
    expect(parseHeaders(undefined)).toEqual({});
  });

  it('parses a plain object with lowercased keys', () => {
    const result = parseHeaders({ 'Content-Type': 'application/json', 'X-Custom': 'val' });
    expect(result).toEqual({ 'content-type': 'application/json', 'x-custom': 'val' });
  });

  it('parses raw header string', () => {
    const raw = 'Content-Type: application/json\nX-Custom: value\n';
    const result = parseHeaders(raw);
    expect(result['content-type']).toBe('application/json');
    expect(result['x-custom']).toBe('value');
  });

  it('skips malformed header lines', () => {
    const raw = 'Good-Header: value\nBadLine\n: no-key\n';
    const result = parseHeaders(raw);
    expect(result['good-header']).toBe('value');
    expect(Object.keys(result).length).toBe(1);
  });

  it('parses Headers-like object with forEach', () => {
    const mockHeaders = {
      forEach(fn: (value: string, key: string) => void) {
        fn('application/json', 'Content-Type');
        fn('no-cache', 'Cache-Control');
      }
    };
    const result = parseHeaders(mockHeaders as any);
    expect(result['content-type']).toBe('application/json');
    expect(result['cache-control']).toBe('no-cache');
  });
});
