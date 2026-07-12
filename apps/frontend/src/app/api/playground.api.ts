import type {
  IApolloLiveInput,
  IApolloLiveOrg,
  IApolloLiveResult,
  IEmailLiveConfig,
  IEmailLiveResult,
  IFirecrawlLiveResult,
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
  IOpenrouterLiveExtract,
  IPdlLiveCompany,
  IPdlLiveCompanyInput,
  IPdlLivePerson,
  IPdlLivePersonInput,
  IPdlLiveSearchPeople,
  IPdlLiveSearchPeopleInput,
  IScrapioLiveParams,
  IScrapioLiveSearch,
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

  // Email
  static emailConfig(): Promise<IEmailLiveConfig> {
    return $api('/api/playground/email/config')
  }

  static emailSend(input: { to: string, subject: string, html: string }): Promise<IEmailLiveResult> {
    return $api('/api/playground/email/send', { method: 'POST', body: input })
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

  // OpenRouter (LLM)
  static openrouterSelectPages(input: { baseUrl: string, links: Array<string>, maxPages?: number }): Promise<Array<string>> {
    return $api('/api/playground/openrouter/select-pages', { method: 'POST', body: input })
  }

  static openrouterExtract(input: { markdown: string, businessName: string, businessContext?: string }): Promise<IOpenrouterLiveExtract> {
    return $api('/api/playground/openrouter/extract', { method: 'POST', body: input })
  }
}
