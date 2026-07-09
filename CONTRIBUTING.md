# Contributing to Accessio 🎯

Thank you for your interest in contributing to **Accessio**! It is contributors like you who make this project a fast, flexible, and robust HTTP client for everyone.

This document provides guidelines and instructions to help you get started with your contribution, set up your local development environment, and understand our codebase patterns.

---

## 🧭 Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and professional environment. Please be kind, constructive, and helpful to all members of the community.

---

## 🌈 How to Contribute

### 1. Reporting Bugs 🐛

If you find a bug, please check the [existing issues](https://github.com/salvatorecorvaglia/accessio/issues) to make sure it hasn't already been reported. If it's a new issue, open a bug report and include:

- A clear, descriptive title and summary.
- The version of Accessio you are using.
- Steps to reproduce the bug (a minimal reproducing code snippet or repository is highly appreciated).
- Expected vs. actual behavior.
- Details about your environment (Node.js version, browser version, operating system).

### 2. Suggesting Enhancements 💡

We are always open to improvements! To suggest a feature:

- Check the [issues](https://github.com/salvatorecorvaglia/accessio/issues) to see if it has already been proposed.
- Open a new issue describing the feature, why it is needed, how it should behave, and any potential API designs.

### 3. Submitting Pull Requests 🚀

When you're ready to submit a change:

1.  **Fork** the repository and create your branch from `main`.
2.  Follow the **Development Workflow** below to set up your environment, make changes, run tests, and format your code.
3.  Commit your changes using standard commit messages (see [Commit Message Guidelines](#-commit-message-guidelines)).
4.  Open a Pull Request (PR) against the `main` branch. Ensure you fill out the provided PR template.

---

## 🛠️ Development Workflow

### Prerequisites

- **Node.js**: Version `18.0.0` or higher is required.
- **pnpm**: The package manager configured with this repository.

### Local Setup

Clone your fork of the repository and install the dependencies:

```bash
git clone https://github.com/<your-username>/accessio.git
cd accessio
pnpm install
```

### Directory Structure

Familiarize yourself with the project's layout:

- `src/`: The core library source code written in TypeScript.
  - `src/accessio.ts`: Core client implementation and API class.
  - `src/index.ts`: The package entry point.
  - `src/types.ts`: Global TypeScript type definitions.
  - `src/core/`: Internal modules (URL builders, configuration merging, retry mechanics, request handlers).
  - `src/helpers/`: Utility helpers (caching, limiters, header parsing, transform functions).
  - `src/defaults/`: Default configurations.
  - `src/interceptors/`: Request/response interceptor management.
- `tests/`: Comprehensive test suite written with **Vitest**. Includes unit, integration, and dedicated regression/feature test suites (such as `tests/gql.test.ts` for GraphQL, `tests/stream.test.ts` for streaming, `tests/memoryCache.test.ts` for cache behavior, and `tests/bugs_regression_fixes.test.ts` for regression fixes).
- `cjs/`: Output directory containing compiled CommonJS modules (built via `tsup`).
- `esm/`: Output directory containing compiled ES Modules (built via `tsup`).

### Useful Scripts & Commands

Accessio uses several scripts to ensure code quality, proper types, and comprehensive test coverage.

| Command                 | Description                                                                           |
| :---------------------- | :------------------------------------------------------------------------------------ |
| `pnpm test`             | Run all unit tests (Node.js environment)                                              |
| `pnpm run test:watch`   | Run tests in watch mode for active development                                        |
| `pnpm run test:coverage`| Run all tests and generate a test coverage report                                     |
| `pnpm run test:browser` | Run tests in a simulated browser environment using `jsdom`                            |
| `pnpm run lint`         | Run Biome to check formatting, linting, and quality rules                            |
| `pnpm run lint:fix`     | Run Biome to automatically format and fix linting/import issues                       |
| `pnpm run format`       | Format files in the repository using Biome                                            |
| `pnpm run typecheck`    | Run the TypeScript compiler in dry-run mode (`tsc --noEmit`) to check for type errors |
| `pnpm run build`        | Build the project for distribution (CommonJS and ESM outputs)                         |

> [!IMPORTANT]
> Always run `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` before submitting a pull request to ensure the CI pipeline passes.

---

## 📐 Design Principles

When writing code for Accessio, please adhere to our core design values:

1.  **Zero Dependencies**: The core package must remain entirely dependency-free. Do not add any runtime dependencies.
2.  **Modern Standards**: Rely on modern JavaScript/TypeScript standards and browser/Node APIs (e.g., native `fetch`, `AbortController`).
3.  **Modular Features**: Extra features like rate limiting, debugging logs, custom cache providers, or schema validation should be optional, lightweight, and easily tree-shaken.
4.  **Premium Developer Experience (DX)**: APIs should be intuitive, types should be precise, and warnings/errors should be helpful and descriptive.
5.  **Robust Regression Testing**: When fixing bugs or adding edge-case behaviors, write dedicated regression tests in `tests/bugs_regression_fixes.test.ts` to verify the fix and prevent future regressions.

---

## 💬 Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps us generate clean changelogs and automate releases.

Commit messages should be formatted as follows:

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Common Types:

- `feat`: A new user-facing feature.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `style`: Code formatting changes (Biome updates, lint fixes, etc.).
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `test`: Adding or correcting tests.
- `chore`: Internal chores, build setup, dependencies, etc.

_Example:_ `feat(cache): add stale-while-revalidate strategy support`

---

## 📋 Pull Request Checklist

Before submitting your PR, please verify:

- [ ] Your code compiles correctly with no type errors (`pnpm run typecheck`).
- [ ] All linters and formatters pass with no errors (`pnpm run lint` and `pnpm run format`).
- [ ] Existing and new unit tests pass successfully (`pnpm test` and `pnpm run test:browser`).
- [ ] You have added tests covering the new feature or bug fix.
- [ ] You have updated the documentation or `README.md` if your changes introduce new features or change behavior.
- [ ] Your commit messages follow the Conventional Commits specification.

---

Happy coding! 🎯
