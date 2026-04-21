import { describe, it, expect } from 'vitest';
import AccessioError from '../src/core/accessioError.js';

describe('AccessioError', () => {
  it('creates an error with all properties', () => {
    const config = { url: '/test', method: 'get' };
    const response = { status: 404, data: 'Not Found' };
    const error = new AccessioError('Not found', 'ERR_BAD_REQUEST', config, null, response);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AccessioError);
    expect(error.name).toBe('AccessioError');
    expect(error.message).toBe('Not found');
    expect(error.code).toBe('ERR_BAD_REQUEST');
    expect(error.config).toBe(config);
    expect(error.request).toBeNull();
    expect(error.response).toBe(response);
    expect(error.isAccessioError).toBe(true);
  });

  it('defaults optional parameters to null', () => {
    const error = new AccessioError('fail');
    expect(error.code).toBeNull();
    expect(error.config).toBeNull();
    expect(error.request).toBeNull();
    expect(error.response).toBeNull();
  });

  it('has a stack trace', () => {
    const error = new AccessioError('test');
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });

  describe('toJSON', () => {
    it('returns a serializable object', () => {
      const config = { url: '/test' };
      const response = { status: 500 };
      const error = new AccessioError('Server error', 'ERR_BAD_RESPONSE', config, null, response);
      const json = error.toJSON();

      expect(json.name).toBe('AccessioError');
      expect(json.message).toBe('Server error');
      expect(json.code).toBe('ERR_BAD_RESPONSE');
      expect(json.status).toBe(500);
      expect(json.config).toBe(config);
    });

    it('returns null status when no response', () => {
      const error = new AccessioError('Network error', 'ERR_NETWORK');
      expect(error.toJSON().status).toBeNull();
    });
  });

  describe('from', () => {
    it('creates a AccessioError from a regular Error', () => {
      const original = new Error('original message');
      const accessioError = AccessioError.from(original, 'ERR_NETWORK', { url: '/test' });

      expect(accessioError).toBeInstanceOf(AccessioError);
      expect(accessioError.message).toBe('original message');
      expect(accessioError.code).toBe('ERR_NETWORK');
      expect(accessioError.cause).toBe(original);
      expect(accessioError.stack).toBe(original.stack);
    });
  });

  describe('error code constants', () => {
    it('has all expected error codes', () => {
      expect(AccessioError.ERR_BAD_OPTION_VALUE).toBe('ERR_BAD_OPTION_VALUE');
      expect(AccessioError.ERR_BAD_OPTION).toBe('ERR_BAD_OPTION');
      expect(AccessioError.ECONNABORTED).toBe('ECONNABORTED');
      expect(AccessioError.ETIMEDOUT).toBe('ETIMEDOUT');
      expect(AccessioError.ERR_NETWORK).toBe('ERR_NETWORK');
      expect(AccessioError.ERR_BAD_RESPONSE).toBe('ERR_BAD_RESPONSE');
      expect(AccessioError.ERR_BAD_REQUEST).toBe('ERR_BAD_REQUEST');
      expect(AccessioError.ERR_CANCELED).toBe('ERR_CANCELED');
      expect(AccessioError.ERR_NOT_SUPPORT).toBe('ERR_NOT_SUPPORT');
      expect(AccessioError.ERR_INVALID_URL).toBe('ERR_INVALID_URL');
    });
  });
});
