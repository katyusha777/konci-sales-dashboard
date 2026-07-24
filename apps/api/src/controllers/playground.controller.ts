import type { ApiResponse, AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { ApolloMatchInput, ApolloMatchResult, ApolloOrgResult } from '../services/apollo.service'
import { ApolloService } from '../services/apollo.service'
import { FirecrawlService } from '../services/firecrawl.service'
import type { FirecrawlResult } from '../services/firecrawl.service'
import { FullenrichService } from '../services/fullenrich.service'
import type { FullenrichCompanyResult, FullenrichContactResult, FullenrichEnrichInput, FullenrichPollResult } from '../services/fullenrich.service'
import { GooglePlacesService } from '../services/google-places.service'
import type { GooglePlacesResult } from '../services/google-places.service'
import { HeygenService } from '../services/heygen.service'
import type { HeygenAvatar, HeygenTemplateSummary, HeygenTemplateVariable, HeygenVideoStatus, HeygenVoice } from '../services/heygen.service'
import { HunterService } from '../services/hunter.service'
import type { HunterDomainResult, HunterEmailResult } from '../services/hunter.service'
import { KonciService } from '../services/konci.service'
import type { KonciLeadResult, KonciRegisterInput } from '../services/konci.service'
import { OpenrouterService } from '../services/openrouter.service'
import type { ExtractSignalsResult } from '../services/openrouter.service'
import { PdlService } from '../services/pdl.service'
import type { PdlCompanyInput, PdlCompanyResult, PdlPersonInput, PdlPersonResult, PdlSearchPeopleInput } from '../services/pdl.service'
import { ScrapioService } from '../services/scrapio.service'
import type { ScrapioResult, ScrapioSearchParams } from '../services/scrapio.service'
import { SmartleadService } from '../services/smartlead.service'
import type { SmartleadAnalytics, SmartleadCampaign, SmartleadCampaignLead, SmartleadEmailAccount, SmartleadLeadStat, SmartleadPushLead, SmartleadPushResult } from '../services/smartlead.service'

// Playground endpoints: one place to live-test every third-party service.
// Errors are surfaced verbatim (message + info) so the playground UI shows
// exactly what the provider returned — that's the point of the playground.

export default class PlaygroundController extends Controller {
  // ── Scrap.io ────────────────────────────────────────────────────────────────

  async scrapioSearch(req: AppRequest<{ Body: ScrapioSearchParams }>): Promise<ApiResponse<{ results: Array<ScrapioResult>, nextCursor: string | null, total: number | null }>> {
    try {
      return this.data(await ScrapioService.search(this.c.env, req.body))
    }
    catch (err) {
      return this.error('Scrap.io search failed', (err as Error).message)
    }
  }

  async scrapioPlace(req: AppRequest<{ Query: { googleId?: string } }>): Promise<ApiResponse<ScrapioResult | null>> {
    if (!req.query.googleId)
      return this.error('googleId query parameter is required')
    try {
      return this.data(await ScrapioService.getPlace(this.c.env, req.query.googleId))
    }
    catch (err) {
      return this.error('Scrap.io place lookup failed', (err as Error).message)
    }
  }

  // ── HeyGen ──────────────────────────────────────────────────────────────────

  async heygenAvatars(req: AppRequest<{ Query: { includeStock?: string } }>): Promise<ApiResponse<Array<HeygenAvatar>>> {
    try {
      return this.data(await HeygenService.listAvatars(this.c.env, req.query.includeStock !== 'true'))
    }
    catch (err) {
      return this.error('HeyGen avatar sync failed', (err as Error).message)
    }
  }

  async heygenAvatarGroups(req: AppRequest<{ Query: { includePublic?: string } }>): Promise<ApiResponse<Array<{ groupId: string, name: string, previewImageUrl: string | null, avatars: Array<HeygenAvatar> }>>> {
    try {
      return this.data(await HeygenService.listAvatarGroups(this.c.env, req.query.includePublic === 'true'))
    }
    catch (err) {
      return this.error('HeyGen avatar group list failed', (err as Error).message)
    }
  }

  async heygenVoices(): Promise<ApiResponse<Array<HeygenVoice>>> {
    try {
      return this.data(await HeygenService.listVoices(this.c.env))
    }
    catch (err) {
      return this.error('HeyGen voice list failed', (err as Error).message)
    }
  }

  async heygenTemplates(): Promise<ApiResponse<Array<HeygenTemplateSummary>>> {
    try {
      return this.data(await HeygenService.listTemplates(this.c.env))
    }
    catch (err) {
      return this.error('HeyGen template list failed', (err as Error).message)
    }
  }

  async heygenTemplateVariables(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<Record<string, HeygenTemplateVariable>>> {
    try {
      return this.data(await HeygenService.getTemplateVariables(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('HeyGen template lookup failed', (err as Error).message)
    }
  }

  async heygenGenerate(req: AppRequest<{ Body: { avatarId?: string, characterType?: 'avatar' | 'talking_photo', voiceId?: string, script?: string } }>): Promise<ApiResponse<{ videoId: string }>> {
    const { avatarId, characterType, voiceId, script } = req.body
    if (!avatarId || !voiceId || !script)
      return this.error('avatarId, voiceId and script are required')
    try {
      return this.data({ videoId: await HeygenService.generateVideo(this.c.env, { avatarId, characterType, voiceId, script }) })
    }
    catch (err) {
      return this.error('HeyGen video generation failed', (err as Error).message)
    }
  }

  async heygenGenerateFromTemplate(req: AppRequest<{ Body: { templateId?: string, variables?: Record<string, string> } }>): Promise<ApiResponse<{ videoId: string }>> {
    const { templateId, variables } = req.body
    if (!templateId || !variables)
      return this.error('templateId and variables are required')
    try {
      // test=true → watermarked video that doesn't consume HeyGen credits
      return this.data({ videoId: await HeygenService.generateFromTemplate(this.c.env, templateId, variables, true) })
    }
    catch (err) {
      return this.error('HeyGen template generation failed', (err as Error).message)
    }
  }

  async heygenVideoStatus(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<HeygenVideoStatus>> {
    try {
      return this.data(await HeygenService.getVideoStatus(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('HeyGen status check failed', (err as Error).message)
    }
  }

  // ── Apollo ──────────────────────────────────────────────────────────────────

  async apolloMatch(req: AppRequest<{ Body: ApolloMatchInput }>): Promise<ApiResponse<ApolloMatchResult | null>> {
    try {
      return this.data(await ApolloService.matchPerson(this.c.env, req.body))
    }
    catch (err) {
      return this.error('Apollo match failed', (err as Error).message)
    }
  }

  async apolloOrganization(req: AppRequest<{ Body: { domain?: string } }>): Promise<ApiResponse<ApolloOrgResult | null>> {
    if (!req.body.domain)
      return this.error('domain is required')
    try {
      return this.data(await ApolloService.enrichOrganization(this.c.env, req.body.domain))
    }
    catch (err) {
      return this.error('Apollo organization enrich failed', (err as Error).message)
    }
  }

  // ── PDL (People Data Labs) ──────────────────────────────────────────────────

  async pdlCompany(req: AppRequest<{ Body: PdlCompanyInput }>): Promise<ApiResponse<PdlCompanyResult | null>> {
    if (!req.body.name)
      return this.error('name is required')
    try {
      return this.data(await PdlService.enrichCompany(this.c.env, req.body))
    }
    catch (err) {
      return this.error('PDL company enrich failed', (err as Error).message)
    }
  }

  async pdlPerson(req: AppRequest<{ Body: PdlPersonInput }>): Promise<ApiResponse<PdlPersonResult | null>> {
    try {
      return this.data(await PdlService.enrichPerson(this.c.env, req.body))
    }
    catch (err) {
      return this.error('PDL person enrich failed', (err as Error).message)
    }
  }

  async pdlSearchPeople(req: AppRequest<{ Body: PdlSearchPeopleInput }>): Promise<ApiResponse<{ tier: 'executives' | 'any_employee', results: Array<PdlPersonResult> }>> {
    if (!req.body.company && !req.body.companyDomain && !req.body.companyLinkedinUrl)
      return this.error('company, companyDomain or companyLinkedinUrl is required')
    try {
      return this.data(await PdlService.searchPeople(this.c.env, req.body))
    }
    catch (err) {
      return this.error('PDL people search failed', (err as Error).message)
    }
  }

  async pdlSearchByEmail(req: AppRequest<{ Body: { email?: string } }>): Promise<ApiResponse<PdlPersonResult | null>> {
    if (!req.body.email)
      return this.error('email is required')
    try {
      return this.data(await PdlService.searchByEmail(this.c.env, req.body.email))
    }
    catch (err) {
      return this.error('PDL email search failed', (err as Error).message)
    }
  }

  // ── Hunter.io ───────────────────────────────────────────────────────────────

  async hunterFindEmail(req: AppRequest<{ Body: { firstName?: string, lastName?: string, domain?: string } }>): Promise<ApiResponse<HunterEmailResult | null>> {
    const { firstName, lastName, domain } = req.body
    if (!firstName || !lastName || !domain)
      return this.error('firstName, lastName and domain are required')
    try {
      return this.data(await HunterService.findEmail(this.c.env, { firstName, lastName, domain }))
    }
    catch (err) {
      return this.error('Hunter email finder failed', (err as Error).message)
    }
  }

  async hunterDomainSearch(req: AppRequest<{ Body: { domain?: string, limit?: number, type?: 'personal' | 'generic' | 'all' } }>): Promise<ApiResponse<HunterDomainResult>> {
    if (!req.body.domain)
      return this.error('domain is required')
    try {
      return this.data(await HunterService.domainSearch(this.c.env, req.body.domain, req.body.limit ?? 10, req.body.type ?? 'personal'))
    }
    catch (err) {
      return this.error('Hunter domain search failed', (err as Error).message)
    }
  }

  // ── FullEnrich ──────────────────────────────────────────────────────────────

  async fullenrichEnrich(req: AppRequest<{ Body: FullenrichEnrichInput }>): Promise<ApiResponse<{ enrichmentId: string }>> {
    if (!req.body.firstName && !req.body.lastName && !req.body.linkedinUrl)
      return this.error('firstName+lastName or linkedinUrl is required')
    try {
      return this.data(await FullenrichService.submitEnrich(this.c.env, req.body))
    }
    catch (err) {
      return this.error('FullEnrich submit failed', (err as Error).message)
    }
  }

  async fullenrichEnrichResult(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<FullenrichPollResult>> {
    try {
      return this.data(await FullenrichService.getEnrichResult(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('FullEnrich poll failed', (err as Error).message)
    }
  }

  async fullenrichReverseEmail(req: AppRequest<{ Body: { email?: string } }>): Promise<ApiResponse<{ enrichmentId: string }>> {
    if (!req.body.email)
      return this.error('email is required')
    try {
      return this.data(await FullenrichService.submitReverseEmail(this.c.env, req.body.email))
    }
    catch (err) {
      return this.error('FullEnrich reverse email submit failed', (err as Error).message)
    }
  }

  async fullenrichReverseEmailResult(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<FullenrichPollResult>> {
    try {
      return this.data(await FullenrichService.getReverseEmailResult(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('FullEnrich reverse email poll failed', (err as Error).message)
    }
  }

  async fullenrichReverseEmailBatch(req: AppRequest<{ Body: { emails?: Array<string> } }>): Promise<ApiResponse<{ enrichmentId: string, count: number }>> {
    if (!Array.isArray(req.body.emails) || req.body.emails.length === 0)
      return this.error('emails array is required')
    try {
      return this.data(await FullenrichService.submitReverseEmailBatch(this.c.env, req.body.emails))
    }
    catch (err) {
      return this.error('FullEnrich reverse email batch submit failed', (err as Error).message)
    }
  }

  async fullenrichReverseEmailBatchResult(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<{ status: string, results: Array<{ email: string, result: FullenrichContactResult | null }> | null }>> {
    try {
      return this.data(await FullenrichService.getReverseEmailBatchResult(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('FullEnrich reverse email batch poll failed', (err as Error).message)
    }
  }

  async fullenrichSearchPeople(req: AppRequest<{ Body: { company?: string, domain?: string, city?: string, state?: string, limit?: number } }>): Promise<ApiResponse<Array<FullenrichContactResult>>> {
    if (!req.body.company && !req.body.domain)
      return this.error('company or domain is required')
    try {
      return this.data(await FullenrichService.searchPeople(this.c.env, req.body))
    }
    catch (err) {
      return this.error('FullEnrich people search failed', (err as Error).message)
    }
  }

  async fullenrichSearchCompany(req: AppRequest<{ Body: { name?: string, domain?: string, city?: string, state?: string } }>): Promise<ApiResponse<FullenrichCompanyResult | null>> {
    if (!req.body.name)
      return this.error('name is required')
    try {
      return this.data(await FullenrichService.searchCompany(this.c.env, { ...req.body, name: req.body.name }))
    }
    catch (err) {
      return this.error('FullEnrich company search failed', (err as Error).message)
    }
  }

  // ── Firecrawl ───────────────────────────────────────────────────────────────

  async firecrawlScrape(req: AppRequest<{ Body: { url?: string } }>): Promise<ApiResponse<FirecrawlResult>> {
    if (!req.body.url)
      return this.error('url is required')
    try {
      return this.data(await FirecrawlService.scrape(this.c.env, req.body.url))
    }
    catch (err) {
      return this.error('Firecrawl scrape failed', (err as Error).message)
    }
  }

  // ── Google Places ───────────────────────────────────────────────────────────

  async googlePlacesLookup(req: AppRequest<{ Query: { query?: string } }>): Promise<ApiResponse<GooglePlacesResult | null>> {
    if (!req.query.query)
      return this.error('query parameter is required')
    try {
      return this.data(await GooglePlacesService.lookup(this.c.env, req.query.query))
    }
    catch (err) {
      return this.error('Google Places lookup failed', (err as Error).message)
    }
  }

  // ── OpenRouter (LLM) ────────────────────────────────────────────────────────

  async openrouterSelectPages(req: AppRequest<{ Body: { baseUrl?: string, links?: Array<string>, maxPages?: number } }>): Promise<ApiResponse<Array<string>>> {
    if (!req.body.baseUrl || !Array.isArray(req.body.links))
      return this.error('baseUrl and links are required')
    try {
      return this.data(await OpenrouterService.selectPagesToScrape(this.c.env, { baseUrl: req.body.baseUrl, links: req.body.links, maxPages: req.body.maxPages }))
    }
    catch (err) {
      return this.error('OpenRouter page selection failed', (err as Error).message)
    }
  }

  async openrouterMapCsv(req: AppRequest<{ Body: { headers?: Array<string>, sampleRows?: Array<Record<string, string>> } }>): Promise<ApiResponse<Record<string, string | null>>> {
    if (!Array.isArray(req.body.headers) || req.body.headers.length === 0)
      return this.error('headers array is required')
    try {
      return this.data(await OpenrouterService.mapCsvHeaders(this.c.env, { headers: req.body.headers, sampleRows: req.body.sampleRows ?? [] }))
    }
    catch (err) {
      return this.error('OpenRouter CSV mapping failed', (err as Error).message)
    }
  }

  async openrouterExtract(req: AppRequest<{ Body: { markdown?: string, businessName?: string, businessContext?: string } }>): Promise<ApiResponse<ExtractSignalsResult>> {
    const { markdown, businessName, businessContext } = req.body
    if (!markdown || !businessName)
      return this.error('markdown and businessName are required')
    try {
      return this.data(await OpenrouterService.extractSignals(this.c.env, { markdown, businessName, businessContext }))
    }
    catch (err) {
      return this.error('OpenRouter extraction failed', (err as Error).message)
    }
  }

  // ── Smartlead (cold email sending) ──────────────────────────────────────────

  async smartleadCampaigns(): Promise<ApiResponse<Array<SmartleadCampaign>>> {
    try {
      return this.data(await SmartleadService.listCampaigns(this.c.env))
    }
    catch (err) {
      return this.error('Smartlead campaign list failed', (err as Error).message)
    }
  }

  async smartleadCampaign(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<SmartleadCampaign>> {
    try {
      return this.data(await SmartleadService.getCampaign(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Smartlead campaign lookup failed', (err as Error).message)
    }
  }

  async smartleadAnalytics(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<SmartleadAnalytics>> {
    try {
      return this.data(await SmartleadService.getCampaignAnalytics(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Smartlead analytics failed', (err as Error).message)
    }
  }

  async smartleadStatistics(req: AppRequest<{ Params: { id: string }, Query: { offset?: string, limit?: string, eventTimeGt?: string } }>): Promise<ApiResponse<{ total: number | null, stats: Array<SmartleadLeadStat>, raw: unknown }>> {
    try {
      return this.data(await SmartleadService.getCampaignStatistics(this.c.env, req.params.id, {
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        eventTimeGt: req.query.eventTimeGt,
      }))
    }
    catch (err) {
      return this.error('Smartlead statistics failed', (err as Error).message)
    }
  }

  async smartleadCampaignLeads(req: AppRequest<{ Params: { id: string }, Query: { offset?: string, limit?: string } }>): Promise<ApiResponse<{ total: number | null, leads: Array<SmartleadCampaignLead>, raw: unknown }>> {
    try {
      return this.data(await SmartleadService.listCampaignLeads(this.c.env, req.params.id, {
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }))
    }
    catch (err) {
      return this.error('Smartlead campaign leads failed', (err as Error).message)
    }
  }

  async smartleadAddLead(req: AppRequest<{ Params: { id: string }, Body: SmartleadPushLead }>): Promise<ApiResponse<SmartleadPushResult>> {
    if (!req.body.email)
      return this.error('email is required')
    try {
      return this.data(await SmartleadService.addLeadsToCampaign(this.c.env, req.params.id, [req.body]))
    }
    catch (err) {
      return this.error('Smartlead lead push failed', (err as Error).message)
    }
  }

  async smartleadEmailAccounts(): Promise<ApiResponse<Array<SmartleadEmailAccount>>> {
    try {
      return this.data(await SmartleadService.listEmailAccounts(this.c.env))
    }
    catch (err) {
      return this.error('Smartlead email account list failed', (err as Error).message)
    }
  }

  // ── Konci platform (internal leads API — staging) ───────────────────────────

  async konciRegister(req: AppRequest<{ Body: KonciRegisterInput }>): Promise<ApiResponse<KonciLeadResult>> {
    if (!req.body.businessName || !req.body.website)
      return this.error('businessName and website are required')
    try {
      return this.data(await KonciService.register(this.c.env, req.body))
    }
    catch (err) {
      return this.error('Konci register failed', (err as Error).message)
    }
  }

  async konciLead(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<KonciLeadResult>> {
    try {
      return this.data(await KonciService.getLead(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Konci lead lookup failed', (err as Error).message)
    }
  }

  async konciRetry(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<KonciLeadResult>> {
    try {
      return this.data(await KonciService.retry(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Konci retry failed', (err as Error).message)
    }
  }

  async konciClaimLink(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<KonciLeadResult>> {
    try {
      return this.data(await KonciService.mintClaimLink(this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Konci claim link failed', (err as Error).message)
    }
  }

}
