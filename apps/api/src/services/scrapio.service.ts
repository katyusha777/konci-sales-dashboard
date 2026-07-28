// Scrap.io — Google Maps business data.
// Base URL: https://scrap.io/api/v1 · Auth: Authorization: Bearer <SCRAPIO_API_KEY>
// Search is GET /gmap/search with query-string params (cursor pagination).

const BASE_URL = 'https://scrap.io/api/v1'

interface ScrapioPlace {
  google_id?: string
  place_id?: string
  name?: string
  website?: string
  phone?: string
  location_street_1?: string
  location_city?: string
  location_state?: string
  location_postal_code?: string
  location_country_code?: string
  location_latitude?: number
  location_longitude?: number
  types?: Array<{ type?: string, is_main?: boolean }>
  is_closed?: boolean
  is_claimed?: boolean
  price_range?: string
  reviews_rating?: number
  reviews_count?: number
  // Live shape (2026-07-26): emails/phones are OBJECTS, socials are per-network arrays.
  website_data?: {
    emails?: Array<string | { email?: string }>
    phones?: Array<string | { phone?: string }>
    facebook?: Array<string> | null
    instagram?: Array<string> | null
    linkedin?: Array<string> | null
    youtube?: Array<string> | null
    twitter?: Array<string> | null
    tiktok?: Array<string> | null
    technologies?: Array<string>
  }
}

const SOCIAL_KEYS = ['facebook', 'instagram', 'linkedin', 'youtube', 'twitter', 'tiktok'] as const

export interface ScrapioResult {
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

export interface ScrapioSearchParams {
  type?: string
  types?: Array<string> // up to 50 (Agency plan)
  location?: string
  minRating?: number
  minReviews?: number
  requireWebsite?: boolean
  requirePhone?: boolean
  requireEmail?: boolean // website_has_emails — the filter that matters for cold email
  excludeClosed?: boolean
  perPage?: number
  cursor?: string
}

// Scrap.io only accepts admin1 CODES ("TX") — full names return 0 results silently.
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC',
}

// /gmap/types is a static ~4k list — cache per isolate.
let typesCache: Array<{ id: string, text: string }> | null = null

export abstract class ScrapioService {
  static async search(env: Env, params: ScrapioSearchParams): Promise<{ results: Array<ScrapioResult>, nextCursor: string | null, total: number | null }> {
    const qs = new URLSearchParams()
    const loc = this.parseLocation(params.location ?? '')
    qs.set('country_code', loc.countryCode)
    if (loc.city)
      qs.set('city', loc.city)
    if (loc.admin1Code)
      qs.set('admin1_code', loc.admin1Code)
    if (params.type)
      qs.set('type', params.type)
    for (const t of params.types ?? []) qs.append('types[]', t)
    qs.set('per_page', String(this.perPage(params.perPage ?? 10)))
    if (params.cursor)
      qs.set('cursor', params.cursor)
    if (params.minRating != null)
      qs.set('gmap_reviews_rating_gte', String(params.minRating))
    if (params.minReviews != null)
      qs.set('gmap_reviews_count_gte', String(params.minReviews))
    // Scrap.io booleans must be 1/0 — the string "true" is a 422.
    if (params.requireWebsite)
      qs.set('gmap_has_website', '1')
    if (params.requirePhone)
      qs.set('gmap_has_phone', '1')
    if (params.requireEmail)
      qs.set('website_has_emails', '1')
    // Scrap.io only accepts gmap_is_closed=true (to INCLUDE closed) — filter after the fact.

    const res = await fetch(`${BASE_URL}/gmap/search?${qs}`, {
      headers: { Authorization: `Bearer ${env.SCRAPIO_API_KEY}` },
    })
    if (!res.ok) {
      if (res.status === 429)
        throw new Error('Scrap.io rate limit exceeded — wait and retry')
      throw new Error(`Scrap.io error ${res.status}: ${await res.text()}`)
    }

    const body = await res.json<{ meta?: { count?: number | string, next_cursor?: string }, data?: Array<ScrapioPlace> }>()
    let results = (body.data ?? []).map(p => this.mapPlace(p))
    if (params.excludeClosed)
      results = results.filter(r => !r.isPermanentlyClosed)
    const total = Number(body.meta?.count)
    return {
      results,
      nextCursor: body.meta?.next_cursor ?? null,
      total: Number.isNaN(total) ? null : total,
    }
  }

