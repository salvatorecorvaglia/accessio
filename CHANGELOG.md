# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.1.0] - 2026-08-25

### Added

- Added `ERR_RATE_LIMIT_QUEUE_FULL` error code so `RateLimiter` queue-full rejections are typed `AccessioError` instances (with redacted config/response context) instead of a plain `Error`.
- Added `Map` and `Set` serialization support to `toFormData`, appending entries/values instead of silently dropping them as empty objects.
- Added a shared `withCycleGuard` helper (`src/helpers/cycleGuard.ts`) used across `buildURL`, `toFormData`, and `AccessioError`'s redaction logic to consistently break circular references while still allowing legitimate reuse of the same object under multiple keys.

### Changed

- Debug request logs (`logRequest`) now redact sensitive URL credentials and query parameters, matching the redaction already applied to `AccessioError`.
- Hardened `mergeConfig` to explicitly skip `__proto__`, `constructor`, and `prototype` keys from both merge sources.
- Clamped `Retry-After`-derived retry delay to a minimum of `0`.
- Expanded test coverage for core utilities and hooks, including `autoPaginate`, `flattenHeaders`, `mergeConfig`, `buildURL`, `toFormData`, `debug`, `retry`, `rateLimiter`, and `stream`.

### Fixed

- Fixed path parameter interpolation in `buildURL` (`:name` syntax) to only match whole path segments, so literal colon-suffixed segments (e.g. `files/123:download`) are no longer mistaken for a `:download` placeholder and corrupted.
- Fixed `buildFetchHeaders` to preserve explicitly-set empty-array header values as an empty header instead of dropping them.

## [4.0.1] - 2026-08-11

### Changed

- Updated devDependencies: `@types/node` to `26.2.0`.
- Added `postcss` (`^8.5.23`) override in `pnpm-workspace.yaml`.

## [4.0.0] - 2026-08-07

### Added

- Added `onDownloadProgress` callback support in `AccessioRequestConfig` to track real-time download progress (`loaded`, `total`, `bytes`, `progress`) during response body streaming.
- Added `maxRedirects` option in `AccessioRequestConfig` with automatic redirect tracking and loop detection.
- Added granular subpath exports in `package.json` for helper and core utilities (`accessio/helpers/rateLimiter`, `accessio/helpers/debug`, `accessio/core/buildURL`, `accessio/core/mergeConfig`, `accessio/core/request`, `accessio/core/retry`, `accessio/helpers/parseHeaders`, `accessio/helpers/settle`, `accessio/helpers/transformData`).
- Added standalone package verification script `scripts/verify-package.mjs` and npm script `pnpm run verify:package` to validate bundle outputs, entry points, and TypeScript declaration files prior to release.
- Added comprehensive regression test suites for download progress, redirect limits, cache settlement, logic fixes, and shorthand config overloads (`tests/downloadProgress.test.ts`, `tests/redirects.test.ts`, `tests/cacheSettle.test.ts`, `tests/logicFixes.test.ts`, `tests/shorthandConfig.test.ts`).

### Changed

- Updated GitHub Actions workflows (`ci.yml`, `publish-npm.yml`, `release.yml`) to run package verification via `pnpm run verify:package`.
- Refactored `Accessio` class shorthand methods to consistently merge instance defaults with per-request configuration options.

### Fixed

- Fixed response cache settlement handling in `request.ts` when interacting with custom interceptors and inflight request deduplication subscribers.
- Hardened rate limiter queue eviction and cancellation listener cleanup under high concurrent load.
- Hardened protocol validation for relative and protocol-relative request URLs.

## [3.2.0] - 2026-07-25

### Changed

- Updated minimum Node.js runtime requirement to `22.13.0` (with Node 22/24 recommended) and workspace package manager `pnpm` to `v11.x`.
- Refactored internal request dispatch logic into a unified `executeFetchRequest` helper in `src/core/request.ts` to streamline standard and deduplicated request paths.
- Refactored `MemoryCache` proactive eviction scanning using `for...of` entry iteration.
- Updated GitHub Actions release workflow (`release.yml`) for package distribution.

### Fixed

- Fixed `autoPaginate` parameter handling to clone `params`, preventing mutation of frozen parameter objects (`Object.freeze(...)`).
- Hardened protocol validation in `assertAllowedProtocol` to check protocol-relative URLs (`//domain.com/api`) against `allowedProtocols`.
- Expanded sensitive header redaction in `AccessioError` to automatically mask `x-api-key`, `api-key`, and `proxy-authorization` headers alongside `authorization`.

## [3.1.0] - 2026-07-18

### Added

- Added upfront response `content-length` validation check in `fetchAdapter` to fail immediately if `maxContentLength` is exceeded.

