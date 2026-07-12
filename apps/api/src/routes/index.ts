import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { authRoutes } from './auth.route'
import { healthRoutes } from './health.route'
import { leadsRoutes } from './leads.route'
import { playgroundRoutes } from './playground.route'
import { testRoutes } from './test.route'

export const routes = new Hono<AppEnv>().basePath('/api')

routes.route('/auth', authRoutes)
routes.route('/health', healthRoutes)
routes.route('/leads', leadsRoutes)
routes.route('/playground', playgroundRoutes)
routes.route('/test', testRoutes)
