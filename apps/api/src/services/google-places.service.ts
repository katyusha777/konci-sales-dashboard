// Google Places — business identity check: rating, reviews, hours, canonical website.
// Base URL: https://maps.googleapis.com/maps/api/place · Auth: key query parameter
// Two-step lookup: findplacefromtext → details (~$0.017 per details request).

const BASE_URL = 'https://maps.googleapis.com/maps/api/place'

// Types that appear on virtually every business and carry no signal.
const GENERIC_PLACE_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'store',
  'health',
  'food',
  'premise',
  'subpremise',
  'route',
  'street_address',
  'locality',
  'political',
])

export interface GooglePlacesResult {
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
  businessHours: Array<string> // weekday_text, e.g. ["Monday: 9:00 AM – 5:00 PM", …]
  openNow: boolean | null
  raw: unknown
}

export abstract class GooglePlacesService {
  /** Look up a business by free-text query — usually "{name} {city} {state}". */
  static async lookup(env: Env, query: string): Promise<GooglePlacesResult | null> {
    // Step 1: find the place_id
    const findUrl = new URL(`${BASE_URL}/findplacefromtext/json`)
    findUrl.searchParams.set('input', query)
    findUrl.searchParams.set('inputtype', 'textquery')
    findUrl.searchParams.set('fields', 'place_id')
    findUrl.searchParams.set('key', env.GOOGLE_PLACES_API_KEY)

    const findRes = await fetch(findUrl)
    if (!findRes.ok)
      throw new Error(`Google Places findplace HTTP ${findRes.status}`)
    const findData = await findRes.json<{ status: string, error_message?: string, candidates?: Array<{ place_id?: string }> }>()
    if (findData.status === 'ZERO_RESULTS')
      return null
    if (findData.status !== 'OK')
      throw new Error(`Google Places findplace status ${findData.status}: ${findData.error_message ?? ''}`)
    const placeId = findData.candidates?.[0]?.place_id
    if (!placeId)
      return null

    // Step 2: full details (the metered call)
    const detailUrl = new URL(`${BASE_URL}/details/json`)
    detailUrl.searchParams.set('place_id', placeId)
    detailUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,geometry,business_status,opening_hours')
    detailUrl.searchParams.set('key', env.GOOGLE_PLACES_API_KEY)

    const detailRes = await fetch(detailUrl)
    if (!detailRes.ok)
      throw new Error(`Google Places details HTTP ${detailRes.status}`)
    const detailData = await detailRes.json<{
      status: string
      error_message?: string
      result?: {
        place_id?: string
        name?: string
        formatted_address?: string
        formatted_phone_number?: string
        website?: string
        rating?: number
        user_ratings_total?: number
        types?: Array<string>
        geometry?: { location?: { lat?: number, lng?: number } }
        business_status?: string
        opening_hours?: { weekday_text?: Array<string>, open_now?: boolean }
      }
    }>()
    if (detailData.status !== 'OK' || !detailData.result)
      throw new Error(`Google Places details status ${detailData.status}: ${detailData.error_message ?? ''}`)

    const r = detailData.result
    const meaningfulTypes = (r.types ?? []).filter(t => !GENERIC_PLACE_TYPES.has(t))

    return {
      placeId: r.place_id ?? null,
      name: r.name ?? null,
      address: r.formatted_address ?? null,
      phone: r.formatted_phone_number ?? null,
      website: r.website ?? null,
      rating: r.rating ?? null,
      reviewCount: r.user_ratings_total ?? null,
      types: meaningfulTypes.length ? meaningfulTypes : (r.types ?? []),
      businessStatus: r.business_status ?? null,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
      businessHours: r.opening_hours?.weekday_text ?? [],
      openNow: r.opening_hours?.open_now ?? null,
      raw: r,
    }
  }
}
