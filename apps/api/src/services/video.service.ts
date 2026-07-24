// Video pipeline (ported from the old repo's render-video.task.ts, minus Mux).
// generate() submits a HeyGen render (dual path: studio template vs avatar+script) and
// creates a PROCESSING Video row with a public token. runPollTick() (the 5-min cron)
// polls HeyGen for PROCESSING videos, downloads completed ones into R2, and marks them
// COMPLETED. The public page streams the bytes back out of R2 via /api/v/:token/stream.

import type { VideoEventType } from '../generated/prisma/client'
import type { createPrisma } from '../lib/prisma'
import { r2PublicUrl } from '../lib/r2'
import { buildLeadVars, renderTemplate } from '../lib/template-render'
import { HeygenService } from './heygen.service'
import { LeadListService } from './lead-list.service'

type PrismaClient = ReturnType<typeof createPrisma>

// HeyGen renders cost real money (test renders are watermarked and free).
const HEYGEN_VIDEO_COST = 0.5
// A PROCESSING video older than this is treated as stuck and failed.
const RENDER_TIMEOUT_MS = 60 * 60 * 1000

export interface VideoGenerateInput {
  leadId: string
  templateId: string
}

const VIDEO_EVENT_TYPES = new Set<VideoEventType>([
  'PAGE_VIEW',
  'PLAY',
  'PAUSE',
  'PROGRESS_25',
  'PROGRESS_50',
  'PROGRESS_75',
  'COMPLETED',
])

