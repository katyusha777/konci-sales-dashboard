import type { IHeygenTemplate, IHeygenVoice, ITemplate } from '~/app/types'
import { $api } from './client'

export abstract class TemplatesApi {
  static list(): Promise<Array<ITemplate>> {
    return $api('/api/templates')
  }

  static heygenTemplates(): Promise<Array<IHeygenTemplate>> {
    return $api('/api/templates/heygen')
  }

  static voices(): Promise<Array<IHeygenVoice>> {
    return $api('/api/templates/voices')
  }

  // Insert (no id) or update (id present) — the backend routes on id presence.
  static save(template: ITemplate): Promise<ITemplate> {
    return $api('/api/templates', { method: 'POST', body: template })
  }

  static remove(id: string): Promise<void> {
    return $api(`/api/templates/${id}`, { method: 'DELETE' })
  }
}
