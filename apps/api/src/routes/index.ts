import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { authRoutes } from './auth.route'
import { avatarsRoutes } from './avatars.route'
import { campaignsRoutes } from './campaigns.route'
import { healthRoutes } from './health.route'
import { leadsRoutes } from './leads.route'
import { playgroundRoutes } from './playground.route'
import { publicVideoRoutes } from './public-video.route'
import { statsRoutes } from './stats.route'
import { templatesRoutes } from './templates.route'
import { testRoutes } from './test.route'
import { unsubscribeRoutes } from './unsubscribe.route'
import { videosRoutes } from './videos.route'
import { webhooksRoutes } from './webhooks.route'

export const routes = new Hono<AppEnv>().basePath('/api')

routes.route('/auth', authRoutes)
routes.route('/health', healthRoutes)
routes.route('/leads', leadsRoutes)
routes.route('/avatars', avatarsRoutes)
routes.route('/templates', templatesRoutes)
routes.route('/videos', videosRoutes)
routes.route('/v', publicVideoRoutes) // PUBLIC
routes.route('/campaigns', campaignsRoutes)
routes.route('/stats', statsRoutes)
routes.route('/webhooks', webhooksRoutes) // PUBLIC
routes.route('/unsubscribe', unsubscribeRoutes) // PUBLIC
routes.route('/playground', playgroundRoutes)
routes.route('/test', testRoutes)
