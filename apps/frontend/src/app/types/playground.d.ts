// Mirrors the API's playground/service DTOs (apps/api/src/services/*).

export interface IScrapioLiveResult {
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

export interface IScrapioLiveSearch {
  results: Array<IScrapioLiveResult>
  nextCursor: string | null
  total: number | null
}

export interface IScrapioLiveParams {
  type?: string
  location?: string
  minRating?: number
  minReviews?: number
  requireWebsite?: boolean
  requirePhone?: boolean
  excludeClosed?: boolean
  perPage?: number
  cursor?: string
}

export interface IHeygenLiveAvatar {
  avatarId: string
  name: string
  gender: string | null
  previewImageUrl: string | null
  previewVideoUrl: string | null
  isCustom: boolean
  type: 'avatar' | 'talking_photo'
}

export interface IHeygenLiveAvatarGroup {
  groupId: string
  name: string
  previewImageUrl: string | null
  avatars: Array<IHeygenLiveAvatar>
}

export interface IHeygenLiveVoice {
  voiceId: string
  name: string
  language: string | null
  gender: string | null
  previewAudioUrl: string | null
}

export interface IHeygenLiveTemplate {
  templateId: string
  name: string
  thumbnailUrl: string | null
}

export interface IHeygenLiveVariable {
  name: string
  type: string
  properties: Record<string, unknown>
}

export interface IHeygenLiveVideoStatus {
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'failed'
  videoUrl: string | null
  duration: number | null
  error: string | null
}

export interface IEmailLiveConfig {
  testMode: boolean
  testRecipient: string | null
  from: string
}

export interface IEmailLiveResult {
  id: string
  to: string
  testMode: boolean
  originalTo: string
  unsubscribeHeaders: Record<string, string> | null
}

export interface IApolloLiveInput {
  firstName?: string
  lastName?: string
  organizationName?: string
  domain?: string
  linkedinUrl?: string
  email?: string
}

export interface IApolloLiveOrg {
  name: string | null
  domain: string | null
  websiteUrl: string | null
  industry: string | null
  employeeCount: number | null
  annualRevenue: number | null
  foundedYear: number | null
  linkedinUrl: string | null
  phone: string | null
  city: string | null
  state: string | null
  raw: unknown
}

export interface IApolloLiveResult {
  workEmail: string | null
  emailStatus: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  department: string | null
  linkedinUrl: string | null
  isLikelyToEngage: boolean | null
  confidence: number
  raw: unknown
}

// ── PDL ─────────────────────────────────────────────────────────────────────

export interface IPdlLiveCompanyInput {
  name: string
  website?: string
  city?: string
  state?: string
}

export interface IPdlLiveCompany {
  name: string | null
  industry: string | null
  employeeCount: number | null
  website: string | null
  linkedinUrl: string | null
  likelihood: number | null
  raw: unknown
}

export interface IPdlLivePersonInput {
  firstName?: string
  lastName?: string
  company?: string
  domain?: string
  linkedinUrl?: string
  email?: string
}

export interface IPdlLivePerson {
  firstName: string | null
  lastName: string | null
  workEmail: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  linkedinUrl: string | null
  confidence: number
  source: string
  raw: unknown
}

export interface IPdlLiveSearchPeopleInput {
  company: string
  city?: string
  state?: string
  companyLinkedinUrl?: string
  companyDomain?: string
  limit?: number
}

export interface IPdlLiveSearchPeople {
  tier: 'executives' | 'any_employee'
  results: Array<IPdlLivePerson>
}

// ── Hunter.io ───────────────────────────────────────────────────────────────

export interface IHunterLiveEmail {
  email: string
  confidence: number
  rawConfidence: number
  sources: Array<string>
  raw: unknown
}

export interface IHunterLiveDomainEmail {
  value: string
  confidence: number
  type: 'personal' | 'generic'
  firstName: string | null
  lastName: string | null
  position: string | null
  seniority: string | null
  department: string | null
  linkedinUrl: string | null
  phoneNumber: string | null
  verificationStatus: string | null
}

export interface IHunterLiveDomainSearch {
  pattern: string | null
  emails: Array<IHunterLiveDomainEmail>
  raw: unknown
}

// ── FullEnrich ──────────────────────────────────────────────────────────────

export interface IFullenrichLiveEnrichInput {
  firstName?: string
  lastName?: string
  company?: string
  domain?: string
  linkedinUrl?: string
}

export interface IFullenrichLiveContact {
  firstName: string | null
  lastName: string | null
  workEmail: string | null
  workEmailStatus: string | null
  personalEmail: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  linkedinUrl: string | null
  confidence: number
  source: string
  raw: unknown
}

export interface IFullenrichLivePoll {
  status: 'CREATED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELED' | 'CREDITS_INSUFFICIENT' | 'RATE_LIMIT' | 'UNKNOWN'
  result: IFullenrichLiveContact | null
}

export interface IFullenrichLiveBatchPoll {
  status: string
  results: Array<{ email: string, result: IFullenrichLiveContact | null }> | null
}

export interface IFullenrichLiveCompany {
  name: string | null
  domain: string | null
  linkedinUrl: string | null
  industry: string | null
  employeeCount: number | null
  raw: unknown
}

// ── Firecrawl ───────────────────────────────────────────────────────────────

export interface IFirecrawlLiveResult {
  url: string
  markdown: string
  title: string | null
  description: string | null
  links: Array<string>
  isBookingPlatform: boolean
  raw: unknown
}

// ── Google Places ───────────────────────────────────────────────────────────

export interface IGooglePlacesLiveResult {
  placeId: string | null
  name: string | null
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  reviewCount: number | null
  types: Array<string>
  businessStatus: string | null
  lat: number | null
  lng: number | null
  businessHours: Array<string>
  openNow: boolean | null
  raw: unknown
}

// ── Jambonz (telephony) ─────────────────────────────────────────────────────

export interface IJambonzLiveNumber {
  phoneNumberSid: string
  number: string
  applicationSid: string | null
  voipCarrierSid: string | null
  raw: unknown
}

export interface IJambonzLiveApplication {
  applicationSid: string
  name: string
  raw: unknown
}

export interface IJambonzLiveTrial {
  phone: string
  pin: string
  raw: unknown
}

// ── OpenRouter (LLM) ────────────────────────────────────────────────────────

export interface IOpenrouterLiveFact {
  key: string
  value: string
  confidence: number
  source: string
}

export interface IOpenrouterLiveContact {
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  email: string | null
}

export interface IOpenrouterLiveExtract {
  contentIsRelevant: boolean
  contentRelevanceReason: string | null
  facts: Array<IOpenrouterLiveFact>
  summary: string | null
  industry: string | null
  primaryService: string | null
  services: Array<string>
  businessHours: Record<string, string> | null
  canonicalName: string | null
  canonicalDomain: string | null
  discoveredContacts: Array<IOpenrouterLiveContact>
  raw: unknown
}
