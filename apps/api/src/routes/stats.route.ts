import { Hono } from 'hono'
import StatsController from '../controllers/stats.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const statsRoutes = new Hono<AppEnv>()

statsRoutes.get('/overview', action(StatsController, 'overview'))
