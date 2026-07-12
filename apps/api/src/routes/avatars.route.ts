import { Hono } from 'hono'
import AvatarController from '../controllers/avatar.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const avatarsRoutes = new Hono<AppEnv>()

avatarsRoutes.get('/', action(AvatarController, 'index'))
avatarsRoutes.post('/sync', action(AvatarController, 'sync'))
avatarsRoutes.patch('/:id', action(AvatarController, 'setActive'))
