import type { IContact, IEmailSummary, ILead, ILeadCost, ILeadDetail, ILeadNote } from '~/app/types'

let seq = 0
function makeLead(partial: Partial<ILead> & Pick<ILead, 'name' | 'city' | 'state' | 'industry'>): ILead {
  seq++
  const id = `lead_${String(seq).padStart(3, '0')}`
  const domain = partial.domain ?? `${partial.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`
  return {
    id,
    domain,
    website: `https://${domain}`,
    email: `info@${domain}`,
    phone: `+1512555${String(1000 + seq)}`,
    street: `${100 + seq * 7} Main St`,
    postalCode: `7870${seq % 10}`,
    country: 'US',
    categories: [partial.industry ?? ''],
    googleRating: 4.2,
    googleReviewCount: 87,
    employeeCount: 12,
    services: [],
    businessHours: null,
    description: null,
    ownerName: null,
    source: 'SCRAPIO',
    status: 'NEW',
    enrichmentStatus: 'PENDING',
    enrichmentScore: 0,
    enrichmentAttempts: 0,
    lastEnrichedAt: null,
    assignedTo: null,
    lastContactedAt: null,
    lastEngagedAt: null,
    konciCustomerId: null,
    demoPhone: null,
    demoPin: null,
    totalCostUsd: 0,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-10T10:00:00Z',
    ...partial,
  }
}

