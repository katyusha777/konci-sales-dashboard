import { Hono } from 'hono'
import VideoController from '../controllers/video.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

// Authed: the /videos page + generating/rechecking renders.
export const videosRoutes = new Hono<AppEnv>()

videosRoutes.get('/', action(VideoController, 'index'))
videosRoutes.post('/', action(VideoController, 'generate'))
videosRoutes.post('/poll', action(VideoController, 'poll'))
