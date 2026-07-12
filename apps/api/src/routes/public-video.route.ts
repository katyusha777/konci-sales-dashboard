import { Hono } from 'hono'
import VideoController from '../controllers/video.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

// PUBLIC (mounted at /api/v — see auth.middleware PUBLIC_PREFIXES): the /v/:token landing
// page's data, the R2 byte stream, and engagement events.
export const publicVideoRoutes = new Hono<AppEnv>()

publicVideoRoutes.get('/:token', action(VideoController, 'page'))
publicVideoRoutes.get('/:token/stream', action(VideoController, 'stream'))
publicVideoRoutes.post('/:token/event', action(VideoController, 'event'))
