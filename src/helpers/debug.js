/**
 * Debug helper for Accessio HTTP client.
 *
 * When `config.debug` is true, logs request/response details to the console.
 * Useful for development and troubleshooting.
 *
 * NOTE: The full URL is accepted as a pre-built parameter rather than imported
 * from core/buildURL, to avoid an unusual helpers → core dependency direction.
 * The caller (accessio.js) already has buildURL available.
 */

/**
 * Format bytes into a human-readable string.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Removes sensitive fields from the config before logging.
 * Prevents credentials (Basic Auth, Authorization header) from leaking into the console.
 *
 * @param {object} config
 * @returns {{ params: object|undefined, timeout: number|undefined, retry: number|undefined }}
 */
function sanitizeConfigForLog(config) {
  return {
    params: config.params,
    timeout: config.timeout,
    retry: config.retry,
    // auth and Authorization headers are deliberately omitted
  };
}

/**
 * Log a request before it's sent.
 *
 * @param {object} config - Request configuration
 * @param {string} fullUrl - Pre-built full URL (avoids a redundant buildURL dependency)
 */
export function logRequest(config, fullUrl) {
  if (!config.debug) return;

  const safe = sanitizeConfigForLog(config);

  const method = (config.method || "GET").toUpperCase();
  const url = fullUrl || config.url || "";

  const parts = [`🐦‍⬛ [Accessio] → ${method} ${url}`];

  if (safe.params && Object.keys(safe.params).length > 0) {
    parts.push(`   Params: ${JSON.stringify(safe.params)}`);
  }

  if (config.data && typeof config.data === "object") {
    const preview = JSON.stringify(config.data);
    const truncated =
      preview.length > 200 ? `${preview.substring(0, 200)}...` : preview;
    parts.push(`   Body: ${truncated}`);
  }

  if (safe.timeout) {
    parts.push(`   Timeout: ${safe.timeout}ms`);
  }

  if (safe.retry) {
    parts.push(`   Retry: ${safe.retry}x`);
  }

  console.log(parts.join("\n"));
}

/**
 * Log a response after it's received.
 *
 * @param {object} response - Response object
 */
export function logResponse(response) {
  if (!response.config || !response.config.debug) return;
  const status = response.status;
  const statusText = response.statusText || "";
  const duration = response.duration != null ? `${response.duration}ms` : "??";

  const statusIcon =
    status >= 200 && status < 300 ? "✅" : status >= 400 ? "❌" : "⚠️";

  const parts = [
    `🐦‍⬛ [Accessio] ← ${statusIcon} ${status} ${statusText} (${duration})`,
  ];

  // Log response size if we can estimate it
  if (response.data) {
    try {
      const size =
        typeof response.data === "string"
          ? response.data.length
          : JSON.stringify(response.data).length;
      parts.push(`   Size: ~${formatBytes(size)}`);
    } catch {
      // ignore
    }
  }

  console.log(parts.join("\n"));
}

/**
 * Log an error.
 *
 * @param {Error} error - Error object
 * @param {object} [config] - Request configuration
 */
export function logError(error, config) {
  if (!config || !config.debug) return;

  const parts = [`🐦‍⬛ [Accessio] ← ❌ ERROR: ${error.message}`];

  if (error.code) {
    parts.push(`   Code: ${error.code}`);
  }

  if (error.response) {
    parts.push(`   Status: ${error.response.status}`);
  }

  console.log(parts.join("\n"));
}
