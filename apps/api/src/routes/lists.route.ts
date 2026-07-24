import { Hono } from 'hono'
import LeadListController from '../controllers/lead-list.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const listsRoutes = new Hono<AppEnv>()

listsRoutes.get('/', action(LeadListController, 'index'))
listsRoutes.get('/smartlead-campaigns', action(LeadListController, 'smartleadCampaigns'))
listsRoutes.post('/', action(LeadListController, 'store'))
listsRoutes.get('/:id', action(LeadListController, 'show'))
listsRoutes.patch('/:id', action(LeadListController, 'update'))
listsRoutes.delete('/:id', action(LeadListController, 'destroy'))
listsRoutes.get('/:id/members', action(LeadListController, 'members'))
listsRoutes.post('/:id/leads', action(LeadListController, 'addLeads'))
listsRoutes.delete('/:id/members/:memberId', action(LeadListController, 'removeMember'))
listsRoutes.post('/:id/resync', action(LeadListController, 'resync'))
listsRoutes.post('/:id/members/:memberId/resync', action(LeadListController, 'resyncMember'))
