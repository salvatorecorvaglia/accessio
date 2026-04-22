import { describe, it, expect } from 'vitest';
import settle from '../src/helpers/settle';

describe('settle', () => {
  it('resolves when validateStatus returns true', () => {
    const response = { status: 200, statusText: 'OK', headers: {}, config: {}, request: {}, duration: 0 };
    const config = { validateStatus: (s: number) => s >= 200 && s < 300 };

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).then((res: any) => {
      expect(res).toBe(response);
    });
  });

  it('rejects with AccessioError when validateStatus returns false', () => {
    const response = { status: 404, statusText: 'Not Found', request: {}, headers: {}, config: {}, duration: 0 };
    const config = { validateStatus: (s: number) => s >= 200 && s < 300 };

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).catch((error: any) => {
      expect(error.isAccessioError).toBe(true);
      expect(error.message).toContain('404');
      expect(error.response).toBe(response);
    });
  });

  it('uses ERR_BAD_REQUEST for 4xx status', () => {
    const response = { status: 400, request: {}, headers: {}, config: {}, duration: 0, statusText: '' };
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).catch((error: any) => {
      expect(error.code).toBe('ERR_BAD_REQUEST');
    });
  });

  it('uses ERR_BAD_RESPONSE for 5xx status', () => {
    const response = { status: 500, request: {}, headers: {}, config: {}, duration: 0, statusText: '' };
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).catch((error: any) => {
      expect(error.code).toBe('ERR_BAD_RESPONSE');
    });
  });

  it('resolves when no validateStatus is provided', () => {
    const response = { status: 500, headers: {}, config: {}, request: {}, duration: 0, statusText: '' };
    const config = {};

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).then((res: any) => {
      expect(res).toBe(response);
    });
  });

  it('resolves when response has no status', () => {
    const response = { headers: {}, config: {}, request: {}, duration: 0, statusText: '' };
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve as any, reject, response as any, config as any);
    }).then((res: any) => {
      expect(res).toBe(response);
    });
  });
});
