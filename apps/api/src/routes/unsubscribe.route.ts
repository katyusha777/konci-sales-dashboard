import { Hono } from 'hono'
import UnsubscribeController from '../controllers/unsubscribe.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

// PUBLIC (see auth.middleware PUBLIC_PREFIXES).
export const unsubscribeRoutes = new Hono<AppEnv>()

unsubscribeRoutes.post('/:token', action(UnsubscribeController, 'unsubscribe'))
