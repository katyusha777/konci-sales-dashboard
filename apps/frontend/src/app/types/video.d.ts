// One row on the /videos page (mirrors VideoController.index).
export interface IVideoListItem {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  error: string | null
  token: string
  hasThumbnail: boolean
  durationSeconds: number | null
  templateName: string | null
  isTest: boolean
  costUsd: number
  isOutreach: boolean
  createdAt: string
  lead: { id: string, name: string }
}

export interface IVideoList {
  items: Array<IVideoListItem>
  total: number
  page: number
  perPage: number
}

// POST /api/videos/poll result — what the manual "check processing" recheck returns.
export interface IVideoPollSummary {
  completed: number
  failed: number
  processing: number
}

// Public video landing page (/v/:token) data.
export interface IVideoPage {
  token: string
  businessName: string
  demoPhone: string | null
  demoPin: string | null
  claimUrl: string | null
  ready: boolean
  // Direct R2 CDN URL when the bucket is public; null → player uses /api/v/:token/stream.
  videoSrc: string | null
  durationSeconds: number | null
}