### Changed

- Updated GitHub Actions CI workflows to dynamically cancel in-progress runs only on pull request events.
- Expanded release verification coverage in GitHub workflows to include type checking and browser testing.

### Fixed

- Fixed URL redaction in `AccessioError` to scrub sensitive query parameters (such as `api_key` and `password`) from error objects and logged request configurations.
- Fixed stream signal management in `fetchAdapter` to clean up timeout and abort event listeners immediately upon direct stream cancellation via `stream.cancel()`.
- Fixed active request tracking to prevent evicting and aborting in-flight concurrent requests under high concurrency limits.
- Fixed header flattening in `flattenHeaders` to handle primitive header values that collide with HTTP method names or `common`.
- Fixed data transformation in `transformData` to accept a single function option in `transformRequest`/`transformResponse` alongside arrays of transforms.
- Fixed `MemoryCache` to correctly update insertion order and eviction priority when an existing cache key is updated.
- Fixed interceptor iteration in `handlers` getter to iterate over active map entries, avoiding performance degradation with high interceptor IDs.

## [3.0.0] - 2026-07-11

### Added

- Added `maxContentLength` configuration option to enforce streaming response download size limits (throws `AccessioError` with `ERR_BAD_RESPONSE` when exceeded).
- Added `paginateItems` configuration option (`string | ((data: any) => any[])`) to `autoPaginate()` to allow custom extraction of paginated items.
- Exported all TypeScript types from the main entrypoint via `export type * from './types'`.
- Added a regression test suite (`tests/regression_fixes_v3.test.ts`) covering response size limits, custom pagination, interceptors, request deduplication, and rate limit abort behavior.

### Changed

- Migrated workspace package manager from npm to pnpm (`v10.34.4`), introducing workspace-wide package dependency management and updating all GitHub Actions CI workflows to use `pnpm/action-setup@v6`.
- Refactored request deduplication to use a subscriber-based execution pattern, ensuring correct hook execution and response cloning for duplicate concurrent requests.
- Improved abort handling in request deduplication to automatically abort the backing fetch request if all subscriber signals are aborted.
- Restricted synchronous request interceptors from returning a `Promise`, throwing a bad option error if one is returned.
- Updated configuration merging in `mergeConfig` to use standard object literals `{}` instead of `Object.create(null)`.
- Updated `autoPaginate` logic to selectively strip only query parameters present in the next URL, preserving other custom parameters.
- Capped retry backoff delay to a maximum value defined by `maxRetryDelay` (defaulting to 30,000ms).
- Updated package exports to point types to `./esm/index.d.ts` and separate granular TypeScript declarations for subpaths.
- Moved `esbuild` dependency override from `package.json` to `pnpm-workspace.yaml`.

## [2.0.0] - 2026-06-29

### Added

- Added `gql()` client method to perform GraphQL POST requests with `query` and `variables` payloads.
- Added `formSerializer` configuration option (`{ brackets?: boolean }`) to customize nested object serialization in `FormData` (enabling bracket notation vs default dot notation).
- Added `cacheClone` configuration option (`boolean`, defaults to `true`) to allow bypassing caching/shared response cloning for performance or reference preservation when set to `false`.
- Added static `Accessio.publicMethods` property listing all exposed API helper methods on the class/instance.

### Changed

- Refactored `AccessioError` to lazily redact and cache configurations on access, improving instantiation performance.
- Updated `setBasicAuth` helper to preserve the case of existing `Authorization` / `authorization` header keys.

### Fixed

- Fixed stream signal management in `fetchAdapter` to ensure abort and timeout event listeners remain active throughout stream reading and are properly cleaned up upon completion, cancellation, or error.
- Fixed query parameter serialization in `serializeParams` to handle circular references safely using a `WeakSet`.
- Fixed header parsing in `parseHeaders` to support capturing multiple `Set-Cookie` headers via `getSetCookie()` when available.
- Fixed signal propagation in `stream()` and `autoPaginate()` to correctly forward aborted signals to the request options.

## [1.9.0] - 2026-06-21

### Added

- Added support for Node.js streams and async iterables (using `Symbol.asyncIterator`) in the `stream()` method, alongside standard web streams.
- Added dual ESM/CJS build outputs for package distribution.
- Added a comprehensive regression test suite (`tests/regression_fixes_v2.test.ts`) covering circular structures, stream iterator consumption, SSE line endings, retry abort behavior, response transforms, and cache mutation protection.

### Changed

- Updated `tsup.config.ts` build configuration to compile and bundle both CommonJS and ES Modules outputs.
- Updated `package.json` fields (`module`, `exports`, and `files`), `.gitignore`, and `biome.json` to support and ignore the new `esm/` distribution directory.
- Updated request dispatch to run `transformResponse` independently for deduplicated requests sharing an inflight request.

