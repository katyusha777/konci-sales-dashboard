import { Hono } from 'hono'
import LeadController from '../controllers/lead.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const leadsRoutes = new Hono<AppEnv>()

// Static paths before /:id
leadsRoutes.get('/', action(LeadController, 'index'))
leadsRoutes.post('/', action(LeadController, 'store'))
leadsRoutes.get('/industries', action(LeadController, 'industries'))
leadsRoutes.post('/import/map-headers', action(LeadController, 'mapHeaders'))
leadsRoutes.post('/import', action(LeadController, 'importCsv'))
leadsRoutes.post('/scrapio/search', action(LeadController, 'scrapioSearch'))
leadsRoutes.post('/scrapio/import', action(LeadController, 'scrapioImport'))

leadsRoutes.get('/:id', action(LeadController, 'show'))
leadsRoutes.patch('/:id', action(LeadController, 'update'))
leadsRoutes.post('/:id/enrich', action(LeadController, 'enrich'))
leadsRoutes.post('/:id/notes', action(LeadController, 'addNote'))
leadsRoutes.get('/:id/enrichment-responses', action(LeadController, 'enrichmentResponses'))
