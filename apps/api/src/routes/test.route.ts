import { Hono } from 'hono'
import TestController from '../controllers/test.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const testRoutes = new Hono<AppEnv>()

testRoutes.get('/:foo', action(TestController, 'show'))
