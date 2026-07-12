import { Hono } from 'hono'
import PlaygroundController from '../controllers/playground.controller'
import type { AppEnv } from '../lib/context'
import { action } from '../lib/controller'

export const playgroundRoutes = new Hono<AppEnv>()

playgroundRoutes.post('/scrapio/search', action(PlaygroundController, 'scrapioSearch'))
playgroundRoutes.get('/scrapio/place', action(PlaygroundController, 'scrapioPlace'))

playgroundRoutes.get('/heygen/avatars', action(PlaygroundController, 'heygenAvatars'))
playgroundRoutes.get('/heygen/avatar-groups', action(PlaygroundController, 'heygenAvatarGroups'))
playgroundRoutes.get('/heygen/voices', action(PlaygroundController, 'heygenVoices'))
playgroundRoutes.get('/heygen/templates', action(PlaygroundController, 'heygenTemplates'))
playgroundRoutes.get('/heygen/templates/:id', action(PlaygroundController, 'heygenTemplateVariables'))
playgroundRoutes.post('/heygen/generate', action(PlaygroundController, 'heygenGenerate'))
playgroundRoutes.post('/heygen/generate-from-template', action(PlaygroundController, 'heygenGenerateFromTemplate'))
playgroundRoutes.get('/heygen/videos/:id/status', action(PlaygroundController, 'heygenVideoStatus'))

playgroundRoutes.get('/email/config', action(PlaygroundController, 'emailConfig'))
playgroundRoutes.post('/email/send', action(PlaygroundController, 'emailSend'))

playgroundRoutes.post('/apollo/match', action(PlaygroundController, 'apolloMatch'))
playgroundRoutes.post('/apollo/organization', action(PlaygroundController, 'apolloOrganization'))

playgroundRoutes.post('/pdl/company', action(PlaygroundController, 'pdlCompany'))
playgroundRoutes.post('/pdl/person', action(PlaygroundController, 'pdlPerson'))
playgroundRoutes.post('/pdl/search-people', action(PlaygroundController, 'pdlSearchPeople'))
playgroundRoutes.post('/pdl/search-by-email', action(PlaygroundController, 'pdlSearchByEmail'))

playgroundRoutes.post('/hunter/find-email', action(PlaygroundController, 'hunterFindEmail'))
playgroundRoutes.post('/hunter/domain-search', action(PlaygroundController, 'hunterDomainSearch'))

playgroundRoutes.post('/fullenrich/enrich', action(PlaygroundController, 'fullenrichEnrich'))
playgroundRoutes.get('/fullenrich/enrich/:id', action(PlaygroundController, 'fullenrichEnrichResult'))
playgroundRoutes.post('/fullenrich/reverse-email', action(PlaygroundController, 'fullenrichReverseEmail'))
playgroundRoutes.get('/fullenrich/reverse-email/:id', action(PlaygroundController, 'fullenrichReverseEmailResult'))
playgroundRoutes.post('/fullenrich/search-people', action(PlaygroundController, 'fullenrichSearchPeople'))
playgroundRoutes.post('/fullenrich/search-company', action(PlaygroundController, 'fullenrichSearchCompany'))

playgroundRoutes.post('/firecrawl/scrape', action(PlaygroundController, 'firecrawlScrape'))

playgroundRoutes.get('/google-places/lookup', action(PlaygroundController, 'googlePlacesLookup'))

playgroundRoutes.post('/openrouter/select-pages', action(PlaygroundController, 'openrouterSelectPages'))
playgroundRoutes.post('/openrouter/extract', action(PlaygroundController, 'openrouterExtract'))
