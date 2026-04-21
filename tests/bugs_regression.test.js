import { describe, it, expect, vi } from 'vitest';
import Accessio from '../src/accessio.js';

describe('Bugs Regression Tests', () => {
  describe('Default Method Bug', () => {
    it('should respect default method set in instance config', async () => {
      // Mock fetch to track the method
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      const client = new Accessio({ method: 'post' });
      await client.request({ url: '/test' });

      // EXPECTATION: It should be POST, but currently falls back to GET
      // because 'method' is in requestOnlyKeys in mergeConfig.js
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Response Transformation Bug', () => {
    it('should apply transformResponse for non-JSON response types', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('hello world'),
      });
      global.fetch = mockFetch;

      const transformer = vi.fn((data) => data.toUpperCase());
      const client = new Accessio();
      
      const response = await client.request({
        url: '/test',
        responseType: 'text',
        transformResponse: [transformer]
      });

      // EXPECTATION: transformer should be called and data should be "HELLO WORLD"
      // currently it is skipped unless responseType is 'json'
      expect(transformer).toHaveBeenCalled();
      expect(response.data).toBe('HELLO WORLD');
    });
  });
});
