import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import { VideoService } from '../services/video.service'

export default class VideoController extends Controller {
  private fail(status: 400 | 404 | 502, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // POST /api/videos — { leadId, templateId } → generate a (test) render. Authed.
  async generate(req: AppRequest<{ Body: { leadId?: string, templateId?: string } }>) {
    const { leadId, templateId } = req.body
    if (!leadId || !templateId)
      return this.fail(400, 'leadId and templateId are required')
    try {
      const video = await VideoService.generate(this.prisma, this.c.env, { leadId, templateId }, true)
      return this.data({ id: video.id, token: video.token, status: video.status })
    }
    catch (err) {
      return this.fail(502, 'Video generation failed', (err as Error).message)
    }
  }

  // GET /api/v/:token — public landing-page data
  async page(req: AppRequest<{ Params: { token: string } }>) {
    const data = await VideoService.pageData(this.prisma, req.params.token)
    if (!data)
      return this.fail(404, 'Video not found')
    return this.data(data)
  }

  // GET /api/v/:token/stream — public byte stream (Range/206). Returns a raw Response.
  async stream(req: AppRequest<{ Params: { token: string } }>): Promise<Response> {
    return VideoService.stream(this.prisma, this.c.env, req.params.token, req.raw.headers.get('range'))
  }

  // POST /api/v/:token/event — public VideoEvent (fire-and-forget from the player)
  async event(req: AppRequest<{ Params: { token: string }, Body: { type?: string, positionSeconds?: number } }>) {
    await VideoService.recordEvent(this.prisma, req.params.token, {
      type: req.body.type ?? '',
      positionSeconds: req.body.positionSeconds,
      userAgent: req.raw.headers.get('user-agent'),
    })
    return this.data({ ok: true })
  }
}