### Fixed

- Fixed `toFormData` to gracefully handle circular references using a `WeakSet`, preventing stack overflow errors.
- Fixed `stream()` SSE processing to robustly strip carriage returns (`\r\r\n` or `\r\n`) from incoming chunk lines.
- Fixed request caching and deduplication to clone response data and headers before returning or caching, protecting cached/shared data against downstream mutations.
- Fixed request retry logic to handle signal aborts during retry backoff sleep delays, immediately throwing an `AccessioError` with `ERR_CANCELED` code and proper cancellation context.

## [1.8.0] - 2026-06-18

### Added

- Added support for a `maxQueueSize` option in the `RateLimiter` configuration to restrict request queue growth and avoid memory exhaustion.
- Exposed the `maxQueueSize` parameter in `createRateLimiter` TypeScript definitions.

### Changed

- Migrated workspace tooling to Biome for unified, high-performance linting, formatting, and import sorting.
- Updated npm scripts (`lint`, `lint:fix`, `format`) and GitHub Actions CI configuration to run Biome checks.
- Refactored response interceptor loops into a private `runResponseInterceptors` helper for cleaner execution.
- Added `typecheck` and `test:browser` verification steps to the GitHub Actions CI workflow.

### Fixed

- Fixed configuration and response body redaction logic to handle circular references safely, truncate extremely large objects/arrays, and detect binary/stream data.
- Fixed fetch adapter abort handling to always use standard event listeners instead of `AbortSignal.any` for more robust propagation and cleanup.
- Fixed query parameter duplication in `autoPaginate` by explicitly clearing the params cache on pagination transitions.
- Fixed `toFormData` to skip recursive serialization of binary formats (e.g. `ArrayBuffer`, typed arrays, and `Buffer`), preventing stack overflow errors.


## [1.7.2] - 2026-06-13

### Changed

- Optimized URL path concatenation in `combineURLs` by replacing regex slash trimming with manual loop index slicing.
- Updated URL construction in `combineURLs` to use template literal syntax and improved request cache key generation wrapping.

### Security

- Restored `esbuild` dependency override in `package.json` to resolve high-severity security vulnerabilities (GHSA-gv7w-rqvm-qjhr and GHSA-g7r4-m6w7-qqqr) in `tsup`'s dependency tree.

## [1.7.1] - 2026-06-13

### Changed

- Optimized `flattenHeaders` to use a lookup map for case-insensitive deduplication instead of iterating all existing keys on every insertion.
- Replaced `Object.entries` and `.forEach` iteration in `flattenHeaders` and `buildFetchHeaders` with `for...in` loops and explicit `hasOwnProperty` checks for improved performance.
- Optimized `mergeConfig` to iterate each config object independently, avoiding a combined `Set` allocation and reducing redundant key lookups.
- Refactored `buildURL` to skip regex-based parameter interpolation when the URL contains no path parameters, avoiding unnecessary object allocation and regex execution.
- Skipped cache key computation in `dispatchRequest` for GET requests when neither `cache` nor `dedupe` is enabled.
- Replaced regex-based slash trimming in `combineURLs` with linear `while`-loop scanning to eliminate backtracking.
- Refactored memory cache proactive eviction to use an explicit `keys()` iterator instead of `entries()` destructuring.

### Fixed

- Fixed polynomial regular expression (ReDoS) vulnerability in `combineURLs` (`/\/+$/` and `/^\/+/`) by replacing regexes with character-by-character loop trimming (CodeQL `js/polynomial-redos`).

## [1.7.0] - 2026-06-11

### Added

- Added support for `text` response type in `responseType` configuration.
- Added support for propagating abort signal reason (message and cause) to `AccessioError` when a request is canceled.
- Added comprehensive regression and bug fix test suite in `tests/bugs_regression_fixes.test.ts`.

### Fixed

- Fixed header normalization in `parseHeaders` to correctly flatten array-valued headers (e.g. `Set-Cookie`).
- Fixed case-insensitive header merging in `flattenHeaders` to avoid duplicate header variants (e.g. `Content-Type` vs `content-type`).

### Changed

- Optimized memory cache proactive eviction to check up to 5 oldest items per insertion to prevent memory build-up without O(N) complexity.
- Updated transform functions to receive the full request config object as the third argument.
- Updated CI/CD configuration to run `npm pack --dry-run` instead of `npm publish --dry-run`.
- Tightened GitHub Actions release workflow permissions by removing write access for `packages` and `actions`.

## [1.6.0] - 2026-06-09

### Added

