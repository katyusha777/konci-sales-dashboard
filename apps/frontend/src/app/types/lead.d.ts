export type TLeadStatus
  = | 'NEW' | 'ENRICHED' | 'IN_CAMPAIGN' | 'CONTACTED' | 'ENGAGED'
    | 'REPLIED' | 'CLOSED_WON' | 'CLOSED_LOST' | 'DO_NOT_CONTACT'

export type TEnrichmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type TLeadSource = 'CSV' | 'SCRAPIO' | 'MANUAL'
export type TEmailStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED'
export type TContactEmailStatus = 'UNKNOWN' | 'VALID' | 'BOUNCED' | 'UNSUBSCRIBED' | 'COMPLAINED'
export type TCostType = 'ENRICHMENT' | 'VIDEO' | 'EMAIL'

export interface ILead {
  id: string
  name: string
  domain: string | null
  website: string | null
  email: string | null
  phone: string | null
  street: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  industry: string | null
  categories: Array<string>
  googleRating: number | null
  googleReviewCount: number | null
  employeeCount: number | null
  // Enrichment extras (from Scrap.io website data / Apollo)
  services: Array<string>
  businessHours: Record<string, string> | null
  description: string | null
  ownerName: string | null
  source: TLeadSource
  status: TLeadStatus
  enrichmentStatus: TEnrichmentStatus
  enrichmentScore: number
  enrichmentAttempts: number
  lastEnrichedAt: string | null
  assignedTo: string | null
  lastContactedAt: string | null
  lastEngagedAt: string | null
  konciCustomerId: string | null
  demoPhone: string | null
  demoPin: string | null
  totalCostUsd: number
  createdAt: string
  updatedAt: string
}

export interface IContact {
  id: string
  leadId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  priority: number
  emailStatus: TContactEmailStatus
  source: TLeadSource | 'APOLLO'
}

export interface ILeadNote {
  id: string
  leadId: string
  author: string
  body: string
  createdAt: string
}

export interface ILeadCost {
  id: string
  leadId: string
  type: TCostType
  amountUsd: number
  description: string
  createdAt: string
}

export interface IEmailEventSummary {
  type: 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED'
  occurredAt: string
}

export interface IEmailSummary {
  id: string
  subject: string
  status: TEmailStatus
  campaignName: string | null
  wasTestMode: boolean
  sentAt: string | null
  events: Array<IEmailEventSummary>
}

export interface ILeadDetail extends ILead {
  contacts: Array<IContact>
  notes: Array<ILeadNote>
  costs: Array<ILeadCost>
  emails: Array<IEmailSummary>
}

export interface ILeadFilters {
  search?: string
  status?: TLeadStatus
  enrichmentStatus?: TEnrichmentStatus
  industry?: string
  city?: string
  minScore?: number
  page?: number
  perPage?: number
}

// Scrap.io "Find businesses" search
export interface IScrapioSearchParams {
  keyword: string
  location: string
  category: string
  excludeClosed: boolean
  hasWebsite: boolean
  hasPhone: boolean
  minRating: number | null
  minReviews: number | null
}

export interface IScrapioResult {
  externalId: string
  name: string
  city: string
  state: string
  industry: string
  rating: number
  reviewCount: number
  website: string | null
  phone: string | null
}
