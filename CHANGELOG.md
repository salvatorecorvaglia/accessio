# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- Initial stable release published to npm

## [0.0.1] - 2026-04-21

### Added

- First implementation of accessio.
