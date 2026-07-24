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
    videoScript: t.videoScript,
    videoScenes: t.videoScenes.length > 0 ? t.videoScenes : null,
    avatarId: t.avatarId,
    voiceId: t.voiceId,
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
    const { name, videoScript, avatarId, heygenTemplateId } = req.body
    if (!name?.trim())
      return this.fail(400, 'name is required')
    const hasAvatarVideo = !!avatarId && !!videoScript?.trim()
    if (!hasAvatarVideo && !heygenTemplateId)
      return this.fail(400, 'Template needs a video: an avatar + script, or a HeyGen studio template')
    try {
      const saved = await TemplateService.save(this.prisma, req.body)
      return this.data(serializeTemplate(saved))
    }
    catch {
      return this.fail(404, 'Template not found')
    }
  }

  // DELETE /api/templates/:id
  async destroy(req: AppRequest<{ Params: { id: string } }>) {
    try {
      await TemplateService.remove(this.prisma, req.params.id)
      return this.success('Template deleted')
    }
    catch {
      return this.fail(404, 'Template not found')
    }
  }

  // GET /api/templates/voices — HeyGen voices for the editor's voice picker
  async voices() {
    try {
      return this.data(await TemplateService.heygenVoices(this.c.env))
    }
    catch (err) {
      return this.fail(502, 'HeyGen voice list failed', (err as Error).message)
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
