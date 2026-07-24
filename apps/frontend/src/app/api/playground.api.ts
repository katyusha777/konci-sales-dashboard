import type {
  IApolloLiveInput,
  IApolloLiveOrg,
  IApolloLiveResult,
  IFirecrawlLiveResult,
  IFullenrichLiveBatchPoll,
  IFullenrichLiveCompany,
  IFullenrichLiveContact,
  IFullenrichLiveEnrichInput,
  IFullenrichLivePoll,
  IGooglePlacesLiveResult,
  IHeygenLiveAvatar,
  IHeygenLiveAvatarGroup,
  IHeygenLiveTemplate,
  IHeygenLiveVariable,
  IHeygenLiveVideoStatus,
  IHeygenLiveVoice,
  IHunterLiveDomainSearch,
  IHunterLiveEmail,
  IKonciLiveResult,
  IOpenrouterLiveExtract,
  IPdlLiveCompany,
  IPdlLiveCompanyInput,
  IPdlLivePerson,
  IPdlLivePersonInput,
  IPdlLiveSearchPeople,
  IPdlLiveSearchPeopleInput,
  IScrapioLiveParams,
  IScrapioLiveSearch,
  ISmartleadLiveAnalytics,
  ISmartleadLiveCampaign,
  ISmartleadLiveCampaignLeads,
  ISmartleadLiveEmailAccount,
  ISmartleadLivePushLead,
  ISmartleadLivePushResult,
  ISmartleadLiveStatistics,
} from '~/app/types'
import { $api } from './client'

// LIVE (not dummy) — hits the real Worker services. Requires `pnpm dev:api`.
export abstract class PlaygroundApi {
  // Scrap.io
  static scrapioSearch(params: IScrapioLiveParams): Promise<IScrapioLiveSearch> {
    return $api('/api/playground/scrapio/search', { method: 'POST', body: params })
  }

  // HeyGen
  static heygenAvatars(includeStock = false): Promise<Array<IHeygenLiveAvatar>> {
    return $api('/api/playground/heygen/avatars', { query: { includeStock: String(includeStock) } })
  }

  static heygenAvatarGroups(includePublic = false): Promise<Array<IHeygenLiveAvatarGroup>> {
    return $api('/api/playground/heygen/avatar-groups', { query: { includePublic: String(includePublic) } })
  }

  static heygenVoices(): Promise<Array<IHeygenLiveVoice>> {
    return $api('/api/playground/heygen/voices')
  }

  static heygenTemplates(): Promise<Array<IHeygenLiveTemplate>> {
    return $api('/api/playground/heygen/templates')
  }

  static heygenTemplateVariables(id: string): Promise<Record<string, IHeygenLiveVariable>> {
    return $api(`/api/playground/heygen/templates/${id}`)
  }

  static heygenGenerate(input: { avatarId: string, characterType?: 'avatar' | 'talking_photo', voiceId: string, script: string }): Promise<{ videoId: string }> {
    return $api('/api/playground/heygen/generate', { method: 'POST', body: input })
  }

  static heygenGenerateFromTemplate(input: { templateId: string, variables: Record<string, string> }): Promise<{ videoId: string }> {
    return $api('/api/playground/heygen/generate-from-template', { method: 'POST', body: input })
  }

  static heygenVideoStatus(videoId: string): Promise<IHeygenLiveVideoStatus> {
    return $api(`/api/playground/heygen/videos/${videoId}/status`)
  }

  // Apollo
  static apolloMatch(input: IApolloLiveInput): Promise<IApolloLiveResult | null> {
    return $api('/api/playground/apollo/match', { method: 'POST', body: input })
  }

  static apolloOrganization(domain: string): Promise<IApolloLiveOrg | null> {
    return $api('/api/playground/apollo/organization', { method: 'POST', body: { domain } })
  }

  // PDL
  static pdlCompany(input: IPdlLiveCompanyInput): Promise<IPdlLiveCompany | null> {
    return $api('/api/playground/pdl/company', { method: 'POST', body: input })
  }

  static pdlPerson(input: IPdlLivePersonInput): Promise<IPdlLivePerson | null> {
    return $api('/api/playground/pdl/person', { method: 'POST', body: input })
  }

  static pdlSearchPeople(input: IPdlLiveSearchPeopleInput): Promise<IPdlLiveSearchPeople> {
    return $api('/api/playground/pdl/search-people', { method: 'POST', body: input })
  }

  static pdlSearchByEmail(email: string): Promise<IPdlLivePerson | null> {
    return $api('/api/playground/pdl/search-by-email', { method: 'POST', body: { email } })
  }

  // Hunter.io
  static hunterFindEmail(input: { firstName: string, lastName: string, domain: string }): Promise<IHunterLiveEmail | null> {
    return $api('/api/playground/hunter/find-email', { method: 'POST', body: input })
  }

  static hunterDomainSearch(input: { domain: string, limit?: number, type?: 'personal' | 'generic' | 'all' }): Promise<IHunterLiveDomainSearch> {
    return $api('/api/playground/hunter/domain-search', { method: 'POST', body: input })
  }

