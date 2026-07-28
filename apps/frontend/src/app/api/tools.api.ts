import type { IBuiltEmail } from '~/app/types'
import { $api } from './client'

export abstract class ToolsApi {
  // Instructions or a pasted draft → Smartlead-tagged outreach email (one LLM call).
  static buildEmail(instructions: string): Promise<IBuiltEmail> {
    return $api('/api/tools/email-builder', { method: 'POST', body: { instructions } })
  }
}
