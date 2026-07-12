// Template rendering: {{var}} substitution plus simple conditionals.
// Conditional syntax (kept deliberately simple, no nesting):
//   {{#if industry}}We've helped many {{industry}} businesses.{{/if}}
// The block only renders when the variable has a non-empty value.
export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text
    .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key: string, content: string) => (vars[key] ? content : ''))
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

// All variable names a template uses — both {{var}} and {{#if var}} conditions.
export function extractTemplateVars(text: string): Array<string> {
  const vars = new Set<string>()
  for (const match of text.matchAll(/\{\{#if (\w+)\}\}/g))
    vars.add(match[1]!)
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g))
    vars.add(match[1]!)
  return [...vars]
}

// Just the variables used in {{#if X}} conditionals (for previewing the "empty" branch).
export function extractConditionalVars(text: string): Array<string> {
  const vars = new Set<string>()
  for (const match of text.matchAll(/\{\{#if (\w+)\}\}/g))
    vars.add(match[1]!)
  return [...vars]
}

// Convert newlines to <br> so a plain-text-authored body keeps its line breaks.
// Mirrors the backend renderer (apps/api/src/lib/template-render.ts).
export function nl2br(html: string): string {
  return html.replace(/\r\n|\r|\n/g, '<br>\n')
}
