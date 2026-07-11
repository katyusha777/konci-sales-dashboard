import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { authRoutes } from './auth.route'
import { healthRoutes } from './health.route'
import { testRoutes } from './test.route'

export const routes = new Hono<AppEnv>().basePath('/api')

routes.route('/auth', authRoutes)
routes.route('/health', healthRoutes)
routes.route('/test', testRoutes)
