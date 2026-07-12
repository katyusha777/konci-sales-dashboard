import type { IVideoPage } from '~/app/types'
import { $api } from './client'

export abstract class VideosApi {
  // Authed: generate a (test) HeyGen render for a lead using a template.
  static generateTest(leadId: string, templateId: string): Promise<{ id: string, token: string, status: string }> {
    return $api('/api/videos', { method: 'POST', body: { leadId, templateId } })
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