  static async getPlace(env: Env, googleId: string): Promise<ScrapioResult | null> {
    const res = await fetch(`${BASE_URL}/gmap/place?google_id=${encodeURIComponent(googleId)}`, {
      headers: { Authorization: `Bearer ${env.SCRAPIO_API_KEY}` },
    })
    if (res.status === 404)
      return null
    if (!res.ok)
      throw new Error(`Scrap.io error ${res.status}: ${await res.text()}`)
    const body = await res.json<{ meta?: { found?: boolean }, data?: ScrapioPlace }>()
    if (!body.data || !body.meta?.found)
      return null
    return this.mapPlace(body.data)
  }

  static async listTypes(env: Env): Promise<Array<{ id: string, text: string }>> {
    if (typesCache)
      return typesCache
    const res = await fetch(`${BASE_URL}/gmap/types`, {
      headers: { Authorization: `Bearer ${env.SCRAPIO_API_KEY}` },
    })
    if (!res.ok)
      throw new Error(`Scrap.io error ${res.status}: ${await res.text()}`)
    typesCache = await res.json()
    return typesCache!
  }

  // "Austin, TX" → city+state · "TX"/"Texas" → state · anything else → city
  private static parseLocation(location: string): { city?: string, admin1Code?: string, countryCode: string } {
    const trimmed = location.trim()
    if (!trimmed)
      return { countryCode: 'us' }
    const toCode = (s: string) => /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : US_STATES[s.toLowerCase()]
    if (trimmed.includes(',')) {
      const [city, state] = trimmed.split(',').map(s => s.trim())
      return { city: city || undefined, admin1Code: state ? toCode(state) ?? state : undefined, countryCode: 'us' }
    }
    const code = toCode(trimmed)
    if (code)
      return { admin1Code: code, countryCode: 'us' }
    return { city: trimmed, countryCode: 'us' }
  }

  // Scrap.io only accepts per_page of 1, 10, 25 or 50
  private static perPage(limit: number): number {
    if (limit <= 1)
      return 1
    if (limit <= 10)
      return 10
    if (limit <= 25)
      return 25
    return 50
  }

  private static mapPlace(place: ScrapioPlace): ScrapioResult {
    const mainType = place.types?.find(t => t.is_main)?.type ?? place.types?.[0]?.type
    const firstEmail = place.website_data?.emails?.[0]
    const socialLinks: Record<string, string> = {}
    for (const key of SOCIAL_KEYS) {
      const url = place.website_data?.[key]?.[0]
      if (url)
        socialLinks[key] = url
    }
    return {
      externalId: place.google_id ?? place.place_id ?? '',
      googleId: place.google_id ?? null,
      placeId: place.place_id ?? null,
      name: place.name ?? '',
      website: place.website ?? null,
      phone: place.phone ?? null,
      email: (typeof firstEmail === 'string' ? firstEmail : firstEmail?.email) ?? null,
      street: place.location_street_1 ?? null,
      city: place.location_city ?? null,
      state: place.location_state ?? null,
      postalCode: place.location_postal_code ?? null,
      country: place.location_country_code ?? null,
      lat: place.location_latitude ?? null,
      lng: place.location_longitude ?? null,
      industry: mainType ?? null,
      categories: place.types?.map(t => t.type).filter((t): t is string => !!t) ?? [],
      rating: place.reviews_rating ?? null,
      reviewCount: place.reviews_count ?? null,
      priceRange: place.price_range ?? null,
      isClaimed: place.is_claimed ?? null,
      isPermanentlyClosed: place.is_closed ?? null,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      technologies: place.website_data?.technologies ?? [],
      raw: place,
    }
  }
}
