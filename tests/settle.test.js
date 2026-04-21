import { describe, it, expect } from 'vitest';
import settle from '../src/helpers/settle.js';

describe('settle', () => {
  it('resolves when validateStatus returns true', () => {
    const response = { status: 200, statusText: 'OK' };
    const config = { validateStatus: (s) => s >= 200 && s < 300 };

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).then((res) => {
      expect(res).toBe(response);
    });
  });

  it('rejects with AccessioError when validateStatus returns false', () => {
    const response = { status: 404, statusText: 'Not Found', request: {} };
    const config = { validateStatus: (s) => s >= 200 && s < 300 };

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).catch((error) => {
      expect(error.isAccessioError).toBe(true);
      expect(error.message).toContain('404');
      expect(error.response).toBe(response);
    });
  });

  it('uses ERR_BAD_REQUEST for 4xx status', () => {
    const response = { status: 400, request: {} };
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).catch((error) => {
      expect(error.code).toBe('ERR_BAD_REQUEST');
    });
  });

  it('uses ERR_BAD_RESPONSE for 5xx status', () => {
    const response = { status: 500, request: {} };
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).catch((error) => {
      expect(error.code).toBe('ERR_BAD_RESPONSE');
    });
  });

  it('resolves when no validateStatus is provided', () => {
    const response = { status: 500 };
    const config = {};

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).then((res) => {
      expect(res).toBe(response);
    });
  });

  it('resolves when response has no status', () => {
    const response = {};
    const config = { validateStatus: () => false };

    return new Promise((resolve, reject) => {
      settle(resolve, reject, response, config);
    }).then((res) => {
      expect(res).toBe(response);
    });
  });
});
