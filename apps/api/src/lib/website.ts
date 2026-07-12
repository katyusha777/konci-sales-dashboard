// Website/domain classification shared by the enrichment services.
// A booking-platform URL is worth SCRAPING (staff lists) but must never be sent
// to a data provider as the company's own domain — thousands of businesses share it.

// Booking/appointment platforms — unique URL per business, useful to scrape,
// but NOT a company domain for PDL/Hunter lookups.
export const BOOKING_PLATFORMS = new Set([
  'vagaro.com',
  'booksy.com',
  'fresha.com',
  'mindbodyonline.com',
  'styleseat.com',
  'getsquire.com',
  'squareup.com',
  'square.site',
  'genbook.com',
  'appointy.com',
  'acuityscheduling.com',
  'calendly.com',
])

// Link aggregators / social / directories — no unique business content, skip scraping AND lookups.
const LINK_AGGREGATORS = new Set([
  'linktr.ee',
  'linktree.com',
  'beacons.ai',
  'taplink.cc',
  'bio.site',
  'instagram.com',
  'facebook.com',
  'yelp.com',
  'google.com',
  'unit.link',
  'snip.ly',
  'bit.ly',
  't.co',
  'short.io',
])

export function getHostname(website: string): string | null {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '')
  }
  catch {
    return null
  }
}

export function isBookingPlatform(website?: string | null): boolean {
  if (!website)
    return false
  const host = getHostname(website)
  if (!host)
    return false
  // Match exact domain OR any subdomain (e.g. mysite.vagaro.com → vagaro.com)
  return BOOKING_PLATFORMS.has(host) || [...BOOKING_PLATFORMS].some(platform => host.endsWith(`.${platform}`))
}

/** True for domains that are useless as a company domain in provider lookups. */
export function isSharedDomain(website?: string | null): boolean {
  if (!website)
    return false
  const host = getHostname(website)
  if (!host)
    return false
  return BOOKING_PLATFORMS.has(host) || LINK_AGGREGATORS.has(host)
}

/** True for domains with no useful scrapeable content. */
export function shouldSkipScrape(website?: string | null): boolean {
  if (!website)
    return false
  const host = getHostname(website)
  return !!host && LINK_AGGREGATORS.has(host)
}
