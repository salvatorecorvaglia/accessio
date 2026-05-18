import { describe, it, expect } from 'vitest';
import transformData from '../src/helpers/transformData';
import AccessioError from '../src/core/accessioError';

describe('transformData', () => {
  it('returns data unchanged when no transforms', async () => {
    expect(await transformData(null as any, 'hello', {})).toBe('hello');
    expect(await transformData(undefined, 'hello', {})).toBe('hello');
    expect(await transformData([], 'hello', {})).toBe('hello');
  });

  it('applies a single transform', async () => {
    const transforms = [(data: any) => data.toUpperCase()];
    expect(await transformData(transforms, 'hello', {})).toBe('HELLO');
  });

  it('applies transforms in order (pipeline)', async () => {
    const transforms = [(data: any) => `${data} world`, (data: any) => data.toUpperCase()];
    expect(await transformData(transforms, 'hello', {})).toBe('HELLO WORLD');
  });

  it('passes headers to transform functions', async () => {
    const headers = { 'content-type': 'application/json' };
    const transforms = [(data: any, h: any) => ({ data, type: h['content-type'] })];
    const result = await transformData(transforms, 'test', headers);
    expect(result).toEqual({ data: 'test', type: 'application/json' });
  });

  it('skips non-function entries', async () => {
    const transforms = ['not a function' as any, (data: string) => `${data}!`, null as any];
    expect(await transformData(transforms, 'hello', {})).toBe('hello!');
  });

  it('handles non-array transforms gracefully', async () => {
    expect(await transformData('not an array' as any, 'data', {})).toBe('data');
  });

  it('wraps failures as ERR_BAD_REQUEST for request transforms by default', async () => {
    const throwing = [() => { throw new Error('nope'); }];
    await expect(transformData(throwing, 'data', {})).rejects.toMatchObject({
      isAccessioError: true,
      code: AccessioError.ERR_BAD_REQUEST,
    });
  });

  it('wraps failures as ERR_BAD_RESPONSE when direction is "response"', async () => {
    const throwing = [() => { throw new Error('parse fail'); }];
    await expect(
      transformData(throwing, 'data', {}, undefined, 'response'),
    ).rejects.toMatchObject({
      isAccessioError: true,
      code: AccessioError.ERR_BAD_RESPONSE,
    });
  });
});
