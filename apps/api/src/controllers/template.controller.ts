import type { Template } from '../generated/prisma/client'
import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { TemplateSaveInput } from '../services/template.service'
import { TemplateService } from '../services/template.service'

// videoScenes is a non-null String[] in the DB (default []), but the frontend detects the
// video mode by `videoScenes !== null`: a HeyGen-template video has scenes, everything else
// is null. So serialize an empty array back to null, a populated one as-is.
function serializeTemplate(t: Template) {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    videoScript: t.videoScript,
    videoScenes: t.videoScenes.length > 0 ? t.videoScenes : null,
    avatarId: t.avatarId,
    heygenTemplateId: t.heygenTemplateId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export default class TemplateController extends Controller {
  private fail(status: 400 | 404 | 502, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // GET /api/templates
  async index() {
    const templates = await TemplateService.list(this.prisma)
    return this.data(templates.map(serializeTemplate))
  }

  // POST /api/templates — insert (no id) or update (id present)
  async save(req: AppRequest<{ Body: TemplateSaveInput }>) {
    const { name, subject, body } = req.body
    if (!name?.trim() || !subject?.trim() || !body?.trim())
      return this.fail(400, 'name, subject and body are required')
    try {
      const saved = await TemplateService.save(this.prisma, req.body)
      return this.data(serializeTemplate(saved))
    }
    catch {
      return this.fail(404, 'Template not found')
    }
  }

  // GET /api/templates/heygen — HeyGen studio templates + scene counts
  async heygenTemplates() {
    try {
      return this.data(await TemplateService.heygenTemplates(this.c.env))
    }
    catch (err) {
      return this.fail(502, 'HeyGen template list failed', (err as Error).message)
    }
  }
}
