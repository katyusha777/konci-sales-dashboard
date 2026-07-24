/** "+19492164643" → "(949) 216-4643" (US national format). Anything unparseable passes through. */
export function formatPhoneNational(phone: string | null | undefined): string {
  if (!phone)
    return ''
  const digits = phone.replace(/\D/g, '')
  const n = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (n.length !== 10)
    return phone
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
}

/**
 * Test-mode outreach address: company name → "companyname@katyusha.app".
 * @katyusha.app is a catch-all inbox, so every test lead gets a unique, receivable
 * address that identifies the company at a glance.
 */
export function testModeEmail(companyName: string): string {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${slug || 'lead'}@katyusha.app`
}
