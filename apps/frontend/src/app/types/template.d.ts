export interface ITemplate {
  id: string
  name: string
  subject: string
  body: string
  // Video: either a single script rendered with an avatar, OR per-scene texts
  // filled into a HeyGen studio template (each scene = one template variable).
  videoScript: string | null
  videoScenes: Array<string> | null
  avatarId: string | null
  heygenTemplateId: string | null
  createdAt: string
  updatedAt: string
}

export interface IHeygenTemplate {
  id: string
  name: string
  sceneCount: number
}
