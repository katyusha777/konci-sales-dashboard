// Mirrors the API's lead-list serializers (apps/api/src/controllers/lead-list.controller.ts).

import type { TEnrichmentStatus, TKonciRegistrationStatus, TLeadStatus } from './lead'

export type TEmailProvider = 'SMARTLEAD'
export type TListStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED'
export type TListSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'SKIPPED'

export interface ILeadList {
  id: string
  name: string
  description: string | null
  status: TListStatus
  provider: TEmailProvider | null
  externalCampaignId: string | null
  lastSyncedAt: string | null
  memberCount: number
  syncedCount: number
  konciReadyCount: number
  createdAt: string
  updatedAt: string
}

export interface ILeadListMember {
  id: string
  leadId: string
  syncStatus: TListSyncStatus
  syncedAt: string | null
  syncError: string | null
  createdAt: string
  lead: {
    id: string
    name: string
    domain: string | null
    email: string | null
    city: string | null
    state: string | null
    industry: string | null
    status: TLeadStatus
    enrichmentStatus: TEnrichmentStatus
    enrichmentScore: number
    // Konci demo + outreach-video readiness (the two send gates)
    demoPhone: string | null
    demoPin: string | null
    videoUrl: string | null
    konciStatus: TKonciRegistrationStatus | null
    konciClaimUrl: string | null
  }
}

// POST /api/lists/:id/resync result
export interface IListResyncSummary {
  updated: number
  added: number
  waiting: number
  failed: number
}

export interface ILeadListMembers {
  items: Array<ILeadListMember>
  total: number
  page: number
  perPage: number
}
