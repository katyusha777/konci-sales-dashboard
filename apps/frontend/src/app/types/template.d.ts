export interface ITemplate {
  id: string
  name: string
  // Video: either a single script rendered with an avatar, OR per-scene texts
  // filled into a HeyGen studio template (each scene = one template variable).
  videoScript: string | null
  videoScenes: Array<string> | null
  avatarId: string | null
  voiceId: string | null
  heygenTemplateId: string | null
  createdAt: string
  updatedAt: string
}

export interface IHeygenVoice {
  voiceId: string
  name: string
  language: string | null
  gender: string | null
  previewAudioUrl: string | null
}

export interface IHeygenTemplate {
  id: string
  name: string
  sceneCount: number
}
