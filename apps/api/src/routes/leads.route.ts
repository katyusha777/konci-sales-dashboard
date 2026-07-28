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
leadsRoutes.get('/scrapio/types', action(LeadController, 'scrapioTypes'))
leadsRoutes.post('/scrapio/import', action(LeadController, 'scrapioImport'))
leadsRoutes.post('/bulk-delete', action(LeadController, 'bulkDelete'))

leadsRoutes.get('/:id', action(LeadController, 'show'))
leadsRoutes.patch('/:id', action(LeadController, 'update'))
leadsRoutes.post('/:id/enrich', action(LeadController, 'enrich'))
leadsRoutes.post('/:id/notes', action(LeadController, 'addNote'))
leadsRoutes.get('/:id/enrichment-responses', action(LeadController, 'enrichmentResponses'))
leadsRoutes.post('/:id/pick-outreach-email', action(LeadController, 'pickOutreachEmail'))
leadsRoutes.post('/:id/konci/register', action(LeadController, 'konciRegister'))
leadsRoutes.post('/:id/konci/refresh', action(LeadController, 'konciRefresh'))
leadsRoutes.post('/:id/konci/retry', action(LeadController, 'konciRetry'))
leadsRoutes.post('/:id/konci/claim-link', action(LeadController, 'konciClaimLink'))
