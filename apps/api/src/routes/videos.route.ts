import { Hono } from 'hono'
import VideoController from '../controllers/video.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

// Authed: generating a test video from the lead detail / templates pages.
export const videosRoutes = new Hono<AppEnv>()

videosRoutes.post('/', action(VideoController, 'generate'))
