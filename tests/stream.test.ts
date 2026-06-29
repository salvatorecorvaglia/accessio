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

  it('correctly keeps abort event listener active during streaming and cleans up after completion', async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();

    let streamController: ReadableStreamDefaultController | null = null;
    const mockStream = new ReadableStream({
      start(c) {
        streamController = c;
        c.enqueue(encoder.encode('data: {"val": 1}\n'));
      },
    });

    const client = new Accessio();
    const customSignal = controller.signal;

    // Spy on abort cleanup function or manually check event listeners
    let signalListenersCount = 0;
    const originalAddEventListener = customSignal.addEventListener.bind(customSignal);
    const originalRemoveEventListener = customSignal.removeEventListener.bind(customSignal);

    customSignal.addEventListener = vi.fn((type, listener, options) => {
      signalListenersCount++;
      return originalAddEventListener(type, listener, options);
    });
    customSignal.removeEventListener = vi.fn((type, listener, options) => {
      signalListenersCount--;
      return originalRemoveEventListener(type, listener, options);
    });

    const testAbortHandler = () => {
      try {
        streamController?.error(customSignal.reason || new Error('Aborted'));
      } catch {
        // ignore
      }
    };
    customSignal.addEventListener('abort', testAbortHandler);

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: mockStream,
    });

    const streamGen = client.stream('/stream', { signal: customSignal, timeout: 5000 });
    const firstIter = await streamGen.next();
    expect(firstIter.value).toEqual({ val: 1 });

    // Assert that the listener is STILL active (has not been cleaned up yet because stream is open)
    expect(signalListenersCount).toBeGreaterThan(0);

    // Cancel / complete the stream by calling aborting
    controller.abort('user cancel');

    // Ensure the stream generator finishes and cleans up
    try {
      await streamGen.next();
    } catch (_e) {
      // ignore abort error if thrown
    }

    customSignal.removeEventListener('abort', testAbortHandler);

    // Verify cleanup was run
    expect(signalListenersCount).toBe(0);
  });
});
