import type { IHeygenTemplate, ITemplate } from '~/app/types'
import { dummyHeygenTemplates, dummyTemplates } from '~/app/dummy-data/templates'
import { dummy } from './client'

// DUMMY-BACKED (frontend-first phase).
export abstract class TemplatesApi {
  static list(): Promise<Array<ITemplate>> {
    return dummy(dummyTemplates)
  }

  static heygenTemplates(): Promise<Array<IHeygenTemplate>> {
    return dummy(dummyHeygenTemplates, 150)
  }

  static async save(template: ITemplate): Promise<ITemplate> {
    const index = dummyTemplates.findIndex(t => t.id === template.id)
    const saved = { ...template, updatedAt: new Date().toISOString() }
    if (index >= 0) {
      dummyTemplates[index] = saved
    }
    else {
      saved.id = `tpl_${Date.now()}`
      saved.createdAt = saved.updatedAt
      dummyTemplates.unshift(saved)
    }
    return dummy(saved, 300)
  }
}
