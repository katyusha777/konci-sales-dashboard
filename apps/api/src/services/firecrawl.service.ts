// Firecrawl — website scraping (JS-rendered pages → markdown + links).
// Base URL: https://api.firecrawl.dev · Auth: Authorization: Bearer <FIRECRAWL_API_KEY>
// Booking-platform aware: strips booking-flow URL segments, clicks through Squire's
// "Book now" to reach staff lists, and rejects garbage pages. ~$0.001 per page.

import { isBookingPlatform } from '../lib/website'

const BASE_URL = 'https://api.firecrawl.dev'

// Platforms whose staff/service data only renders after clicking a "Book now" CTA.
const CLICK_THROUGH_PLATFORMS = /getsquire\.com/i

// Booking subpaths that are dynamic cart/flow pages — resolve to the profile page first.
// `book`/`booking` only match when terminal so profile paths like
// /booking/brands/ninevehbarbershop (Squire) are preserved intact.
const BOOKING_SUBPATH_PATTERN = /\/(book-now|schedule|appointments|reserve|checkout|cart)(\/.*)?$|\/(book|booking)$/i

// Patterns that indicate the page returned empty/useless content
const GARBAGE_PATTERNS = [
  /cart is empty/i,
  /page not found/i,
  /404 not found/i,
  /access denied/i,
  /just a moment/i,
  /checking your browser/i,
  /enable javascript/i,
  /BESbswy/,
]

export interface FirecrawlResult {
  url: string // the URL actually scraped (booking sub-paths may have been stripped)
  markdown: string
  title: string | null
  description: string | null
  links: Array<string>
  isBookingPlatform: boolean
  raw: unknown
}

function resolveProfileUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    // Strip only the matching booking-flow segment, not the whole path
    parsed.pathname = parsed.pathname.replace(BOOKING_SUBPATH_PATTERN, '') || '/'
    return parsed.toString()
  }
  catch {
    return url
  }
}

export function isUsefulContent(markdown: string): boolean {
  const trimmed = markdown.trim()
  if (trimmed.length < 300)
    return false
  return !GARBAGE_PATTERNS.some(re => re.test(trimmed))
}

export abstract class FirecrawlService {
  static async scrape(env: Env, url: string): Promise<FirecrawlResult> {
    const booking = isBookingPlatform(url)
    if (booking)
      url = resolveProfileUrl(url)

    // Squire renders staff only after clicking "Book now" — click `main button`
    // (skips cookie banners outside <main>) then wait for the staff list.
    const needsClickThrough = booking && CLICK_THROUGH_PLATFORMS.test(url)

    const body: Record<string, unknown> = {
      url,
      formats: ['markdown', 'links'],
      onlyMainContent: !booking,
      waitFor: booking ? 5000 : 2000,
      timeout: 60000,
    }
    if (needsClickThrough) {
      body.waitFor = 4000
      body.actions = [
        { type: 'click', selector: 'main button' },
        { type: 'wait', milliseconds: 5000 },
      ]
    }
    else if (booking) {
      body.actions = [
        { type: 'wait', milliseconds: 3000 },
        { type: 'scroll', direction: 'down', amount: 500 },
        { type: 'wait', milliseconds: 1000 },
      ]
    }

    const res = await fetch(`${BASE_URL}/v1/scrape`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok)
      throw new Error(`Firecrawl error ${res.status}: ${await res.text()}`)

    const data = await res.json<{
      success: boolean
      data?: { markdown?: string, metadata?: { title?: string, description?: string }, links?: Array<string> }
    }>()
    if (!data.success || !data.data?.markdown)
      throw new Error('Firecrawl returned no markdown content')

    const markdown = data.data.markdown
    if (!isUsefulContent(markdown))
      throw new Error(`Firecrawl returned unusable content for ${url} (bot protection, empty cart, or JS-only render)`)

    return {
      url,
      markdown,
      title: data.data.metadata?.title ?? null,
      description: data.data.metadata?.description ?? null,
      links: data.data.links ?? [],
      isBookingPlatform: booking,
      raw: data.data.metadata ?? null,
    }
  }

  /** Scrape several URLs in parallel; failed/garbage pages are silently dropped. */
  static async batchScrape(env: Env, urls: Array<string>): Promise<Array<{ url: string, markdown: string }>> {
    if (urls.length === 0)
      return []
    const results = await Promise.allSettled(urls.map(async (url) => {
      const result = await this.scrape(env, url)
      return { url: result.url, markdown: result.markdown }
    }))
    return results
      .filter((r): r is PromiseFulfilledResult<{ url: string, markdown: string }> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}
