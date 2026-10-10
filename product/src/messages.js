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
   * @param {string|Date} [options.scheduledAt]  Send later: an ISO 8601 timestamp or Date,
   *   at least 1 minute and at most 72 hours from now.
   * @returns {Promise<{ messageId: string, status: 'queued'|'scheduled' }>}
   */
  async send({ from, to, subject, html, text, tags = [], scheduledAt }) {
    if (!html && !text) throw new Error('messages.send: provide html, text, or both');
    const recipients = [].concat(to);
    if (recipients.length > 50) throw new Error('messages.send: at most 50 recipients');
    const body = { from, to: recipients, subject, html, text, tags };
    if (scheduledAt) body.scheduledAt = toScheduleTime(scheduledAt);
    return this.client.request('POST', '/messages', body);
  }

  /**
   * Cancel a scheduled message before it is sent.
   *
   * @param {string} messageId  The ID returned by send() with scheduledAt.
   * @returns {Promise<{ messageId: string, status: 'canceled' }>}
   * @throws {AcmeMailError} 409 with code `already_sent` if the send time has passed.
   */
  async cancel(messageId) {
    return this.client.request('POST', `/messages/${messageId}/cancel`);
  }

  /**
   * Look up a message by ID.
   *
   * @param {string} messageId
   * @returns {Promise<{ messageId: string, status: 'scheduled'|'queued'|'sent'|'delivered'|'bounced'|'canceled' }>}
   */
  async get(messageId) {
    return this.client.request('GET', `/messages/${messageId}`);
  }
}

const MIN_DELAY_MS = 60 * 1000;
const MAX_DELAY_MS = 72 * 60 * 60 * 1000;

function toScheduleTime(value) {
  const when = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(when.getTime())) throw new Error('messages.send: scheduledAt is not a valid date');
  const delay = when.getTime() - Date.now();
  if (delay < MIN_DELAY_MS || delay > MAX_DELAY_MS) {
    throw new Error('messages.send: scheduledAt must be between 1 minute and 72 hours from now');
  }
  return when.toISOString();
}
