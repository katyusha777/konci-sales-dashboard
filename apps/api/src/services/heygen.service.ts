// HeyGen — avatar video generation.
// Base URL: https://api.heygen.com · Auth: x-api-key header
// Kept simple per plan: existing avatars/voices/templates + generate + status.
// (No photo-avatar training / digital-twin endpoints.)

const BASE_URL = 'https://api.heygen.com'

export interface HeygenAvatar {
  avatarId: string
  name: string
  gender: string | null
  previewImageUrl: string | null
  previewVideoUrl: string | null
  isCustom: boolean
  type: 'avatar' | 'talking_photo'
}

export interface HeygenVoice {
  voiceId: string
  name: string
  language: string | null
  gender: string | null
  previewAudioUrl: string | null
}

export interface HeygenTemplateSummary {
  templateId: string
  name: string
  thumbnailUrl: string | null
}

export interface HeygenTemplateVariable {
  name: string
  type: string
  properties: Record<string, unknown>
}

export interface HeygenVideoStatus {
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'failed'
  videoUrl: string | null
  duration: number | null
  error: string | null
}

export abstract class HeygenService {
  private static async request<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'x-api-key': env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok)
      throw new Error(`HeyGen API error ${res.status} ${res.statusText}: ${await res.text()}`)
    return res.json<T>()
  }

  // Custom avatars + talking photos; customOnly=false includes HeyGen's stock avatars.
  static async listAvatars(env: Env, customOnly = true): Promise<Array<HeygenAvatar>> {
    const response = await this.request<{
      data: {
        avatars?: Array<{ avatar_id: string, avatar_name?: string, gender?: string, preview_image_url?: string, preview_video_url?: string, is_custom?: boolean }>
        talking_photos?: Array<{ talking_photo_id: string, talking_photo_name?: string, preview_image_url?: string }>
      }
    }>(env, 'GET', '/v2/avatars')

    const avatars: Array<HeygenAvatar> = (response.data.avatars ?? [])
      .filter(a => !customOnly || a.is_custom === true)
      .map(a => ({
        avatarId: a.avatar_id,
        name: a.avatar_name ?? a.avatar_id,
        gender: a.gender ?? null,
        previewImageUrl: a.preview_image_url ?? null,
        previewVideoUrl: a.preview_video_url ?? null,
        isCustom: a.is_custom === true,
        type: 'avatar' as const,
      }))

    const talkingPhotos: Array<HeygenAvatar> = (response.data.talking_photos ?? []).map(p => ({
      avatarId: p.talking_photo_id,
      name: p.talking_photo_name ?? p.talking_photo_id,
      gender: null,
      previewImageUrl: p.preview_image_url ?? null,
      previewVideoUrl: null,
      isCustom: true,
      type: 'talking_photo' as const,
    }))

    return [...avatars, ...talkingPhotos]
  }

  // Photo avatars live in avatar GROUPS (separate from /v2/avatars).
  // Response key varies by API version — normalize all known variants.
  static async listAvatarGroups(env: Env, includePublic = false): Promise<Array<{ groupId: string, name: string, previewImageUrl: string | null, avatars: Array<HeygenAvatar> }>> {
    const response = await this.request<{
      data?: {
        avatar_groups?: Array<Record<string, unknown>>
        groups?: Array<Record<string, unknown>>
        avatar_group_list?: Array<Record<string, unknown>>
      }
    }>(env, 'GET', `/v2/avatar_group.list?include_public=${includePublic}`)

    const rawGroups = response.data?.avatar_groups ?? response.data?.groups ?? response.data?.avatar_group_list ?? []
    const groups = rawGroups
      .map(g => ({
        groupId: String(g.group_id ?? g.id ?? ''),
        name: String(g.name ?? g.group_name ?? 'Untitled group'),
        previewImageUrl: typeof g.preview_image_url === 'string' ? g.preview_image_url : typeof g.preview_image === 'string' ? g.preview_image : null,
      }))
      .filter(g => g.groupId)

    return Promise.all(groups.map(async (g) => {
      const detail = await this.request<{ data?: { avatar_list?: Array<Record<string, unknown>> } }>(env, 'GET', `/v2/avatar_group/${g.groupId}/avatars`).catch(() => null)
      const avatars: Array<HeygenAvatar> = (detail?.data?.avatar_list ?? [])
        .map(a => ({
          avatarId: String(a.avatar_id ?? a.id ?? ''),
          name: String(a.avatar_name ?? a.name ?? 'Untitled'),
          gender: typeof a.gender === 'string' ? a.gender : null,
          previewImageUrl: typeof a.preview_image_url === 'string' ? a.preview_image_url : typeof a.image_url === 'string' ? a.image_url : null,
          previewVideoUrl: null,
          isCustom: true,
          type: 'avatar' as const,
        }))
        .filter(a => a.avatarId)
      return { ...g, avatars }
    }))
  }

  static async listVoices(env: Env): Promise<Array<HeygenVoice>> {
    const response = await this.request<{
      data: { voices: Array<{ voice_id: string, name?: string, language?: string, gender?: string, preview_audio?: string }> }
    }>(env, 'GET', '/v2/voices')
    return response.data.voices.map(v => ({
      voiceId: v.voice_id,
      name: v.name ?? v.voice_id,
      language: v.language ?? null,
      gender: v.gender ?? null,
      previewAudioUrl: v.preview_audio ?? null,
    }))
  }

  static async listTemplates(env: Env): Promise<Array<HeygenTemplateSummary>> {
    const response = await this.request<{
      data?: { templates?: Array<{ template_id?: string, name?: string, thumbnail_image_url?: string }> }
    }>(env, 'GET', '/v2/templates')
    return (response.data?.templates ?? [])
      .filter(t => typeof t.template_id === 'string')
      .map(t => ({
        templateId: t.template_id!,
        name: t.name ?? t.template_id!,
        thumbnailUrl: t.thumbnail_image_url ?? null,
      }))
  }

  // Variable definitions (v3 first — has scenes; v2 fallback), needed to fill scenes correctly.
  static async getTemplateVariables(env: Env, templateId: string): Promise<Record<string, HeygenTemplateVariable>> {
    let data: Record<string, unknown>
    try {
      const response = await this.request<{ data?: Record<string, unknown> }>(env, 'GET', `/v3/template/${templateId}`)
      data = response.data ?? {}
    }
    catch {
      const response = await this.request<{ data?: Record<string, unknown> }>(env, 'GET', `/v2/template/${templateId}`)
      data = response.data ?? {}
    }
    const variables: Record<string, HeygenTemplateVariable> = {}
    for (const [name, value] of Object.entries((data.variables as Record<string, unknown>) ?? {})) {
      const v = value as Record<string, unknown>
      variables[name] = {
        name: typeof v.name === 'string' ? v.name : name,
        type: typeof v.type === 'string' ? v.type : 'text',
        properties: (v.properties as Record<string, unknown>) ?? {},
      }
    }
    return variables
  }

  // Photo-avatar looks (from avatar groups) are "talking photos" in HeyGen's API
  // and need a different character payload than video avatars.
  static async generateVideo(env: Env, options: { avatarId: string, characterType?: 'avatar' | 'talking_photo', voiceId: string, script: string, backgroundColor?: string, width?: number, height?: number }): Promise<string> {
    const character = options.characterType === 'talking_photo'
      ? { type: 'talking_photo', talking_photo_id: options.avatarId }
      : { type: 'avatar', avatar_id: options.avatarId }
    const response = await this.request<{ data: { video_id: string }, error: string | null }>(env, 'POST', '/v2/video/generate', {
      video_inputs: [{
        character,
        voice: { type: 'text', voice_id: options.voiceId, input_text: options.script.slice(0, 5000) },
        background: { type: 'color', value: options.backgroundColor ?? '#ffffff' },
      }],
      dimension: { width: options.width ?? 1280, height: options.height ?? 720 },
    })
    if (response.error)
      throw new Error(`HeyGen video generation error: ${response.error}`)
    return response.data.video_id
  }

  // HeyGen rejects variables with wrong names/types, so definitions are fetched first
  // and each value is sent with its declared type (text/voice/…).
  static async generateFromTemplate(env: Env, templateId: string, variables: Record<string, string>, test = true): Promise<string> {
    const defs = await this.getTemplateVariables(env, templateId).catch(() => null)
    const heygenVariables: Record<string, HeygenTemplateVariable> = {}
    for (const [name, content] of Object.entries(variables)) {
      const def = defs?.[name]
      if (defs !== null && !def)
        continue
      heygenVariables[name] = {
        name,
        type: def?.type ?? 'text',
        properties: { ...(def?.properties ?? {}), content },
      }
    }
    const response = await this.request<{ data?: { video_id?: string }, error?: string | null }>(
      env,
      'POST',
      `/v2/template/${templateId}/generate`,
      { test, caption: false, variables: heygenVariables },
    )
    if (response.error)
      throw new Error(`HeyGen template generate error: ${response.error}`)
    if (!response.data?.video_id)
      throw new Error('HeyGen template generate returned no video_id')
    return response.data.video_id
  }

  static async getVideoStatus(env: Env, videoId: string): Promise<HeygenVideoStatus> {
    const response = await this.request<{
      data: {
        status: HeygenVideoStatus['status']
        video_url?: string
        duration?: number
        error?: string | { code?: string, message?: string, detail?: string }
      }
    }>(env, 'GET', `/v1/video_status.get?video_id=${videoId}`)
    const err = response.data.error
    return {
      status: response.data.status,
      videoUrl: response.data.video_url ?? null,
      duration: response.data.duration ?? null,
      error: err ? (typeof err === 'string' ? err : err.message ?? err.detail ?? err.code ?? 'unknown error') : null,
    }
  }
}
