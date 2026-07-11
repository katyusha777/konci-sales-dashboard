import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { healthRoutes } from './health.route'
import { testRoutes } from './test.route'

export const routes = new Hono<AppEnv>().basePath('/api')

routes.route('/health', healthRoutes)
routes.route('/test', testRoutes)
