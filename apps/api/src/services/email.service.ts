// Email sending via Resend's REST API (plain fetch — no SDK dependency).
// EMAIL_TEST_MODE is enforced HERE, inside send(), never at call sites:
//   - unset            → throws (an explicit "false" is required to send real email)
//   - "true"           → recipient replaced with EMAIL_TEST_RECIPIENT, subject prefixed
//   - "false"          → sends to the real recipient

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface SendEmailResult {
  id: string
  to: string
  testMode: boolean
  originalTo: string
}

export abstract class EmailService {
  /**
   * RFC 8058 one-click unsubscribe headers (Gmail/Yahoo require these for bulk senders).
   * Campaign sends (Phase B4) pass the Email row's trackingToken as unsubscribeToken.
   * The List-Unsubscribe URL points at the API endpoint so mailbox providers can POST
   * the one-click unsubscribe directly; humans who click the in-body {{unsubscribe_url}}
   * land on the frontend /unsubscribe/{token} confirmation page (which calls the same API).
   */
  static buildListUnsubscribeHeaders(env: Env, unsubscribeToken: string): Record<string, string> {
    return {
      'List-Unsubscribe': `<${env.APP_URL}/api/unsubscribe/${unsubscribeToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID': unsubscribeToken,
    }
  }

  static isTestMode(env: Env): boolean {
    const mode = env.EMAIL_TEST_MODE
    if (mode !== 'true' && mode !== 'false')
      throw new Error('EMAIL_TEST_MODE must be explicitly set to "true" or "false"')
    return mode === 'true'
  }

  static async send(env: Env, options: SendEmailOptions): Promise<SendEmailResult> {
    const testMode = this.isTestMode(env)
    let to = options.to
    let subject = options.subject
    if (testMode) {
      if (!env.EMAIL_TEST_RECIPIENT)
        throw new Error('EMAIL_TEST_RECIPIENT must be set while EMAIL_TEST_MODE=true')
      to = env.EMAIL_TEST_RECIPIENT
      subject = `[TEST → ${options.to}] ${options.subject}`
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html: options.html,
        reply_to: options.replyTo,
        headers: options.headers,
      }),
    })

    if (!res.ok) {
      const body = await res.json<{ message?: string }>().catch(() => null)
      throw new Error(`Resend error ${res.status}: ${body?.message ?? await res.text().catch(() => 'unknown')}`)
    }

    const data = await res.json<{ id: string }>()
    return { id: data.id, to, testMode, originalTo: options.to }
  }
}
