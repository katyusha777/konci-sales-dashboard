import type { TLeadStatus } from './lead'

export type TCampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
export type TCampaignLeadStatus
  = | 'PENDING' | 'SCHEDULED' | 'SENT' | 'COMPLETED' | 'REPLIED'
    | 'FAILED' | 'CANCELLED' | 'SUPPRESSED'

export interface ICampaignStep {
  id: string
  campaignId: string
  order: number
  templateId: string
  templateName: string
  delayDays: number
}

export interface ICampaignStats {
  leads: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
}

export interface ICampaign {
  id: string
  name: string
  description: string | null
  status: TCampaignStatus
  maxSendsPerHour: number
  maxSendsPerDay: number
  stats: ICampaignStats
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ICampaignLead {
  id: string
  campaignId: string
  leadId: string
  leadName: string
  leadStatus: TLeadStatus
  contactEmail: string | null
  status: TCampaignLeadStatus
  currentStep: number
  nextSendAt: string | null
  withVideo: boolean
}

export interface ICampaignDetail extends ICampaign {
  steps: Array<ICampaignStep>
  leads: Array<ICampaignLead>
}
