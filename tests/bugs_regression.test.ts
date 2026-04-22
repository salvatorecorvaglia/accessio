import { describe, it, expect, vi } from 'vitest';
import Accessio from '../src/accessio';

describe('Bugs Regression Tests', () => {
  describe('Default Method Bug', () => {
    it('should respect default method set in instance config', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      const client = new Accessio({ method: 'post' });
      await client.request({ url: '/test' });

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

      const transformer = vi.fn((data: any) => data.toUpperCase());
      const client = new Accessio();
      
      const response = await client.request({
        url: '/test',
        responseType: 'text',
        transformResponse: [transformer]
      });

      expect(transformer).toHaveBeenCalled();
      expect(response.data).toBe('HELLO WORLD');
    });
  });
});
