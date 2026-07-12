import { Hono } from 'hono'
import TemplateController from '../controllers/template.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const templatesRoutes = new Hono<AppEnv>()

templatesRoutes.get('/', action(TemplateController, 'index'))
templatesRoutes.post('/', action(TemplateController, 'save'))
templatesRoutes.get('/heygen', action(TemplateController, 'heygenTemplates'))
