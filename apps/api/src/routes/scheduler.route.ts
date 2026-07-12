import { Hono } from 'hono'
import SchedulerController from '../controllers/scheduler.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const schedulerRoutes = new Hono<AppEnv>()

schedulerRoutes.post('/run', action(SchedulerController, 'run'))
