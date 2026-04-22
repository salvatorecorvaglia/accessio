import { describe, it, expect, vi } from "vitest";

vi.mock("../src/core/request", () => ({
  default: vi.fn((config: any) =>
    Promise.resolve({
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      request: {},
      duration: 10,
    }),
  ),
}));

vi.mock("../src/core/retry", () => ({
  default: vi.fn((dispatchFn: any, config: any) => dispatchFn(config)),
}));

vi.mock("../src/helpers/debug", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logError: vi.fn(),
}));

import accessio, {
  Accessio,
  AccessioError,
  mergeConfig,
  buildURL,
  InterceptorManager,
  createInstance,
  createRateLimiter,
} from "../src/index";

describe("index.ts — default instance and exports", () => {
  describe("default export (accessio)", () => {
    it("is a callable function", () => {
      expect(typeof accessio).toBe("function");
    });

    it("has all HTTP shorthand methods", () => {
      const methods = [
        "request",
        "get",
        "delete",
        "head",
        "options",
        "post",
        "put",
        "patch",
      ];
      for (const method of methods) {
        expect(typeof (accessio as any)[method]).toBe("function");
      }
    });

    it("has form methods", () => {
      for (const method of ["postForm", "putForm", "patchForm"]) {
        expect(typeof (accessio as any)[method]).toBe("function");
      }
    });

    it("has getUri", () => {
      expect(typeof accessio.getUri).toBe("function");
    });

    it("has defaults property", () => {
      expect(accessio.defaults).toBeDefined();
      expect(accessio.defaults.method).toBe("get");
    });

    it("has interceptors", () => {
      expect(accessio.interceptors).toBeDefined();
      expect(accessio.interceptors.request).toBeDefined();
      expect(accessio.interceptors.response).toBeDefined();
    });

    it("accessio(config) delegates to request()", async () => {
      const res = await accessio({ url: "https://test.com/api" });
      expect(res.status).toBe(200);
    });

    it("accessio(url, config) delegates to request()", async () => {
      const res = await accessio("https://test.com/api", { method: "post" });
      expect(res.config.url).toBe("https://test.com/api");
    });
  });

  describe("accessio.create()", () => {
    it("creates a new callable instance", () => {
      const instance = accessio.create({ baseURL: "https://api.test.com" });
      expect(typeof instance).toBe("function");
    });

    it("merges config with defaults", () => {
      const instance = accessio.create({
        baseURL: "https://custom.com",
        timeout: 3000,
      });
      expect(instance.defaults.baseURL).toBe("https://custom.com");
      expect(instance.defaults.timeout).toBe(3000);
      expect(instance.defaults.responseType).toBe("json");
    });

    it("has all shorthand methods", () => {
      const instance = accessio.create({});
      for (const method of [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
      ]) {
        expect(typeof (instance as any)[method]).toBe("function");
      }
    });

    it("has independent interceptors", () => {
      const instance = accessio.create({});
      expect(instance.interceptors).toBeDefined();
      expect(instance.interceptors.request).not.toBe(
        accessio.interceptors.request,
      );
    });
  });

  describe("accessio.all()", () => {
    it("resolves all promises concurrently", async () => {
      const results = await accessio.all([
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3),
      ]);
      expect(results).toEqual([1, 2, 3]);
    });

    it("rejects if any promise rejects", async () => {
      await expect(
        accessio.all([Promise.resolve(1), Promise.reject(new Error("fail"))]),
      ).rejects.toThrow("fail");
    });
  });

  describe("accessio.spread()", () => {
    it("spreads array to arguments", () => {
      const fn = accessio.spread((a: number, b: number) => a + b);
      expect(fn([3, 7])).toBe(10);
    });
  });

  describe("accessio.isCancel()", () => {
    it("returns true for cancel errors", () => {
      const error = new AccessioError("cancelled", "ERR_CANCELED", null, null, null);
      (error as any).isAccessioError = true;
      expect(accessio.isCancel(error)).toBe(true);
    });

    it("returns false for non-cancel errors", () => {
      const error = new AccessioError("network", "ERR_NETWORK", null, null, null);
      expect(accessio.isCancel(error)).toBe(false);
    });

    it("returns false for non-AccessioError values", () => {
      expect(accessio.isCancel(null)).toBe(false);
      expect(accessio.isCancel(new Error("normal"))).toBe(false);
    });
  });

  describe("accessio.isAccessioError()", () => {
    it("returns true for AccessioError instances", () => {
      expect(accessio.isAccessioError(new AccessioError("test", "", null, null, null))).toBe(true);
    });

    it("returns true for duck-typed AccessioErrors", () => {
      expect(accessio.isAccessioError({ isAccessioError: true })).toBe(true);
    });

    it("returns false for regular errors", () => {
      expect(accessio.isAccessioError(new Error("test"))).toBe(false);
    });

    it("returns false for non-errors", () => {
      expect(accessio.isAccessioError(null)).toBe(false);
      expect(accessio.isAccessioError("string")).toBe(false);
    });
  });

  describe("exposed classes and utilities", () => {
    it("exposes AccessioError class", () => {
      expect(accessio.AccessioError).toBe(AccessioError);
    });

    it("exposes Accessio class", () => {
      expect(accessio.Accessio).toBe(Accessio);
    });

    it("exposes mergeConfig", () => {
      expect(accessio.mergeConfig).toBe(mergeConfig);
    });

    it("exposes buildURL", () => {
      expect(accessio.buildURL).toBe(buildURL);
    });

    it("exposes InterceptorManager", () => {
      expect(accessio.InterceptorManager).toBe(InterceptorManager);
    });

    it("exposes createRateLimiter", () => {
      expect(accessio.createRateLimiter).toBe(createRateLimiter);
    });
  });

  describe("named exports", () => {
    it("exports Accessio class", () => {
      expect(Accessio).toBeDefined();
      expect(typeof Accessio).toBe("function");
    });

    it("exports AccessioError class", () => {
      expect(AccessioError).toBeDefined();
      expect(typeof AccessioError).toBe("function");
    });

    it("exports mergeConfig function", () => {
      expect(typeof mergeConfig).toBe("function");
    });

    it("exports buildURL function", () => {
      expect(typeof buildURL).toBe("function");
    });

    it("exports InterceptorManager class", () => {
      expect(typeof InterceptorManager).toBe("function");
    });

    it("exports createInstance function", () => {
      expect(typeof createInstance).toBe("function");
    });

    it("exports createRateLimiter function", () => {
      expect(typeof createRateLimiter).toBe("function");
    });
  });
});
