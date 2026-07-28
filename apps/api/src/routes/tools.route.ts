import { Hono } from 'hono'
import ToolsController from '../controllers/tools.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const toolsRoutes = new Hono<AppEnv>()

toolsRoutes.post('/email-builder', action(ToolsController, 'emailBuilder'))
