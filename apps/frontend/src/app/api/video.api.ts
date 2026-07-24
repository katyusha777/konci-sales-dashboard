import type { IVideoList, IVideoPage, IVideoPollSummary } from '~/app/types'
import { $api } from './client'

export abstract class VideosApi {
  // Authed: every render, newest first (the /videos page).
  static list(page = 1, perPage = 25): Promise<IVideoList> {
    return $api('/api/videos', { query: { page, perPage } })
  }

  // Authed: poll HeyGen for PROCESSING renders now (dev has no cron; prod runs it every 5 min).
  static poll(): Promise<IVideoPollSummary> {
    return $api('/api/videos/poll', { method: 'POST' })
  }

  // Authed: generate a HeyGen render for a lead using a template.
  // test=true (default) renders watermarked and free; test=false is a real paid render.
  static generate(leadId: string, templateId: string, test = true): Promise<{ id: string, token: string, status: string }> {
    return $api('/api/videos', { method: 'POST', body: { leadId, templateId, test } })
  }

  // Thumbnail URL for a completed video (the image embedded in outreach emails).
  static thumbUrl(token: string): string {
    return `/api/v/${token}/thumb`
  }

  // Public landing-page data (/v/:token).
  static page(token: string): Promise<IVideoPage> {
    return $api(`/api/v/${token}`)
  }

  // Public engagement event (fire-and-forget from the player).
  static event(token: string, type: string, positionSeconds?: number): Promise<{ ok: boolean }> {
    return $api(`/api/v/${token}/event`, { method: 'POST', body: { type, positionSeconds } })
  }

  // The stream URL is used directly as a <video> src (proxied through the frontend origin).
  static streamUrl(token: string): string {
    return `/api/v/${token}/stream`
  }
}