export const dummyLeads: Array<ILead> = [
  makeLead({ name: 'Lonestar Dental Care', city: 'Austin', state: 'TX', industry: 'Dentist', status: 'ENGAGED', enrichmentStatus: 'COMPLETED', enrichmentScore: 85, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-05T14:20:00Z', totalCostUsd: 3.12, lastContactedAt: '2026-07-08T09:15:00Z', lastEngagedAt: '2026-07-09T16:42:00Z', googleRating: 4.8, googleReviewCount: 214, assignedTo: 'shaun@hackhouse.io', demoPhone: '+15125559876', demoPin: '4821', ownerName: 'Dr. Sarah Mitchell', description: 'Family and cosmetic dentistry practice serving north Austin for 15+ years. Known for same-day crowns and a fast front desk.', services: ['General dentistry', 'Dental implants', 'Invisalign', 'Teeth whitening'], businessHours: { Monday: '8 AM–5 PM', Tuesday: '8 AM–5 PM', Wednesday: '8 AM–5 PM', Thursday: '8 AM–5 PM', Friday: '8 AM–2 PM', Saturday: 'Closed', Sunday: 'Closed' } }),
  makeLead({ name: 'Bella Vista Ristorante', city: 'Austin', state: 'TX', industry: 'Restaurant', status: 'REPLIED', enrichmentStatus: 'COMPLETED', enrichmentScore: 78, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-04T11:00:00Z', totalCostUsd: 0.06, lastContactedAt: '2026-07-06T10:00:00Z', lastEngagedAt: '2026-07-07T08:30:00Z', googleRating: 4.6, googleReviewCount: 452 }),
  makeLead({ name: 'Hill Country Plumbing', city: 'San Antonio', state: 'TX', industry: 'Plumber', status: 'CLOSED_WON', enrichmentStatus: 'COMPLETED', enrichmentScore: 92, enrichmentAttempts: 1, lastEnrichedAt: '2026-06-20T09:00:00Z', totalCostUsd: 4.85, lastContactedAt: '2026-06-25T14:00:00Z', lastEngagedAt: '2026-06-28T11:20:00Z', konciCustomerId: 'kc_8f3a91', demoPhone: '+12105551234', demoPin: '7733', googleRating: 4.9, googleReviewCount: 189, assignedTo: 'shaun@hackhouse.io', ownerName: 'Jim Bowers', description: '24/7 emergency plumbing across the San Antonio metro. Fleet of 8 trucks.', services: ['Emergency plumbing', 'Water heaters', 'Drain cleaning', 'Repiping'], businessHours: { Monday: 'Open 24 hours', Tuesday: 'Open 24 hours', Wednesday: 'Open 24 hours', Thursday: 'Open 24 hours', Friday: 'Open 24 hours', Saturday: 'Open 24 hours', Sunday: 'Open 24 hours' } }),
  makeLead({ name: 'Glow & Go Salon', city: 'Dallas', state: 'TX', industry: 'Hair salon', status: 'CONTACTED', enrichmentStatus: 'COMPLETED', enrichmentScore: 71, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-06T16:45:00Z', totalCostUsd: 0.06, lastContactedAt: '2026-07-09T10:05:00Z', googleRating: 4.4, googleReviewCount: 96 }),
  makeLead({ name: 'Alamo City HVAC', city: 'San Antonio', state: 'TX', industry: 'HVAC contractor', status: 'ENRICHED', enrichmentStatus: 'COMPLETED', enrichmentScore: 88, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-09T13:30:00Z', totalCostUsd: 0.10, googleRating: 4.7, googleReviewCount: 321 }),
  makeLead({ name: 'Paws & Claws Veterinary', city: 'Houston', state: 'TX', industry: 'Veterinarian', status: 'ENRICHED', enrichmentStatus: 'COMPLETED', enrichmentScore: 64, enrichmentAttempts: 2, lastEnrichedAt: '2026-07-08T10:10:00Z', totalCostUsd: 0.14, googleRating: 4.5, googleReviewCount: 143 }),
  makeLead({ name: 'Sunrise Bakery', city: 'Houston', state: 'TX', industry: 'Bakery', status: 'NEW', enrichmentStatus: 'FAILED', enrichmentScore: 20, enrichmentAttempts: 3, lastEnrichedAt: '2026-07-07T08:00:00Z', totalCostUsd: 0.05, website: null, email: null, googleRating: 4.1, googleReviewCount: 38 }),
  makeLead({ name: 'Texas Star Auto Repair', city: 'Fort Worth', state: 'TX', industry: 'Auto repair shop', status: 'DO_NOT_CONTACT', enrichmentStatus: 'COMPLETED', enrichmentScore: 55, enrichmentAttempts: 1, lastEnrichedAt: '2026-06-30T12:00:00Z', totalCostUsd: 0.06, googleRating: 3.9, googleReviewCount: 67 }),
  makeLead({ name: 'Riverside Chiropractic', city: 'Austin', state: 'TX', industry: 'Chiropractor', status: 'IN_CAMPAIGN', enrichmentStatus: 'COMPLETED', enrichmentScore: 81, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-05T09:30:00Z', totalCostUsd: 3.06, googleRating: 4.8, googleReviewCount: 176, demoPhone: '+15125553344', demoPin: '1199' }),
  makeLead({ name: 'The Fade Factory', city: 'Dallas', state: 'TX', industry: 'Barber shop', status: 'CONTACTED', enrichmentStatus: 'COMPLETED', enrichmentScore: 69, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-03T15:00:00Z', totalCostUsd: 0.06, lastContactedAt: '2026-07-08T11:30:00Z', googleRating: 4.6, googleReviewCount: 88 }),
  makeLead({ name: 'Green Thumb Landscaping', city: 'Austin', state: 'TX', industry: 'Landscaper', status: 'NEW', enrichmentStatus: 'IN_PROGRESS', enrichmentScore: 0, enrichmentAttempts: 1, source: 'CSV', googleRating: 4.3, googleReviewCount: 54 }),
  makeLead({ name: 'Bluebonnet Law Group', city: 'Houston', state: 'TX', industry: 'Law firm', status: 'NEW', enrichmentStatus: 'PENDING', source: 'CSV', googleRating: 4.9, googleReviewCount: 41 }),
  makeLead({ name: 'Coastal Physical Therapy', city: 'Corpus Christi', state: 'TX', industry: 'Physical therapist', status: 'ENRICHED', enrichmentStatus: 'COMPLETED', enrichmentScore: 76, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-09T10:00:00Z', totalCostUsd: 0.10, googleRating: 4.7, googleReviewCount: 112 }),
  makeLead({ name: 'Metro Roofing Co', city: 'Dallas', state: 'TX', industry: 'Roofing contractor', status: 'CLOSED_LOST', enrichmentStatus: 'COMPLETED', enrichmentScore: 73, enrichmentAttempts: 1, lastEnrichedAt: '2026-06-15T10:00:00Z', totalCostUsd: 3.21, lastContactedAt: '2026-06-18T09:00:00Z', lastEngagedAt: '2026-06-19T14:00:00Z', googleRating: 4.2, googleReviewCount: 205 }),
  makeLead({ name: 'Happy Kids Daycare', city: 'San Antonio', state: 'TX', industry: 'Day care center', status: 'NEW', enrichmentStatus: 'PENDING', source: 'MANUAL', googleRating: 4.5, googleReviewCount: 73 }),
  makeLead({ name: 'Lone Oak Winery', city: 'Fredericksburg', state: 'TX', industry: 'Winery', status: 'ENGAGED', enrichmentStatus: 'COMPLETED', enrichmentScore: 83, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-02T10:00:00Z', totalCostUsd: 3.15, lastContactedAt: '2026-07-05T10:00:00Z', lastEngagedAt: '2026-07-06T19:22:00Z', googleRating: 4.8, googleReviewCount: 388, demoPhone: '+18305557788', demoPin: '2468' }),
  makeLead({ name: 'Precision Eye Center', city: 'Austin', state: 'TX', industry: 'Optometrist', status: 'IN_CAMPAIGN', enrichmentStatus: 'COMPLETED', enrichmentScore: 79, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-08T08:45:00Z', totalCostUsd: 0.10, googleRating: 4.6, googleReviewCount: 157 }),
  makeLead({ name: 'Big Tex BBQ Pit', city: 'Fort Worth', state: 'TX', industry: 'Restaurant', status: 'CONTACTED', enrichmentStatus: 'COMPLETED', enrichmentScore: 67, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-01T12:00:00Z', totalCostUsd: 0.06, lastContactedAt: '2026-07-07T09:40:00Z', googleRating: 4.4, googleReviewCount: 621 }),
  makeLead({ name: 'Serenity Spa & Wellness', city: 'Houston', state: 'TX', industry: 'Spa', status: 'NEW', enrichmentStatus: 'SKIPPED', enrichmentScore: 35, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-06T10:00:00Z', totalCostUsd: 0.02, website: null, googleRating: 3.7, googleReviewCount: 19 }),
  makeLead({ name: 'Capital City Movers', city: 'Austin', state: 'TX', industry: 'Moving company', status: 'ENRICHED', enrichmentStatus: 'COMPLETED', enrichmentScore: 74, enrichmentAttempts: 1, lastEnrichedAt: '2026-07-09T15:30:00Z', totalCostUsd: 0.10, googleRating: 4.5, googleReviewCount: 234 }),
]

export const dummyContacts: Record<string, Array<IContact>> = {
  lead_001: [
    { id: 'ct_001', leadId: 'lead_001', firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah@lonestardentalcare.com', phone: '+15125551111', jobTitle: 'Practice Owner', linkedinUrl: 'https://linkedin.com/in/sarahmitchell', priority: 1, emailStatus: 'VALID', source: 'APOLLO' },
    { id: 'ct_002', leadId: 'lead_001', firstName: 'David', lastName: 'Chen', email: 'david@lonestardentalcare.com', phone: null, jobTitle: 'Office Manager', linkedinUrl: null, priority: 2, emailStatus: 'UNKNOWN', source: 'APOLLO' },
  ],
  lead_002: [
    { id: 'ct_003', leadId: 'lead_002', firstName: 'Marco', lastName: 'Rossi', email: 'marco@bellavistaristorante.com', phone: '+15125552222', jobTitle: 'Owner', linkedinUrl: null, priority: 1, emailStatus: 'VALID', source: 'SCRAPIO' },
  ],
  lead_003: [
    { id: 'ct_004', leadId: 'lead_003', firstName: 'Jim', lastName: 'Bowers', email: 'jim@hillcountryplumbing.com', phone: '+12105554444', jobTitle: 'Owner', linkedinUrl: 'https://linkedin.com/in/jimbowers', priority: 1, emailStatus: 'VALID', source: 'APOLLO' },
  ],
  lead_007: [
    { id: 'ct_005', leadId: 'lead_007', firstName: 'Rosa', lastName: 'Delgado', email: 'rosa@sunrisebakery.com', phone: null, jobTitle: 'Owner', linkedinUrl: null, priority: 1, emailStatus: 'BOUNCED', source: 'SCRAPIO' },
  ],
}

export const dummyNotes: Record<string, Array<ILeadNote>> = {
  lead_001: [
    { id: 'nt_001', leadId: 'lead_001', author: 'shaun@hackhouse.io', body: 'Watched 75% of the demo video. Front desk said Dr. Mitchell handles vendor decisions — call back Thursday AM.', createdAt: '2026-07-09T17:00:00Z' },
    { id: 'nt_002', leadId: 'lead_001', author: 'shaun@hackhouse.io', body: 'They currently use a human answering service, ~$800/mo. Strong fit.', createdAt: '2026-07-08T10:30:00Z' },
  ],
  lead_003: [
    { id: 'nt_003', leadId: 'lead_003', author: 'shaun@hackhouse.io', body: 'CLOSED! Signed annual. Onboarded on Konci, customer ID kc_8f3a91.', createdAt: '2026-06-30T15:00:00Z' },
  ],
}

export const dummyCosts: Record<string, Array<ILeadCost>> = {
  lead_001: [
    { id: 'cost_001', leadId: 'lead_001', type: 'ENRICHMENT', amountUsd: 0.06, description: 'Scrap.io place + Apollo contact match', createdAt: '2026-07-05T14:20:00Z' },
    { id: 'cost_002', leadId: 'lead_001', type: 'VIDEO', amountUsd: 3.00, description: 'HeyGen video (avatar: Maya)', createdAt: '2026-07-07T09:00:00Z' },
    { id: 'cost_003', leadId: 'lead_001', type: 'EMAIL', amountUsd: 0.06, description: 'Campaign: Dental — Austin (step 1)', createdAt: '2026-07-08T09:15:00Z' },
  ],
  lead_003: [
    { id: 'cost_004', leadId: 'lead_003', type: 'ENRICHMENT', amountUsd: 0.10, description: 'Scrap.io place + Apollo contact match', createdAt: '2026-06-20T09:00:00Z' },
    { id: 'cost_005', leadId: 'lead_003', type: 'VIDEO', amountUsd: 3.00, description: 'HeyGen video (avatar: Jake)', createdAt: '2026-06-24T10:00:00Z' },
    { id: 'cost_006', leadId: 'lead_003', type: 'EMAIL', amountUsd: 0.06, description: 'Campaign: Home services — TX (step 1)', createdAt: '2026-06-25T14:00:00Z' },
  ],
}

export const dummyEmails: Record<string, Array<IEmailSummary>> = {
  lead_001: [
    {
      id: 'em_001',
      subject: 'Sarah, we built an AI receptionist for Lonestar Dental Care',
      status: 'CLICKED',
      campaignName: 'Dental — Austin',
      wasTestMode: true,
      sentAt: '2026-07-08T09:15:00Z',
      events: [
        { type: 'DELIVERED', occurredAt: '2026-07-08T09:15:12Z' },
        { type: 'OPENED', occurredAt: '2026-07-08T13:02:44Z' },
        { type: 'CLICKED', occurredAt: '2026-07-09T16:42:10Z' },
      ],
    },
  ],
  lead_002: [
    {
      id: 'em_002',
      subject: 'Bella Vista never misses a reservation call again',
      status: 'OPENED',
      campaignName: 'Restaurants — Austin',
      wasTestMode: true,
      sentAt: '2026-07-06T10:00:00Z',
      events: [
        { type: 'DELIVERED', occurredAt: '2026-07-06T10:00:09Z' },
        { type: 'OPENED', occurredAt: '2026-07-07T08:30:21Z' },
      ],
    },
  ],
  lead_007: [
    {
      id: 'em_003',
      subject: 'Sunrise Bakery — your calls, answered 24/7',
      status: 'BOUNCED',
      campaignName: 'Restaurants — Austin',
      wasTestMode: true,
      sentAt: '2026-07-07T08:00:00Z',
      events: [{ type: 'BOUNCED', occurredAt: '2026-07-07T08:00:15Z' }],
    },
  ],
}

export function dummyLeadDetail(id: string): ILeadDetail | null {
  const lead = dummyLeads.find(l => l.id === id)
  if (!lead)
    return null
  return {
    ...lead,
    contacts: dummyContacts[id] ?? [],
    notes: dummyNotes[id] ?? [],
    costs: dummyCosts[id] ?? [],
    emails: dummyEmails[id] ?? [],
  }
}