export abstract class VideoService {
  /**
   * Submit a HeyGen render for a lead using a template, and create a PROCESSING Video
   * row. `test` defaults to true (watermarked, no credits) — a real paid render is an
   * explicit opt-in. The cron poll tick later downloads the result into R2.
   */
  static async generate(prisma: PrismaClient, env: Env, input: VideoGenerateInput, test = true) {
    const template = await prisma.template.findUnique({ where: { id: input.templateId } })
    if (!template)
      throw new Error('Template not found')
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      include: { contacts: { orderBy: { priority: 'asc' } } },
    })
    if (!lead)
      throw new Error('Lead not found')

    const vars = buildLeadVars(lead, lead.contacts[0] ?? null)

    let heygenVideoId: string
    let avatarId: string | null = null

    if (template.heygenTemplateId) {
      // Studio-template path: each scene text is a HeyGen variable, keyed scene_1, scene_2…
      const sceneVars: Record<string, string> = {}
      template.videoScenes.forEach((scene, i) => {
        sceneVars[`scene_${i + 1}`] = renderTemplate(scene, vars)
      })
      heygenVideoId = await HeygenService.generateFromTemplate(env, template.heygenTemplateId, sceneVars, test)
    }
    else if (template.avatarId && template.videoScript) {
      // Avatar+script path
      const avatar = await prisma.avatar.findUnique({ where: { id: template.avatarId } })
      if (!avatar)
        throw new Error('Template references a missing avatar')
      // Template voice override wins; the avatar's configured voice is the fallback.
      const voiceId = template.voiceId ?? avatar.voiceId
      if (!voiceId)
        throw new Error('No voice: pick one on the template or configure the avatar\'s voice')
      avatarId = avatar.id
      heygenVideoId = await HeygenService.generateVideo(env, {
        avatarId: avatar.heygenAvatarId,
        voiceId,
        script: renderTemplate(template.videoScript, vars),
      })
    }
    else {
      throw new Error('Template has no video configured (needs a HeyGen template or an avatar + script)')
    }

    return prisma.video.create({
      data: {
        leadId: input.leadId,
        templateId: template.id,
        avatarId,
        heygenVideoId,
        status: 'PROCESSING',
        token: crypto.randomUUID(),
        costUsd: test ? 0 : HEYGEN_VIDEO_COST,
      },
    })
  }

  /** All renders, newest first, with the lead + template they belong to (the /videos page). */
  static async list(prisma: PrismaClient, page: number, perPage: number) {
    const [total, items] = await Promise.all([
      prisma.video.count(),
      prisma.video.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          lead: { select: { id: true, name: true, videoUrl: true } },
          template: { select: { name: true } },
        },
      }),
    ])
    return { items, total, page, perPage }
  }

  /** Cron tick: advance every PROCESSING video (download completed → R2, mark COMPLETED/FAILED). */
  static async runPollTick(prisma: PrismaClient, env: Env): Promise<{ completed: number, failed: number, processing: number }> {
    const videos = await prisma.video.findMany({ where: { status: 'PROCESSING' } })
    let completed = 0
    let failed = 0
    let processing = 0
    for (const video of videos) {
      try {
        const status = await HeygenService.getVideoStatus(env, video.heygenVideoId)
        if (status.status === 'completed' && status.videoUrl) {
          const res = await fetch(status.videoUrl)
          if (!res.ok)
            throw new Error(`video download failed: HTTP ${res.status}`)
          const bytes = await res.arrayBuffer()
          const r2Key = `videos/${video.id}.mp4`
          await env.VIDEOS.put(r2Key, bytes, { httpMetadata: { contentType: 'video/mp4' } })

          // HeyGen's thumbnail URL expires (~7 days) — copy it into R2 so the email
          // image at /api/v/:token/thumb never breaks. A thumb failure isn't fatal.
          let thumbnailR2Key: string | null = null
          if (status.thumbnailUrl) {
            try {
              const thumbRes = await fetch(status.thumbnailUrl)
              if (thumbRes.ok) {
                // HeyGen's CDN often says binary/octet-stream — email clients want image/*.
                const contentType = thumbRes.headers.get('content-type')
                thumbnailR2Key = `videos/${video.id}.jpg`
                await env.VIDEOS.put(thumbnailR2Key, await thumbRes.arrayBuffer(), {
                  httpMetadata: { contentType: contentType?.startsWith('image/') ? contentType : 'image/jpeg' },
                })
              }
            }
            catch (err) {
              console.error(`[video-poll] ${video.id} thumbnail:`, (err as Error).message)
            }
          }

          await prisma.video.update({
            where: { id: video.id },
            data: { status: 'COMPLETED', r2Key, thumbnailR2Key, durationSeconds: status.duration ? Math.round(status.duration) : null },
          })

          // Newest completed video becomes the lead's outreach video — these two fields
          // are what the Smartlead sync pushes as video_url / video_thumbnail.
          await prisma.lead.update({
            where: { id: video.leadId },
            data: {
              videoUrl: `${env.APP_URL}/v/${video.token}`,
              // Prefer the R2 CDN URL (works everywhere, incl. emails); Worker route is the fallback.
              videoThumbnailUrl: r2PublicUrl(env, thumbnailR2Key)
                ?? (thumbnailR2Key ? `${env.APP_URL}/api/v/${video.token}/thumb` : null),
            },
          })
          // Already pushed to Smartlead? Refresh its custom fields so the email
          // template's {{#if video_url}} block lights up.
          await LeadListService.pushVideoFieldsUpdate(prisma, env, video.leadId)
            .catch(err => console.error(`[video-poll] ${video.id} smartlead update:`, (err as Error).message))
          // Record cost for a real (non-test) render only
          const cost = Number(video.costUsd ?? 0)
          if (cost > 0) {
            await prisma.leadCost.create({
              data: { leadId: video.leadId, type: 'VIDEO', amountUsd: cost.toFixed(4), description: 'HeyGen video render' },
            })
            await prisma.lead.update({ where: { id: video.leadId }, data: { totalCostUsd: { increment: cost.toFixed(4) } } })
          }
          completed++
        }
        else if (status.status === 'failed') {
          await prisma.video.update({ where: { id: video.id }, data: { status: 'FAILED', error: status.error ?? 'HeyGen render failed' } })
          failed++
        }
        else if (Date.now() - video.updatedAt.getTime() > RENDER_TIMEOUT_MS) {
          await prisma.video.update({ where: { id: video.id }, data: { status: 'FAILED', error: 'render timed out' } })
          failed++
        }
        else {
          processing++ // still pending/processing — leave for the next tick
        }
      }
      catch (err) {
        console.error(`[video-poll] ${video.id}:`, (err as Error).message)
        processing++ // couldn't reach HeyGen this tick; retry next tick
      }
    }
    return { completed, failed, processing }
  }

  /** Public landing-page data for /v/:token. */
  static async pageData(prisma: PrismaClient, env: Env, token: string) {
    const video = await prisma.video.findUnique({
      where: { token },
      include: { lead: { select: { name: true, demoPhone: true, demoPin: true, konciRegistration: { select: { claimUrl: true } } } } },
    })
    if (!video)
      return null
    return {
      token,
      businessName: video.lead.name,
      demoPhone: video.lead.demoPhone,
      demoPin: video.lead.demoPin,
      // "Get this for your business" CTA — the lead's claim link when one exists
      claimUrl: video.lead.konciRegistration?.claimUrl ?? null,
      ready: video.status === 'COMPLETED' && !!video.r2Key,
      // Direct CDN URL when the bucket is public; the player falls back to /stream.
      videoSrc: video.status === 'COMPLETED' ? r2PublicUrl(env, video.r2Key) : null,
      durationSeconds: video.durationSeconds,
    }
  }

  static async recordEvent(prisma: PrismaClient, token: string, input: { type: string, positionSeconds?: number, userAgent?: string | null }) {
    const video = await prisma.video.findUnique({ where: { token }, select: { id: true } })
    if (!video)
      return false
    const type = input.type as VideoEventType
    if (!VIDEO_EVENT_TYPES.has(type))
      return false
    await prisma.videoEvent.create({
      data: {
        videoId: video.id,
        type,
        positionSeconds: input.positionSeconds ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    return true
  }

  /** The email-embed thumbnail (public, long-cacheable — the URL is per-video). */
  static async thumbnail(prisma: PrismaClient, env: Env, token: string): Promise<Response> {
    const video = await prisma.video.findUnique({ where: { token }, select: { thumbnailR2Key: true } })
    if (!video?.thumbnailR2Key)
      return new Response('Not found', { status: 404 })
    const object = await env.VIDEOS.get(video.thumbnailR2Key)
    if (!object)
      return new Response('Not found', { status: 404 })
    const stored = object.httpMetadata?.contentType
    return new Response(object.body as ReadableStream, {
      headers: {
        'Content-Type': stored?.startsWith('image/') ? stored : 'image/jpeg',
        'Content-Length': String(object.size),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  /** Stream the R2-stored bytes with HTTP Range support (206) so the browser can scrub. */
  static async stream(prisma: PrismaClient, env: Env, token: string, rangeHeader: string | null): Promise<Response> {
    const video = await prisma.video.findUnique({ where: { token }, select: { r2Key: true } })
    if (!video?.r2Key)
      return new Response('Not found', { status: 404 })

    const range = parseRange(rangeHeader)
    const object = await env.VIDEOS.get(video.r2Key, range ? { range: { offset: range.offset, length: range.length } } : undefined)
    if (!object)
      return new Response('Not found', { status: 404 })

    const size = object.size
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'video/mp4')
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'private, max-age=3600')

    if (range) {
      const end = range.offset + range.length - 1
      headers.set('Content-Range', `bytes ${range.offset}-${end}/${size}`)
      headers.set('Content-Length', String(range.length))
      return new Response(object.body as ReadableStream, { status: 206, headers })
    }
    headers.set('Content-Length', String(size))
    return new Response(object.body as ReadableStream, { status: 200, headers })
  }
}

// "bytes=start-end" → offset/length against the full object size. Open-ended ranges
// (bytes=start-) read to EOF; we don't know size until the R2 get, so use a large length
// and let R2 clamp — R2 returns only what exists.
function parseRange(header: string | null): { offset: number, length: number } | null {
  if (!header)
    return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match)
    return null
  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : undefined
  if (end !== undefined && end >= start)
    return { offset: start, length: end - start + 1 }
  // open-ended: read a large chunk from start; R2 clamps to the real end
  return { offset: start, length: 10 * 1024 * 1024 }
}
