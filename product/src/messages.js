/** Send and look up email messages. Available as `client.messages`. */
export class Messages {
  constructor(client) {
    this.client = client;
  }

  /**
   * Send an email.
   *
   * @param {object} options
   * @param {string} options.from      Sender address on a verified domain.
   * @param {string|string[]} options.to  One recipient or a list of up to 50.
   * @param {string} options.subject
   * @param {string} [options.html]    HTML body. Provide html, text, or both.
   * @param {string} [options.text]    Plain-text body.
   * @param {string[]} [options.tags]  Up to 5 tags for filtering events.
   * @returns {Promise<{ messageId: string, status: 'queued' }>}
   */
  async send({ from, to, subject, html, text, tags = [] }) {
    if (!html && !text) throw new Error('messages.send: provide html, text, or both');
    const recipients = [].concat(to);
    if (recipients.length > 50) throw new Error('messages.send: at most 50 recipients');
    return this.client.request('POST', '/messages', { from, to: recipients, subject, html, text, tags });
  }

  /**
   * Look up a message by ID.
   *
   * @param {string} messageId
   * @returns {Promise<{ messageId: string, status: 'queued'|'sent'|'delivered'|'bounced' }>}
   */
  async get(messageId) {
    return this.client.request('GET', `/messages/${messageId}`);
  }
}
