# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Changed

- Migrated package publishing to npmjs and implemented automated GitHub Pages deployment workflow.

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
- Cleaned up ESLint configuration syntax and refined documentation formatting.
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
- Initial stable release published to npm
