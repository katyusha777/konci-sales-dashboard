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
  enrichmentError: string | null
  assignedTo: string | null
  lastContactedAt: string | null
  lastEngagedAt: string | null
  konciCustomerId: string | null
  demoPhone: string | null
  demoPin: string | null
  videoUrl: string | null
  videoThumbnailUrl: string | null
  outreachEmail: string | null
  outreachContactId: string | null
  outreachEmailReason: string | null
  totalCostUsd: number
  createdAt: string
  updatedAt: string
}

// Where a contact was discovered (waterfall providers included)
export type TContactSource = 'CSV' | 'SCRAPIO' | 'APOLLO' | 'MANUAL' | 'WEBSITE' | 'PDL' | 'HUNTER' | 'FULLENRICH'

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
  source: TContactSource
  confidence: number | null
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
  wasTestMode: boolean
  sentAt: string | null
  events: Array<IEmailEventSummary>
}

export type TKonciRegistrationStatus = 'PENDING' | 'PREPARED' | 'NEEDS_PHONE' | 'FAILED' | 'SKIPPED'

export interface IKonciRegistration {
  status: TKonciRegistrationStatus
  konciLeadId: string
  claimUrl: string | null
  claimExpiresAt: string | null
  error: string | null
  lastPolledAt: string | null
  createdAt: string
}

export interface ILeadVideo {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  error: string | null
  token: string
  hasThumbnail: boolean
  durationSeconds: number | null
  templateName: string | null
  isTest: boolean
  createdAt: string
}

export interface IOutreachStat {
  sequenceNumber: number
  externalCampaignId: string
  email: string
  sentAt: string | null
  openCount: number
  clickCount: number
  repliedAt: string | null
  bounced: boolean
  pulledAt: string
}

export interface ILeadDetail extends ILead {
  contacts: Array<IContact>
  notes: Array<ILeadNote>
  costs: Array<ILeadCost>
  emails: Array<IEmailSummary>
  videos: Array<ILeadVideo>
  konciRegistration: IKonciRegistration | null
  outreachStats: Array<IOutreachStat>
}

// Manual "Add lead" form
export interface ILeadCreate {
  name: string
  website?: string
  email?: string
  phone?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  industry?: string
  notes?: string
}

export type TEnrichmentProvider = 'GOOGLE_PLACES' | 'FIRECRAWL' | 'OPENROUTER' | 'PDL' | 'HUNTER' | 'FULLENRICH' | 'APOLLO' | 'SCRAPIO'

// One provider call from an enrichment run (the audit ledger — Activity tab)
export interface IEnrichmentResponse {
  id: string
  provider: TEnrichmentProvider
  operation: string
  success: boolean
  error: string | null
  costUsd: number
  durationMs: number
  createdAt: string
  request: unknown
  response: unknown
}

// CSV import result
export interface IImportReport {
  created: number
  duplicates: number
  errors: Array<{ row: number, error: string }>
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

// Mirrors the API's ScrapioResult (services/scrapio.service.ts) — the search
// endpoint returns the full mapped place so import loses nothing.
export interface IScrapioResult {
  externalId: string
  googleId: string | null
  placeId: string | null
  name: string
  website: string | null
  phone: string | null
  email: string | null
  street: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  lat: number | null
  lng: number | null
  industry: string | null
  categories: Array<string>
  rating: number | null
  reviewCount: number | null
  priceRange: string | null
  isClaimed: boolean | null
  isPermanentlyClosed: boolean | null
  socialLinks: Record<string, string> | null
  technologies: Array<string>
  raw: unknown
}
