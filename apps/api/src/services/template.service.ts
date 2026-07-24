// Templates — VIDEO templates (script/scenes with {{placeholders}}), two modes: a plain
// avatar video (avatarId + videoScript + optional voiceId override) or a HeyGen studio
// template (heygenTemplateId + videoScenes, one text per scene). Editable in place, no
// versioning. (The campaign-era email part was removed 2026-07-23 — Smartlead owns email.)

import type { createPrisma } from '../lib/prisma'
import { HeygenService } from './heygen.service'

type PrismaClient = ReturnType<typeof createPrisma>

export interface TemplateSaveInput {
  id?: string | null
  name: string
  videoScript?: string | null
  videoScenes?: Array<string> | null
  avatarId?: string | null
  voiceId?: string | null
  heygenTemplateId?: string | null
}

export abstract class TemplateService {
  static list(prisma: PrismaClient) {
    return prisma.template.findMany({ orderBy: { updatedAt: 'desc' } })
  }

  static save(prisma: PrismaClient, input: TemplateSaveInput) {
    const data = {
      name: input.name,
      videoScript: input.videoScript ?? null,
      videoScenes: input.videoScenes ?? [],
      avatarId: input.avatarId ?? null,
      voiceId: input.voiceId ?? null,
      heygenTemplateId: input.heygenTemplateId ?? null,
    }
    return input.id
      ? prisma.template.update({ where: { id: input.id }, data })
      : prisma.template.create({ data })
  }

  // Videos rendered from it survive (their templateId nulls out — optional relation).
  static remove(prisma: PrismaClient, id: string) {
    return prisma.template.delete({ where: { id } })
  }

  /** HeyGen voices for the template editor's voice picker. */
  static heygenVoices(env: Env) {
    return HeygenService.listVoices(env)
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
