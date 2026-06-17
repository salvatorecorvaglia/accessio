import { describe, expect, it, vi } from 'vitest';
import Accessio from '../src/accessio';

describe('Accessio streaming', () => {
  it('correctly processes SSE (Server-Sent Events) formatted stream', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"val": 1}\n'));
        controller.enqueue(encoder.encode('data: {"val": 2}\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n'));
        controller.close();
      },
    });

    const client = new Accessio();
    vi.spyOn(client, 'request').mockResolvedValue({
      data: mockStream,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {} as any,
      duration: 0,
    });

    const items: any[] = [];
    for await (const chunk of client.stream('/stream')) {
      items.push(chunk);
    }

    expect(items).toEqual([{ val: 1 }, { val: 2 }]);
  });

  it('correctly processes raw JSON lines', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"val": 3}\n{"val": 4}\n'));
        controller.close();
      },
    });

    const client = new Accessio();
    vi.spyOn(client, 'request').mockResolvedValue({
      data: mockStream,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {} as any,
      duration: 0,
    });

    const items: any[] = [];
    for await (const chunk of client.stream('/stream')) {
      items.push(chunk);
    }

    expect(items).toEqual([{ val: 3 }, { val: 4 }]);
  });

  it('handles partial text chunks correctly across reads', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text": "he'));
        controller.enqueue(encoder.encode('llo"}\n'));
        controller.close();
      },
    });

    const client = new Accessio();
    vi.spyOn(client, 'request').mockResolvedValue({
      data: mockStream,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {} as any,
      duration: 0,
    });

    const items: any[] = [];
    for await (const chunk of client.stream('/stream')) {
      items.push(chunk);
    }

    expect(items).toEqual([{ text: 'hello' }]);
  });

  it('handles plain text data lines gracefully (non-JSON SSE)', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: hello world\n'));
        controller.close();
      },
    });

    const client = new Accessio();
    vi.spyOn(client, 'request').mockResolvedValue({
      data: mockStream,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {} as any,
      duration: 0,
    });

    const items: any[] = [];
    for await (const chunk of client.stream('/stream')) {
      items.push(chunk);
    }

    expect(items).toEqual(['hello world']);
  });

  it('handles empty response data gracefully', async () => {
    const client = new Accessio();
    vi.spyOn(client, 'request').mockResolvedValue({
      data: null as any,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {} as any,
      duration: 0,
    });

    const items: any[] = [];
    for await (const chunk of client.stream('/stream')) {
      items.push(chunk);
    }

    expect(items).toEqual([]);
  });
});
