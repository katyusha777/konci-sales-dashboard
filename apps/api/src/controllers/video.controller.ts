import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import { VideoService } from '../services/video.service'

export default class VideoController extends Controller {
  private fail(status: 400 | 404 | 502, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // POST /api/videos — { leadId, templateId, test? } → generate a render. Authed.
  // test defaults to true (watermarked, free); a real paid render is an explicit opt-in.
  async generate(req: AppRequest<{ Body: { leadId?: string, templateId?: string, test?: boolean } }>) {
    const { leadId, templateId, test } = req.body
    if (!leadId || !templateId)
      return this.fail(400, 'leadId and templateId are required')
    try {
      const video = await VideoService.generate(this.prisma, this.c.env, { leadId, templateId }, test !== false)
      return this.data({ id: video.id, token: video.token, status: video.status })
    }
    catch (err) {
      return this.fail(502, 'Video generation failed', (err as Error).message)
    }
  }

  // GET /api/videos — every render, newest first. Authed (the /videos page).
  async index(req: AppRequest<{ Query: { page?: string, perPage?: string } }>) {
    const page = Math.max(1, Number(req.query.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 25))
    const result = await VideoService.list(this.prisma, page, perPage)
    return this.data({
      ...result,
      items: result.items.map(v => ({
        id: v.id,
        status: v.status,
        error: v.error,
        token: v.token,
        hasThumbnail: !!v.thumbnailR2Key,
        durationSeconds: v.durationSeconds,
        templateName: v.template?.name ?? null,
        isTest: Number(v.costUsd ?? 0) === 0,
        costUsd: Number(v.costUsd ?? 0),
        // This render is the one currently synced to Smartlead as the lead's video
        isOutreach: v.lead.videoUrl?.endsWith(v.token) ?? false,
        createdAt: v.createdAt.toISOString(),
        lead: { id: v.lead.id, name: v.lead.name },
      })),
    })
  }

  // POST /api/videos/poll — poll HeyGen for PROCESSING renders NOW. The cron does this
  // every 5 min in prod, but `wrangler dev` never fires it — this is the manual recheck.
  async poll() {
    try {
      return this.data(await VideoService.runPollTick(this.prisma, this.c.env))
    }
    catch (err) {
      return this.fail(502, 'Video poll failed', (err as Error).message)
    }
  }

  // GET /api/v/:token — public landing-page data
  async page(req: AppRequest<{ Params: { token: string } }>) {
    const data = await VideoService.pageData(this.prisma, this.c.env, req.params.token)
    if (!data)
      return this.fail(404, 'Video not found')
    return this.data(data)
  }

  // GET /api/v/:token/stream — public byte stream (Range/206). Returns a raw Response.
  async stream(req: AppRequest<{ Params: { token: string } }>): Promise<Response> {
    return VideoService.stream(this.prisma, this.c.env, req.params.token, req.raw.headers.get('range'))
  }

  // GET /api/v/:token/thumb — public thumbnail (the image embedded in outreach emails).
  async thumb(req: AppRequest<{ Params: { token: string } }>): Promise<Response> {
    return VideoService.thumbnail(this.prisma, this.c.env, req.params.token)
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
