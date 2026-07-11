import type { ICampaign, ICampaignDetail } from '~/app/types'

export const dummyCampaigns: Array<ICampaign> = [
  {
    id: 'cmp_001',
    name: 'Dental — Austin',
    description: 'Dentists in the Austin metro, video for top-scored leads',
    status: 'ACTIVE',
    maxSendsPerHour: 20,
    maxSendsPerDay: 100,
    stats: { leads: 42, sent: 31, delivered: 29, opened: 14, clicked: 6, replied: 2 },
    createdBy: 'shaun@hackhouse.io',
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
  },
  {
    id: 'cmp_002',
    name: 'Restaurants — Austin',
    description: 'Independent restaurants, missed-call pain angle',
    status: 'PAUSED',
    maxSendsPerHour: 10,
    maxSendsPerDay: 50,
    stats: { leads: 68, sent: 45, delivered: 41, opened: 18, clicked: 4, replied: 1 },
    createdBy: 'shaun@hackhouse.io',
    createdAt: '2026-06-24T09:00:00Z',
    updatedAt: '2026-07-08T09:00:00Z',
  },
  {
    id: 'cmp_003',
    name: 'Home services — TX',
    description: 'Plumbers / HVAC / roofers statewide',
    status: 'COMPLETED',
    maxSendsPerHour: 15,
    maxSendsPerDay: 75,
    stats: { leads: 120, sent: 120, delivered: 112, opened: 51, clicked: 19, replied: 7 },
    createdBy: 'patrick@hackhouse.io',
    createdAt: '2026-06-10T09:00:00Z',
    updatedAt: '2026-06-30T09:00:00Z',
  },
]

export const dummyCampaignDetails: Record<string, ICampaignDetail> = {
  cmp_001: {
    ...dummyCampaigns[0]!,
    steps: [
      { id: 'stp_001', campaignId: 'cmp_001', order: 0, templateId: 'tpl_001', templateName: 'Dental intro + video', delayDays: 0 },
      { id: 'stp_002', campaignId: 'cmp_001', order: 1, templateId: 'tpl_002', templateName: 'Follow-up: did you try the demo?', delayDays: 3 },
      { id: 'stp_003', campaignId: 'cmp_001', order: 2, templateId: 'tpl_003', templateName: 'Break-up email', delayDays: 7 },
    ],
    leads: [
      { id: 'cl_001', campaignId: 'cmp_001', leadId: 'lead_001', leadName: 'Lonestar Dental Care', leadStatus: 'ENGAGED', contactEmail: 'sarah@lonestardentalcare.com', status: 'SENT', currentStep: 1, nextSendAt: '2026-07-11T09:15:00Z', withVideo: true },
      { id: 'cl_002', campaignId: 'cmp_001', leadId: 'lead_009', leadName: 'Riverside Chiropractic', leadStatus: 'IN_CAMPAIGN', contactEmail: 'info@riversidechiropractic.com', status: 'SCHEDULED', currentStep: 0, nextSendAt: '2026-07-11T14:00:00Z', withVideo: true },
      { id: 'cl_003', campaignId: 'cmp_001', leadId: 'lead_017', leadName: 'Precision Eye Center', leadStatus: 'IN_CAMPAIGN', contactEmail: 'info@precisioneyecenter.com', status: 'PENDING', currentStep: 0, nextSendAt: null, withVideo: false },
    ],
  },
}
