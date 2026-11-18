import { appendFileSync } from "node:fs";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: Email): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend answered HTTP ${response.status}: ${detail.slice(0, 200)}`);
    }
  }
}

/**
 * Writes each email as a line of JSON to a file instead of sending it. For working on the
 * site without a mail account, and for the browser tests, which read confirmation links
 * from it.
 */
export class OutboxMailer implements Mailer {
  constructor(private readonly path: string) {}

  async send(email: Email): Promise<void> {
    appendFileSync(this.path, `${JSON.stringify({ ...email, sentAt: new Date().toISOString() })}\n`);
  }
}
