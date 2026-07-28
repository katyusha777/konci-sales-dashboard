import { Hono } from 'hono'
import AdminController from '../controllers/admin.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const adminRoutes = new Hono<AppEnv>()

adminRoutes.get('/counts', action(AdminController, 'counts'))
adminRoutes.post('/delete-all-leads', action(AdminController, 'deleteAllLeads'))
adminRoutes.post('/delete-all-lists', action(AdminController, 'deleteAllLists'))
