import type { IHeygenTemplate, ITemplate } from '~/app/types'

export const dummyTemplates: Array<ITemplate> = [
  {
    id: 'tpl_001',
    name: 'Dental intro + video',
    subject: '{{contact_first_name}}, we built an AI receptionist for {{business_name}}',
    body: `<p>Hi {{contact_first_name}},</p>
<p>We set up an AI phone operator for {{business_name}} — it answers like your front desk, books appointments, and never puts a patient on hold.</p>
{{#if industry}}<p>We've helped plenty of other {{industry}} businesses stop missing calls.</p>{{/if}}
<p><a href="{{video_url}}">Watch the 45-second demo we made for you</a></p>
<p>Or try it live: call <b>{{demo_phone}}</b> and enter PIN <b>{{demo_pin}}</b>.</p>
<p>— The Konci team</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
    videoScript: 'Hey {{business_name}}! Imagine every call answered instantly — even during a busy {{industry}} day in {{city}}. We already built your AI receptionist. Call the number in this email and hear it yourself.',
    videoScenes: null,
    avatarId: 'av_001',
    heygenTemplateId: null,
    createdAt: '2026-06-28T09:00:00Z',
    updatedAt: '2026-07-05T09:00:00Z',
  },
  {
    id: 'tpl_002',
    name: 'Follow-up: did you try the demo?',
    subject: 'Did you get a chance to call your AI receptionist, {{contact_first_name}}?',
    body: `<p>Hi {{contact_first_name}},</p>
<p>Just floating this back up — your demo line for {{business_name}} is still live: <b>{{demo_phone}}</b>, PIN <b>{{demo_pin}}</b>.</p>
<p>Takes 60 seconds to hear how it handles your callers.</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
    videoScript: null,
    videoScenes: null,
    avatarId: null,
    heygenTemplateId: null,
    createdAt: '2026-06-28T09:10:00Z',
    updatedAt: '2026-06-28T09:10:00Z',
  },
  {
    id: 'tpl_003',
    name: 'Break-up email',
    subject: 'Closing the loop on {{business_name}}',
    body: `<p>Hi {{contact_first_name}},</p>
<p>I'll stop reaching out — but if missed calls ever become a priority for {{business_name}}, the demo line stays live for another week.</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
    videoScript: null,
    videoScenes: null,
    avatarId: null,
    heygenTemplateId: null,
    createdAt: '2026-06-28T09:20:00Z',
    updatedAt: '2026-06-28T09:20:00Z',
  },
  {
    id: 'tpl_004',
    name: 'Shaun pitch (HeyGen template)',
    subject: '{{contact_first_name}}, call this number',
    body: `<p>Hey {{business_name}},</p>
<p>We'd love for you to try something we put together for you — it's incredible.</p>
<p><a href="{{video_url}}">Watch Shaun explain it in 30 seconds</a>, then call <b>{{demo_phone}}</b> (PIN <b>{{demo_pin}}</b>).</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
    videoScript: null,
    videoScenes: [
      'Hey {{contact_first_name}}, this is Shaun from Konci AI. We\'ve built something for {{business_name}} that you may really, really like. It\'s an intelligent phone system.',
      'We\'ve attached a toll-free number you can call directly from this email.',
      'Give it a ring, ask it anything a customer would — it already knows your business.',
      'Talk soon!',
    ],
    avatarId: null,
    heygenTemplateId: 'hgt_shaun_pitch',
    createdAt: '2026-07-02T09:00:00Z',
    updatedAt: '2026-07-08T09:00:00Z',
  },
]

// HeyGen studio templates (synced from HeyGen in the real backend) — each has a
// fixed number of scenes; every scene is one template variable we fill with text.
export const dummyHeygenTemplates: Array<IHeygenTemplate> = [
  { id: 'hgt_shaun_pitch', name: 'Shaun — Konci AI Sales Pitch', sceneCount: 4 },
  { id: 'hgt_maya_intro', name: 'Maya — Quick Intro', sceneCount: 2 },
]

export const TEMPLATE_PLACEHOLDERS = [
  'business_name',
  'contact_first_name',
  'industry',
  'city',
  'video_url',
  'demo_phone',
  'demo_pin',
  'unsubscribe_url',
] as const
