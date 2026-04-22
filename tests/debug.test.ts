import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logRequest, logResponse, logError } from '../src/helpers/debug';

describe('debug.ts', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('logRequest', () => {
    it('does nothing when debug is false', () => {
      logRequest({ method: 'get', url: '/test' }, '/test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs when debug is true (with pre-built fullUrl)', () => {
      logRequest({ debug: true, method: 'get', url: '/test' }, 'https://api.test.com/test');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('[Accessio]');
      expect(output).toContain('GET');
      expect(output).toContain('https://api.test.com/test');
    });

    it('falls back to config.url when fullUrl is not provided', () => {
      logRequest({ debug: true, method: 'get', url: '/fallback' });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('/fallback');
    });

    it('logs params when present', () => {
      logRequest({ debug: true, method: 'get', url: '/test', params: { q: 'hello' } }, '/test?q=hello');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Params');
    });

    it('logs body data for objects', () => {
      logRequest({ debug: true, method: 'post', url: '/test', data: { key: 'value' } }, '/test');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Body');
    });

    it('truncates large body data', () => {
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        largeData[`key_${i}`] = 'a'.repeat(20);
      }
      logRequest({ debug: true, method: 'post', url: '/test', data: largeData }, '/test');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('...');
    });

    it('logs timeout when set', () => {
      logRequest({ debug: true, method: 'get', url: '/test', timeout: 5000 }, '/test');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Timeout: 5000ms');
    });

    it('logs retry count when set', () => {
      logRequest({ debug: true, method: 'get', url: '/test', retry: 3 }, '/test');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Retry: 3x');
    });

    it('defaults method to GET when not provided', () => {
      logRequest({ debug: true, url: '/test' }, '/test');
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('GET');
    });
  });

  describe('logResponse', () => {
    it('does nothing when config.debug is false', () => {
      logResponse({ config: { debug: false }, status: 200 } as any);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('does nothing when config is missing', () => {
      logResponse({ status: 200 } as any);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs status and duration', () => {
      logResponse({
        config: { debug: true, method: 'get' },
        status: 200,
        statusText: 'OK',
        duration: 42,
        data: { ok: true },
        headers: {},
        request: {},
        config: { debug: true }
      } as any);

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('200');
      expect(output).toContain('42ms');
    });

    it('shows ?? when duration is missing', () => {
      logResponse({
        config: { debug: true },
        status: 200,
        statusText: '',
        headers: {},
        request: {},
        config: { debug: true }
      } as any);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('??');
    });

    it('shows ✅ for 2xx status', () => {
      logResponse({
        config: { debug: true },
        status: 200,
        statusText: '',
        duration: 10,
        headers: {},
        request: {},
        config: { debug: true }
      } as any);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('✅');
    });

    it('shows ❌ for 4xx+ status', () => {
      logResponse({
        config: { debug: true },
        status: 500,
        statusText: '',
        duration: 10,
        headers: {},
        request: {},
        config: { debug: true }
      } as any);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('❌');
    });

    it('shows ⚠️ for 3xx status', () => {
      logResponse({
        config: { debug: true },
        status: 301,
        statusText: '',
        duration: 5,
        headers: {},
        request: {},
        config: { debug: true }
      } as any);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('⚠️');
    });

    it('logs response size for string data', () => {
      logResponse({
        config: { debug: true },
        status: 200,
        statusText: '',
        duration: 10,
        data: 'hello world',
        headers: {},
        request: {},
        config: { debug: true }
      } as any);
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Size');
    });

    it('does not crash when data cannot be estimated', () => {
      const circular: any = {};
      circular.self = circular;
      expect(() => logResponse({
        config: { debug: true },
        status: 200,
        statusText: '',
        duration: 10,
        data: circular,
        headers: {},
        request: {},
        config: { debug: true }
      })).not.toThrow();
    });
  });

  describe('logError', () => {
    it('does nothing when debug is false', () => {
      logError(new Error('test'), { debug: false });
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('does nothing when config is missing', () => {
      logError(new Error('test'));
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs error message', () => {
      logError(new Error('Network failure') as any, { debug: true });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('ERROR');
      expect(output).toContain('Network failure');
    });

    it('logs error code when available', () => {
      const error = new Error('fail') as any;
      error.code = 'ERR_NETWORK';
      logError(error, { debug: true });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('ERR_NETWORK');
    });

    it('logs status when response exists', () => {
      const error = new Error('fail') as any;
      error.response = { status: 503 };
      logError(error, { debug: true });
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('503');
    });

    it('does not crash when error has no code or response', () => {
      expect(() => logError(new Error('bare error') as any, { debug: true })).not.toThrow();
    });
  });
});