  // FullEnrich
  static fullenrichEnrich(input: IFullenrichLiveEnrichInput): Promise<{ enrichmentId: string }> {
    return $api('/api/playground/fullenrich/enrich', { method: 'POST', body: input })
  }

  static fullenrichEnrichResult(enrichmentId: string): Promise<IFullenrichLivePoll> {
    return $api(`/api/playground/fullenrich/enrich/${enrichmentId}`)
  }

  static fullenrichReverseEmail(email: string): Promise<{ enrichmentId: string }> {
    return $api('/api/playground/fullenrich/reverse-email', { method: 'POST', body: { email } })
  }

  static fullenrichReverseEmailResult(enrichmentId: string): Promise<IFullenrichLivePoll> {
    return $api(`/api/playground/fullenrich/reverse-email/${enrichmentId}`)
  }

  static fullenrichReverseEmailBatch(emails: Array<string>): Promise<{ enrichmentId: string, count: number }> {
    return $api('/api/playground/fullenrich/reverse-email-batch', { method: 'POST', body: { emails } })
  }

  static fullenrichReverseEmailBatchResult(enrichmentId: string): Promise<IFullenrichLiveBatchPoll> {
    return $api(`/api/playground/fullenrich/reverse-email-batch/${enrichmentId}`)
  }

  static fullenrichSearchPeople(input: { company?: string, domain?: string, city?: string, state?: string, limit?: number }): Promise<Array<IFullenrichLiveContact>> {
    return $api('/api/playground/fullenrich/search-people', { method: 'POST', body: input })
  }

  static fullenrichSearchCompany(input: { name: string, domain?: string, city?: string, state?: string }): Promise<IFullenrichLiveCompany | null> {
    return $api('/api/playground/fullenrich/search-company', { method: 'POST', body: input })
  }

  // Firecrawl
  static firecrawlScrape(url: string): Promise<IFirecrawlLiveResult> {
    return $api('/api/playground/firecrawl/scrape', { method: 'POST', body: { url } })
  }

  // Google Places
  static googlePlacesLookup(query: string): Promise<IGooglePlacesLiveResult | null> {
    return $api('/api/playground/google-places/lookup', { query: { query } })
  }

  // Konci platform (internal leads API — staging)
  static konciRegister(input: { businessName: string, website: string, contactName?: string, socialMedia?: string, teamSize?: string }): Promise<IKonciLiveResult> {
    return $api('/api/playground/konci/register', { method: 'POST', body: input })
  }

  static konciLead(id: string): Promise<IKonciLiveResult> {
    return $api(`/api/playground/konci/leads/${id}`)
  }

  static konciRetry(id: string): Promise<IKonciLiveResult> {
    return $api(`/api/playground/konci/leads/${id}/retry`, { method: 'POST' })
  }

  static konciClaimLink(id: string): Promise<IKonciLiveResult> {
    return $api(`/api/playground/konci/leads/${id}/claim-link`, { method: 'POST' })
  }

  // Smartlead (cold email sending)
  static smartleadCampaigns(): Promise<Array<ISmartleadLiveCampaign>> {
    return $api('/api/playground/smartlead/campaigns')
  }

  static smartleadCampaign(id: number): Promise<ISmartleadLiveCampaign> {
    return $api(`/api/playground/smartlead/campaigns/${id}`)
  }

  static smartleadAnalytics(id: number): Promise<ISmartleadLiveAnalytics> {
    return $api(`/api/playground/smartlead/campaigns/${id}/analytics`)
  }

  static smartleadStatistics(id: number, opts?: { offset?: number, limit?: number, eventTimeGt?: string }): Promise<ISmartleadLiveStatistics> {
    return $api(`/api/playground/smartlead/campaigns/${id}/statistics`, { query: opts })
  }

  static smartleadCampaignLeads(id: number, opts?: { offset?: number, limit?: number }): Promise<ISmartleadLiveCampaignLeads> {
    return $api(`/api/playground/smartlead/campaigns/${id}/leads`, { query: opts })
  }

  static smartleadAddLead(id: number, lead: ISmartleadLivePushLead): Promise<ISmartleadLivePushResult> {
    return $api(`/api/playground/smartlead/campaigns/${id}/leads`, { method: 'POST', body: lead })
  }

  static smartleadEmailAccounts(): Promise<Array<ISmartleadLiveEmailAccount>> {
    return $api('/api/playground/smartlead/email-accounts')
  }

  // OpenRouter (LLM)
  static openrouterSelectPages(input: { baseUrl: string, links: Array<string>, maxPages?: number }): Promise<Array<string>> {
    return $api('/api/playground/openrouter/select-pages', { method: 'POST', body: input })
  }

  static openrouterExtract(input: { markdown: string, businessName: string, businessContext?: string }): Promise<IOpenrouterLiveExtract> {
    return $api('/api/playground/openrouter/extract', { method: 'POST', body: input })
  }

  static openrouterMapCsv(input: { headers: Array<string>, sampleRows: Array<Record<string, string>> }): Promise<Record<string, string | null>> {
    return $api('/api/playground/openrouter/map-csv', { method: 'POST', body: input })
  }
}
