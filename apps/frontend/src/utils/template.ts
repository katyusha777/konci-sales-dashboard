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
