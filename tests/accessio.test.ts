import { describe, it, expect, vi, beforeEach } from "vitest";
import Accessio from "../src/accessio";

vi.mock("../src/core/request", () => ({
  default: vi.fn((config: any) => {
    return Promise.resolve({
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      request: {},
      duration: 42,
    });
  }),
}));

vi.mock("../src/core/retry", () => ({
  default: vi.fn((dispatchFn: any, config: any) => dispatchFn(config)),
}));

vi.mock("../src/helpers/debug", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logError: vi.fn(),
}));

describe("Accessio class", () => {
  let accessio: InstanceType<typeof Accessio>;

  beforeEach(() => {
    accessio = new Accessio({
      baseURL: "https://api.test.com",
      timeout: 5000,
    });
  });

  describe("constructor", () => {
    it("stores instance defaults", () => {
      expect(accessio.defaults.baseURL).toBe("https://api.test.com");
      expect(accessio.defaults.timeout).toBe(5000);
    });

    it("creates request and response interceptor managers", () => {
      expect(accessio.interceptors.request).toBeDefined();
      expect(accessio.interceptors.response).toBeDefined();
      expect(typeof accessio.interceptors.request.use).toBe("function");
      expect(typeof accessio.interceptors.response.use).toBe("function");
    });

    it("defaults to empty config when none provided", () => {
      const c = new Accessio();
      expect(c.defaults).toEqual({});
    });
  });

  describe("request()", () => {
    it("accepts a config object", async () => {
      const res = await accessio.request({ url: "/users", method: "get" });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ ok: true });
    });

    it("accepts (url, config) syntax", async () => {
      const res = await accessio.request("/users", { method: "post" });
      expect(res.config.url).toBe("/users");
      expect(res.config.method).toBe("post");
    });

    it('defaults method to "get"', async () => {
      const res = await accessio.request({ url: "/test" });
      expect(res.config.method).toBe("get");
    });

    it("lowercases the method", async () => {
      const res = await accessio.request({ url: "/test", method: "POST" });
      expect(res.config.method).toBe("post");
    });

    it("throws AccessioError when no url or baseURL is provided", () => {
      const bare = new Accessio();
      expect(() => bare.request({})).toThrow("Request URL is required");
    });

    it("merges with instance defaults", async () => {
      const res = await accessio.request({ url: "/users" });
      expect(res.config.baseURL).toBe("https://api.test.com");
      expect(res.config.timeout).toBe(5000);
    });
  });

  describe("shorthand methods without body", () => {
    for (const method of ["get", "delete", "head", "options"]) {
      it(`${method}() sets correct method and url`, async () => {
        const res = await accessio[method as keyof typeof accessio]("/endpoint");
        expect(res.config.method).toBe(method);
        expect(res.config.url).toBe("/endpoint");
      });

      it(`${method}() merges extra config`, async () => {
        const res = await accessio[method as keyof typeof accessio]("/endpoint", { timeout: 9999 });
        expect(res.config.timeout).toBe(9999);
      });
    }
  });

  describe("shorthand methods with body", () => {
    for (const method of ["post", "put", "patch"]) {
      it(`${method}() sets method, url, and data`, async () => {
        const body = { name: "test" };
        const res = await accessio[method as keyof typeof accessio]("/endpoint", body);
        expect(res.config.method).toBe(method);
        expect(res.config.url).toBe("/endpoint");
        expect(res.config.data).toEqual(body);
      });

      it(`${method}() merges extra config`, async () => {
        const res = await accessio[method as keyof typeof accessio]("/endpoint", null, {
          timeout: 1234,
        });
        expect(res.config.timeout).toBe(1234);
      });
    }
  });

  describe("form methods", () => {
    for (const method of ["post", "put", "patch"]) {
      const formMethod = `${method}Form`;

      it(`${formMethod}() sets Content-Type to multipart/form-data`, async () => {
        const res = await accessio[formMethod as keyof typeof accessio]("/upload", { file: "data" });
        expect(res.config.headers).toBeDefined();
        expect(res.config.headers["Content-Type"]).toBe("multipart/form-data");
      });

      it(`${formMethod}() sets correct method`, async () => {
        const res = await accessio[formMethod as keyof typeof accessio]("/upload", null);
        expect(res.config.method).toBe(method);
      });
    }
  });

  describe("getUri()", () => {
    it("builds URL from config and defaults", () => {
      const uri = accessio.getUri({ url: "/users", params: { page: 1 } });
      expect(uri).toBe("https://api.test.com/users?page=1");
    });

    it("works without params", () => {
      const uri = accessio.getUri({ url: "/users" });
      expect(uri).toBe("https://api.test.com/users");
    });
  });

  describe("interceptors", () => {
    it("request interceptors modify config", async () => {
      accessio.interceptors.request.use((config: any) => {
        config.headers = config.headers || {};
        config.headers["X-Test"] = "intercepted";
        return config;
      });

      const res = await accessio.request({ url: "/test" });
      expect(res.config.headers["X-Test"]).toBe("intercepted");
    });

    it("response interceptors modify response", async () => {
      accessio.interceptors.response.use((response: any) => {
        response.data = { ...response.data, intercepted: true };
        return response;
      });

      const res = await accessio.request({ url: "/test" });
      expect(res.data.intercepted).toBe(true);
    });

    it("request interceptors with runWhen condition", async () => {
      let called = false;
      accessio.interceptors.request.use(
        (config: any) => {
          called = true;
          return config;
        },
        undefined,
        { runWhen: (config: any) => config.method === "post" },
      );

      await accessio.get("/test");
      expect(called).toBe(false);
    });

    it("request interceptors run in reverse order", async () => {
      const order: string[] = [];
      accessio.interceptors.request.use((config: any) => {
        order.push("first");
        return config;
      });
      accessio.interceptors.request.use((config: any) => {
        order.push("second");
        return config;
      });

      await accessio.request({ url: "/test" });
      expect(order).toEqual(["second", "first"]);
    });

    it("response interceptors run in normal order", async () => {
      const order: string[] = [];
      accessio.interceptors.response.use((response: any) => {
        order.push("first");
        return response;
      });
      accessio.interceptors.response.use((response: any) => {
        order.push("second");
        return response;
      });

      await accessio.request({ url: "/test" });
      expect(order).toEqual(["first", "second"]);
    });

    it("ejected interceptors are skipped", async () => {
      let called = false;
      const id = accessio.interceptors.request.use((config: any) => {
        called = true;
        return config;
      });
      accessio.interceptors.request.eject(id);

      await accessio.request({ url: "/test" });
      expect(called).toBe(false);
    });
  });
});
