# Contributing to Accessio 🎯

Thank you for your interest in contributing to **Accessio**! We welcome contributions, bug reports, feature requests, and security improvements from the community.

---

## Getting Started 🚀

### Prerequisites

Accessio uses **Node.js (>= 22.13.0)** and **pnpm** as its workspace package manager. Make sure you have the following installed:

- Node.js (v22 or v24 recommended)
- `pnpm` (v11.x recommended)

### Setup Instructions

1. **Fork the Repository:** Fork the official [repository](https://github.com/salvatorecorvaglia/accessio) on GitHub and clone it locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/accessio.git
   cd accessio
   ```

2. **Install Dependencies:**
   ```bash
   pnpm install
   ```

3. **Check the Build:**
   Validate that the build tooling works correctly:
   ```bash
   pnpm run build
   ```

---

## Development Workflow 🛠️

We use a modern toolchain for linting, formatting, type checking, and testing. Please ensure all these check pass locally before submitting a Pull Request.

### Scripts Summary

| Command | Description |
|---|---|
| `pnpm run build` | Compiles source files into CJS and ESM directories (`cjs/` and `esm/`) using `tsup`. |
| `pnpm run lint` | Runs `biome` to lint all TypeScript and configuration files. |
| `pnpm run lint:fix` | Runs `biome` and applies automated lint fixes. |
| `pnpm run format` | Runs `biome` to format the workspace files. |
| `pnpm run typecheck` | Validates TypeScript compilation without emitting output (`tsc --noEmit`). |
| `pnpm test` | Runs the test suite in Node.js environment via `vitest`. |
| `pnpm run test:browser` | Runs the test suite in a simulated browser environment. |
| `pnpm run test:coverage` | Runs tests and prints coverage statistics. |
| `pnpm run verify:package` | Validates build artifacts, subpath exports, and TypeScript declaration files. |

### Adding Features or Bug Fixes

1. **Create a Branch:**
   Branch off from `main`. Use a descriptive name:
   ```bash
   git checkout -b feature/your-awesome-feature
   # or
   git checkout -b fix/some-bug
   ```

2. **Write Tests:**
   If you are fixing a bug or adding a feature, please write corresponding tests in the `tests/` directory. Accessio uses `vitest`.
   Make sure you cover edge cases and regression scenarios.

3. **Verify Code Quality:**
   Run the following commands to verify everything is healthy:
   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm test
   pnpm run test:browser
   pnpm run verify:package
   ```

4. **Document Changes:**
   - If your change affects public APIs, update the [README.md](./README.md) with relevant details.
   - Summarize your changes under the `[Unreleased]` section in [CHANGELOG.md](./CHANGELOG.md) using the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) standard.

---

## Pull Request Guidelines 📬

When submitting a Pull Request, please ensure:

- The title follows the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g. `feat: add retryDelay custom Jitter`, `fix: handle null headers in request`).
- The description clearly details the motivation, changes made, and references any relevant issues.
- All CI workflows (including linting, type-checking, Node tests, and browser tests) pass.
- You have updated the contributors list in [CONTRIBUTORS.md](./CONTRIBUTORS.md) if you are a new contributor!

---

Happy coding! 🎯