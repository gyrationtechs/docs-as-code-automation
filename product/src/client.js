import { Messages } from './messages.js';
import { Webhooks } from './webhooks.js';

/** Error thrown for any non-2xx response from the Acme Mail API. */
export class AcmeMailError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'AcmeMailError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Entry point for the Acme Mail SDK.
 *
 * @param {string} apiKey  Your Acme Mail API key.
 * @param {object} [options]
 * @param {string} [options.baseUrl]  Override the API base URL.
 * @param {number} [options.timeout]  Request timeout in milliseconds.
 */
export class AcmeMail {
  constructor(apiKey, { baseUrl = 'https://api.acmemail.dev/v1', timeout = 10000 } = {}) {
    if (!apiKey) throw new Error('AcmeMail: an API key is required');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.messages = new Messages(this);
    this.webhooks = new Webhooks(this);
  }

  async request(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AcmeMailError(data.message || res.statusText, res.status, data.code);
    return data;
  }
}
