export interface IAvatar {
  id: string
  name: string
  heygenAvatarId: string
  voiceId: string | null
  previewImageUrl: string | null
  isActive: boolean
  lastSyncedAt: string | null
}
