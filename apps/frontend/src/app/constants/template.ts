// The placeholder variables a template may reference. Mirrors the backend's
// buildLeadVars map (apps/api/src/lib/template-render.ts) — keep the two in sync.
export const TEMPLATE_PLACEHOLDERS = [
  'business_name',
  'contact_first_name',
  'industry',
  'city',
  'video_url',
  'demo_phone',
  'demo_pin',
  'unsubscribe_url',
] as const

// The subset that makes sense inside a VIDEO script (spoken aloud — no URLs).
export const VIDEO_PLACEHOLDERS = [
  'business_name',
  'contact_first_name',
  'industry',
  'city',
  'demo_phone',
  'demo_pin',
] as const
