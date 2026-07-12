// Templates — email (subject + HTML body) plus an optional video part in one of two
// modes: a plain avatar video (avatarId + videoScript) or a HeyGen studio template
// (heygenTemplateId + videoScenes, one text per scene). Editable in place, no versioning.

import type { createPrisma } from '../lib/prisma'
import { HeygenService } from './heygen.service'

type PrismaClient = ReturnType<typeof createPrisma>

export interface TemplateSaveInput {
  id?: string | null
  name: string
  subject: string
  body: string
  videoScript?: string | null
  videoScenes?: Array<string> | null
  avatarId?: string | null
  heygenTemplateId?: string | null
}

export abstract class TemplateService {
  static list(prisma: PrismaClient) {
    return prisma.template.findMany({ orderBy: { updatedAt: 'desc' } })
  }

  static save(prisma: PrismaClient, input: TemplateSaveInput) {
    const data = {
      name: input.name,
      subject: input.subject,
      body: input.body,
      videoScript: input.videoScript ?? null,
      videoScenes: input.videoScenes ?? [],
      avatarId: input.avatarId ?? null,
      heygenTemplateId: input.heygenTemplateId ?? null,
    }
    return input.id
      ? prisma.template.update({ where: { id: input.id }, data })
      : prisma.template.create({ data })
  }

  /**
   * HeyGen studio templates for the template editor's "HeyGen template" video mode.
   * The frontend needs sceneCount to size its per-scene textareas; HeyGen's list
   * endpoint doesn't include it, so we count each template's variables. N is tiny
   * (a handful of studio templates); on a per-template failure fall back to 0.
   */
  static async heygenTemplates(env: Env): Promise<Array<{ id: string, name: string, sceneCount: number }>> {
    const templates = await HeygenService.listTemplates(env)
    return Promise.all(templates.map(async (t) => {
      let sceneCount = 0
      try {
        const vars = await HeygenService.getTemplateVariables(env, t.templateId)
        sceneCount = Object.keys(vars).length
      }
      catch {
        sceneCount = 0
      }
      return { id: t.templateId, name: t.name, sceneCount }
    }))
  }
}
