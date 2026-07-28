import type { ApiResponse, AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { BuiltEmail } from '../services/openrouter.service'
import { OpenrouterService } from '../services/openrouter.service'

// Owner utilities ("Tools" in the sidebar). Unlike the playground (one page per
// provider, for validating integrations), each tool composes existing services into
// something directly useful for the sales workflow.
export default class ToolsController extends Controller {
  // POST /api/tools/email-builder — instructions or a draft → Smartlead-tagged email.
  async emailBuilder(req: AppRequest<{ Body: { instructions?: string } }>): Promise<ApiResponse<BuiltEmail>> {
    const instructions = req.body.instructions?.trim()
    if (!instructions)
      return this.error('Describe the email you want (or paste a draft) first')
    return this.data(await OpenrouterService.buildOutreachEmail(this.c.env, { instructions }))
  }
}
