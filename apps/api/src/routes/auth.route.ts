import { Hono } from 'hono'
import AuthController from '../controllers/auth.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/login', action(AuthController, 'login'))
authRoutes.get('/callback', action(AuthController, 'callback'))
authRoutes.get('/me', action(AuthController, 'me'))
authRoutes.post('/logout', action(AuthController, 'logout'))
