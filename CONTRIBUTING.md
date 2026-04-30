# Contributing to accessio 🎯

First off, thank you for considering contributing to `accessio`! It's people like you who make the open-source community such an amazing place to learn, inspire, and create.

## 🌈 How Can I Contribute?

### Reporting Bugs 🐛

Before creating a bug report, please check the [existing issues](https://github.com/salvatorecorvaglia/accessio/issues) to see if the problem has already been reported.

When filing an issue, please include:

- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Environment details (Node.js version, Browser, OS).

### Suggesting Enhancements 💡

We are always looking for ways to improve `accessio`. If you have an idea for a new feature or an improvement to an existing one:

- Check if it's already been suggested in the [issues](https://github.com/salvatorecorvaglia/accessio/issues).
- Open a new issue with the "enhancement" label.
- Provide a clear description of the feature and its benefits.

### Pull Requests 🚀

1. **Fork** the repository and create your branch from `main`.
2. **Install dependencies**: `npm install`.
3. **Make your changes**. If you're adding a feature or fixing a bug, please include tests.
4. **Lint**: Ensure your code follows the project's style by running `npm run lint`.
5. **Run tests**: Make sure all tests pass by running `npm run test`.
6. **Commit your changes**: Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add new interceptor logic` or `fix: resolve timeout jitter issue`).
7. **Submit a Pull Request** to the `main` branch.

## 🛠️ Local Development

### Prerequisites

- Node.js ≥ 18.0.0
- npm

### Setup

```bash
git clone https://github.com/salvatorecorvaglia/accessio.git
cd accessio
npm install
```

### Useful Scripts

- `npm run build`: Build the project (CJS/ESM).
- `npm run lint`: Check for linting errors.
- `npm run lint:fix`: Automatically fix linting errors.
- `npm run test`: Run the test suite.
- `npm run test:watch`: Run tests in watch mode.
- `npm run typecheck`: Run TypeScript type checking.

## 📜 Code of Conduct

By participating in this project, you agree to abide by the terms of our [Code of Conduct](CODE_OF_CONDUCT.md) (if applicable) and maintain a respectful environment for everyone.

## 💎 Design Principles

- **Zero Dependencies**: Keep the core lightweight.
- **Modern Standards**: Leverage native `fetch` and modern TypeScript.
- **Developer Experience**: Focus on a clean, intuitive API.

---

Happy coding! 🐦‍⬛
