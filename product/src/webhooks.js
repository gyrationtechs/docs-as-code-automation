/** Manage webhook endpoints. Available as `client.webhooks`. */
export class Webhooks {
  constructor(client) {
    this.client = client;
  }

  /**
   * Register a webhook endpoint.
   *
   * @param {object} options
   * @param {string} options.url        HTTPS endpoint that receives events.
   * @param {string[]} options.events   Any of: delivered, bounced, opened, clicked.
   * @returns {Promise<{ webhookId: string, signingSecret: string }>}
   */
  async create({ url, events }) {
    if (!url.startsWith('https://')) throw new Error('webhooks.create: url must use https');
    return this.client.request('POST', '/webhooks', { url, events });
  }

  /** @returns {Promise<Array<{ webhookId: string, url: string, events: string[] }>>} */
  async list() {
    return this.client.request('GET', '/webhooks');
  }

  /** @param {string} webhookId */
  async delete(webhookId) {
    return this.client.request('DELETE', `/webhooks/${webhookId}`);
  }
}
