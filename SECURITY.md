# Security Policy

## Supported Versions

The following versions of accessio are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

As accessio is in active development (v0.x), we recommend using the latest version to benefit from security improvements and bug fixes.

## Reporting a Vulnerability

We take the security of accessio seriously. If you discover a security vulnerability, please follow these steps:

### 🔒 Responsible Disclosure

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. **DO** report the vulnerability privately via one of these methods:
   - **GitHub Private Vulnerability Reporting**: [Report a vulnerability](https://github.com/salvatorecorvaglia/accessio/security/advisories/new)

3. Include as much information as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### Response Timeline

- **Initial response**: We will acknowledge your report within **48 hours**
- **Assessment**: We will assess the vulnerability and provide an initial response within **7 days**
- **Fix timeline**: Critical vulnerabilities will be addressed within **14 days** when possible
- **Disclosure**: We will coordinate with you on the disclosure timeline

### What to Expect

- We will keep you informed of the progress toward a fix
- We will credit you in the release notes (unless you prefer to remain anonymous)
- We will notify you before public disclosure
- We may ask for additional information or assistance in verifying the fix

## Security Best Practices

When using accessio in your applications, we recommend following these security practices:

### 🔐 Authentication & Authorization

- Never hardcode credentials or API keys in your source code
- Use environment variables or secure secret management for sensitive configuration
- Always validate and sanitize user input before including it in requests

### 🛡️ Request Validation

- Use the `validateStatus` configuration option to define acceptable response codes
- Implement proper error handling for all HTTP responses, including 4xx and 5xx errors
- Validate response data before processing it in your application

### 🌐 Network Security

- Always use HTTPS in production to encrypt data in transit
- Configure appropriate timeout values to prevent resource exhaustion
- Use `withCredentials` carefully when making cross-origin requests

### ⚙️ Configuration Security

- Review and validate all configuration options before use
- Be cautious when using interceptors that modify request headers or data
- Use the rate limiter to prevent abuse and resource exhaustion

### 📦 Dependency Management

- accessio is **zero-dependency**, reducing the attack surface
- Keep your project dependencies up to date using `npm audit` regularly
- Review the accessio source code for any concerns — it's open source and auditable

## Security Features

accessio includes several built-in security features:

- **Zero external dependencies** — reduces supply chain attack risk
- **Structured error handling** — prevents information leakage in error messages
- **Configurable timeouts** — prevents resource exhaustion attacks
- **Request cancellation** — supports `AbortController` for request lifecycle management
- **Rate limiting** — prevents abuse through concurrency control

## Known Limitations

- accessio relies on the native `fetch` API; security vulnerabilities in the underlying implementation may affect accessio
- In browser environments, accessio is subject to the browser's same-origin policy and CORS restrictions

## Acknowledgments

We would like to thank the security researchers and community members who responsiblyably disclose vulnerabilities and help improve the security of accessio.
