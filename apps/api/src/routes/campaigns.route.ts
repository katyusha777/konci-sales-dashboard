import { Hono } from 'hono'
import CampaignController from '../controllers/campaign.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const campaignsRoutes = new Hono<AppEnv>()

campaignsRoutes.get('/', action(CampaignController, 'index'))
campaignsRoutes.post('/', action(CampaignController, 'store'))
campaignsRoutes.get('/:id', action(CampaignController, 'show'))
campaignsRoutes.patch('/:id', action(CampaignController, 'update'))
campaignsRoutes.post('/:id/leads/:campaignLeadId/send', action(CampaignController, 'sendLead'))
