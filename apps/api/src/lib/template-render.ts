// Backend template renderer — the exact same two regexes as the frontend preview
// renderer (apps/frontend/src/utils/template.ts), so a template previewed in the UI
// renders identically when actually sent. Keep the regexes in sync across both files.
//
// DIVERGENCE from the frontend: on a missing variable the frontend keeps the literal
// `{{var}}` (helpful in a preview); when SENDING we substitute an empty string instead,
// so a prospect never sees a raw `{{demo_pin}}` leak. The {{#if}} conditional is identical.

import type { Contact, Lead } from '../generated/prisma/client'

/** Render `{{#if var}}…{{/if}}` conditionals then `{{var}}` substitutions. Missing → ''. */
export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text
    .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key: string, content: string) => (vars[key] ? content : ''))
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

/** Every variable name a template references — both `{{var}}` and `{{#if var}}`. */
export function extractTemplateVars(text: string): Array<string> {
  const vars = new Set<string>()
  for (const match of text.matchAll(/\{\{#if (\w+)\}\}/g))
    vars.add(match[1]!)
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g))
    vars.add(match[1]!)
  return [...vars]
}

/**
 * Build the placeholder map for a lead + the contact being emailed. The two URL
 * placeholders are context-dependent (they need per-send tokens) so the caller passes them.
 * Placeholders (plan §3): business_name, contact_first_name, industry, city,
 * video_url, demo_phone, demo_pin, unsubscribe_url.
 */
export function buildLeadVars(
  lead: Pick<Lead, 'name' | 'industry' | 'city' | 'demoPhone' | 'demoPin'>,
  contact: Pick<Contact, 'firstName'> | null,
  urls: { videoUrl?: string, unsubscribeUrl?: string } = {},
): Record<string, string> {
  return {
    business_name: lead.name ?? '',
    contact_first_name: contact?.firstName ?? '',
    industry: lead.industry ?? '',
    city: lead.city ?? '',
    video_url: urls.videoUrl ?? '',
    demo_phone: lead.demoPhone ?? '',
    demo_pin: lead.demoPin ?? '',
    unsubscribe_url: urls.unsubscribeUrl ?? '',
  }
}