- Added support for a custom cache key serializer (`cacheKeySerializer` option) in request configurations.
- Added max item capacity limits and expired item eviction controls to the memory cache provider, exposing the `MemoryCache` class.
- Added deep merging support for `params` and `hooks` configurations in `mergeConfig`.

### Fixed

- Fixed request deduplication logic to correctly settle concurrent requests sharing the same inflight request and propagate standard request hooks (`onRequestResponse` and `onRequestError`).
- Fixed parameter regex interpolation in `buildURL` to prevent incorrect identifier matching.
- Excluded transient environment-specific headers (e.g., `user-agent`, `host`, `connection`, `content-length`, `accept-encoding`) from the default cache key generator and dynamically sorted headers to avoid cache key collisions.

### Changed

- Expanded documentation for retries, rate limiting, and caching controls in `README.md`.
- Upgraded `vitest` and `@vitest/coverage-v8` to version 4.1.8.
- Cleaned up the repository by removing obsolete documentation site files, workflows, and Code of Conduct references.

## [1.5.0] - 2026-05-22

### Added

- Added abort/signal support in `RateLimiter.acquire(signal)` to eject queued requests immediately and reclaim queue capacity.
- Supported configuring `maxRetryDelay` in the request retry configuration options.

### Fixed

- Fixed rate-limiting retry mechanism to retry HTTP 429 requests up to 3 times by default, even if the primary `retry` config option is set to 0.
- Fixed error configuration redaction to mask sensitive query parameters and inline credentials in URLs.
- Fixed SSE stream reader in Node/native environment to process the remaining buffer correctly upon stream completion, ensure stream cancellation on failure, and handle non-object responses gracefully.
- Fixed custom `toFormData` helper to avoid throwing `ReferenceError` in environments without global `File` or `Blob` (e.g. Node/SSR).
- Fixed `flattenHeaders` to skip `null` or `undefined` header values.
- Propagated standard stream cancellation to internal Reader stream in fetchAdapter.
- Avoided retrying Node streams containing a `.pipe` method in retry request utility.

## [1.4.0] - 2026-05-21

### Added

- Added request body redaction to filter sensitive credentials and headers in debug logs and error objects.
- Added request capacity limiting (active request limit and deduplication registry capacity) to prevent resource depletion.
- Added caching support with TTL, custom providers, and header-aware cache keys.
- Added request deduplication to prevent redundant concurrent requests.
- Added lifecycle hooks: `onBeforeRequest`, `onRequestResponse`, and `onRequestError`.
- Added schema validation support for request/response configurations.

### Fixed

- Fixed prototype pollution risk in configuration merging and parameter serialization by guarding prototypes.
- Fixed URL fragment preservation during parameter serialization.
- Fixed handling of response status 0 (e.g. CORS/network errors) in the settle helper.

### Changed

- Refactored `InterceptorManager` to use `Map` for memory-efficient storage and compacted handler execution.
- Consolidated form request helpers (`postForm`, `putForm`, `patchForm`) directly in the Accessio class.
- Improved TypeScript type definitions and aligned `index.d.ts` with `src/types.ts`.

## [1.3.0] - 2026-05-19

### Added

- Added URL protocol allow-list validation with configurable `allowedProtocols` option.
- Implemented redaction of sensitive credentials and headers in request configurations.
- Improved request handling with header validation, improved error reporting for JSON parsing, and robust deduplication logic.

### Fixed

- Prevented retry of `ReadableStream` request bodies to avoid consumption errors.

### Changed

- Simplified rate limiter queue implementation by replacing object-based map with array-based FIFO queue.
- Refactored and cleaned up function signatures and consistent code formatting across source and test files.

## [1.2.0] - 2026-05-18

### Added

- Implemented a flexible caching layer with TTL support and custom providers.
- Added lifecycle hooks (`onBeforeRequest`, `onRequestResponse`, `onRequestError`).
- Enhanced TypeScript configuration and type definitions for better modularity.

### Changed

- Refactored core modules to support hook-based architecture.
- Optimized bundle size and dependency resolution.

## [1.1.2] - 2026-05-16

### Changed

- Enhanced security hardening and minor bug fixes.

## [1.1.1] - 2026-05-15

### Changed

- Refactored URL handling and request logic for better stability.
- Hardened error handling and optimized resource management.
- Addressed technical debt identified during codebase audit.

## [1.1.0] - 2026-05-06

### Added

- Prototype pollution protection in configuration merging.
- Performance optimizations for `RateLimiter` queue.

### Changed

- Refactored `InterceptorManager` and `request.ts` for better modularity.
- Improved test suite robustness and maintenance.

## [1.0.0] - 2026-04-23

### Added

- First implementation of Accessio.

### Chore

- Promoted package version to 1.0.0 for initial official npm release.