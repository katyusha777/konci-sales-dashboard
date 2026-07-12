// Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, newlines inside
// quotes, CRLF). No dependency — the files are salesperson exports, not war zones.

export interface ParsedCsv {
  headers: Array<string>
  rows: Array<Record<string, string>>
}

export function parseCsv(text: string): ParsedCsv {
  const records: Array<Array<string>> = []
  let record: Array<string> = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        }
        else {
          inQuotes = false
        }
      }
      else {
        field += ch
      }
    }
    else if (ch === '"') {
      inQuotes = true
    }
    else if (ch === ',') {
      record.push(field)
      field = ''
    }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n')
        i++
      record.push(field)
      field = ''
      records.push(record)
      record = []
    }
    else {
      field += ch
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  // Drop fully-empty records (trailing newlines)
  const nonEmpty = records.filter(r => r.some(v => v.trim() !== ''))
  if (nonEmpty.length === 0)
    return { headers: [], rows: [] }

  // Dedupe headers so row objects don't silently drop columns
  const seen = new Map<string, number>()
  const headers = nonEmpty[0]!.map((h) => {
    const name = h.trim() || 'column'
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name} (${count})`
  })

  const rows = nonEmpty.slice(1).map((r) => {
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (r[idx] ?? '').trim()
    })
    return row
  })
  return { headers, rows }
}

// Import mapping targets — mirrors the API's CSV_TARGET_FIELDS
// (apps/api/src/services/openrouter.service.ts). Extend both together.
export const CSV_IMPORT_FIELDS: Array<{ key: string, label: string, required?: boolean }> = [
  { key: 'name', label: 'Business name', required: true },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postal_code', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'industry', label: 'Industry' },
  { key: 'google_id', label: 'Google ID' },
  { key: 'place_id', label: 'Google Place ID' },
  { key: 'google_rating', label: 'Google rating' },
  { key: 'google_review_count', label: 'Google review count' },
  { key: 'employee_count', label: 'Employee count' },
  { key: 'contact_first_name', label: 'Contact first name' },
  { key: 'contact_last_name', label: 'Contact last name' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_title', label: 'Contact job title' },
  { key: 'contact_linkedin_url', label: 'Contact LinkedIn' },
  { key: 'facebook_url', label: 'Facebook URL' },
  { key: 'instagram_url', label: 'Instagram URL' },
  { key: 'linkedin_url', label: 'Company LinkedIn URL' },
  { key: 'twitter_url', label: 'Twitter/X URL' },
  { key: 'youtube_url', label: 'YouTube URL' },
]
