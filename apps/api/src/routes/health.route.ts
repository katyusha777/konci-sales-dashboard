import { Hono } from 'hono'
import HealthController from '../controllers/health.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const healthRoutes = new Hono<AppEnv>()

healthRoutes.get('/', action(HealthController, 'check'))
healthRoutes.get('/db', action(HealthController, 'db'))
healthRoutes.get('/db-insert', action(HealthController, 'dbInsert'))
