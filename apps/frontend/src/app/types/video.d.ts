// Public video landing page (/v/:token) data.
export interface IVideoPage {
  token: string
  businessName: string
  demoPhone: string | null
  demoPin: string | null
  ready: boolean
  durationSeconds: number | null
}
