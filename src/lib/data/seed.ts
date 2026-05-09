import { computeAts } from '@/lib/utils/ats';
import { daysAgo, isoDaysAgo } from '@/lib/utils/dates';
import type {
  Activity,
  AppDocs,
  Application,
  Attachment,
  Company,
  Comment,
  CoverLetter,
  HistoryEvent,
  Notification,
  Resume,
  Status,
  StatusId,
  TeamMember,
  Uuid,
} from '@/lib/types';
import { DEMO_USER_ID } from '@/lib/types';

export const STATUSES: Status[] = [
  {
    id: 'wishlist',
    title: 'Wishlist',
    dot: '#6B6B7A',
    color: '#6B6B7A',
    desc: 'Roles to consider',
  },
  {
    id: 'applied',
    title: 'Applied',
    dot: '#FFA726',
    color: '#FFA726',
    desc: 'Application submitted',
  },
  {
    id: 'screen',
    title: 'Phone Screen',
    dot: '#5AB7FF',
    color: '#5AB7FF',
    desc: 'Recruiter conversation',
  },
  {
    id: 'interview',
    title: 'Interviewing',
    dot: '#C9A84C',
    color: '#C9A84C',
    desc: 'Onsite and loops',
  },
  { id: 'offer', title: 'Offer', dot: '#4CAF50', color: '#4CAF50', desc: 'Offer in hand' },
  { id: 'rejected', title: 'Rejected', dot: '#EF5350', color: '#EF5350', desc: 'Closed out' },
];

export const COMPANIES: Record<string, Company> = {
  stripe: { id: 'stripe', name: 'Stripe', bg: '#635BFF', initial: 'S' },
  airbnb: { id: 'airbnb', name: 'Airbnb', bg: '#FF5A5F', initial: 'A' },
  figma: { id: 'figma', name: 'Figma', bg: '#0ACF83', initial: 'F' },
  linear: { id: 'linear', name: 'Linear', bg: '#5E6AD2', initial: 'L' },
  vercel: { id: 'vercel', name: 'Vercel', bg: '#0A0A0B', initial: 'V', ring: true },
  notion: { id: 'notion', name: 'Notion', bg: '#1F1F1F', initial: 'N', ring: true },
  shopify: { id: 'shopify', name: 'Shopify', bg: '#5E8E3E', initial: 'S' },
  datadog: { id: 'datadog', name: 'Datadog', bg: '#7C3AED', initial: 'D' },
  anthropic: { id: 'anthropic', name: 'Anthropic', bg: '#D97757', initial: 'A' },
  ramp: { id: 'ramp', name: 'Ramp', bg: '#F1B844', initial: 'R', dark: true },
  cursor: { id: 'cursor', name: 'Cursor', bg: '#0E0E0E', initial: 'C', ring: true },
  mercury: { id: 'mercury', name: 'Mercury', bg: '#22C55E', initial: 'M' },
  openai: { id: 'openai', name: 'OpenAI', bg: '#10A37F', initial: 'O' },
  databricks: { id: 'databricks', name: 'Databricks', bg: '#FF3621', initial: 'D' },
};

export const TEAM: Record<string, TeamMember> = {
  me: { id: 'me', name: 'You', color: '#C9A84C', initial: 'Y' },
  dana: { id: 'dana', name: 'Dana K.', color: '#5AB7FF', initial: 'D' },
  marc: { id: 'marc', name: 'Marc S.', color: '#FF8FA3', initial: 'M' },
  priya: { id: 'priya', name: 'Priya R.', color: '#0ACF83', initial: 'P' },
};

const displayOrder = [
  'JT-42',
  'JT-41',
  'JT-40',
  'JT-39',
  'JT-38',
  'JT-37',
  'JT-36',
  'JT-35',
  'JT-34',
  'JT-33',
  'JT-32',
  'JT-31',
  'JT-30',
  'JT-29',
];

export function seedUuid(label: string): Uuid {
  const index = displayOrder.includes(label) ? displayOrder.indexOf(label) + 10 : hashLabel(label);
  return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function hashLabel(label: string): number {
  return Array.from(label).reduce((total, char) => total + char.charCodeAt(0), 1000);
}

function audited(displayId: string, days: number) {
  return {
    id: seedUuid(displayId),
    ownerUserId: DEMO_USER_ID,
    createdAt: isoDaysAgo(days),
    updatedAt: isoDaysAgo(days),
    deletedAt: null,
  };
}

type RawApp = Omit<
  Application,
  | 'id'
  | 'ownerUserId'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | 'sourceListingId'
  | 'sortIndex'
  | 'archivedAt'
>;

const RAW_APPLICATIONS: RawApp[] = [
  {
    displayId: 'JT-42',
    status: 'wishlist',
    company: 'anthropic',
    role: 'Senior Software Engineer, Product',
    location: 'San Francisco, CA - Hybrid',
    remote: 'Hybrid',
    salaryMin: 240,
    salaryMax: 320,
    equity: '0.05-0.15%',
    level: 'L5',
    team: 'Claude Code',
    posted: daysAgo(2),
    applied: null,
    lastActivity: isoDaysAgo(2),
    priority: 'high',
    source: 'Referral - Dana K.',
    referral: 'Dana K.',
    progress: 5,
    tags: ['AI', 'Referral'],
    description:
      'Build product surfaces for Claude: agentic coding, computer use, and the web app.',
    requirements: ['5+ yrs full-stack', 'End-to-end feature ownership', 'Curiosity about LLMs'],
    contacts: [{ name: 'Dana K.', role: 'Engineering Manager - referrer', email: 'dana@ext' }],
    nextAction: 'Reach out to Dana for warm intro this week',
    nextActionDue: daysAgo(-3),
  },
  {
    displayId: 'JT-41',
    status: 'wishlist',
    company: 'figma',
    role: 'Staff Engineer, Editor Platform',
    location: 'New York, NY - Hybrid',
    remote: 'Hybrid',
    salaryMin: 280,
    salaryMax: 360,
    equity: '0.10-0.20%',
    level: 'Staff',
    team: 'Editor Foundations',
    posted: daysAgo(4),
    applied: null,
    lastActivity: isoDaysAgo(1),
    priority: 'med',
    source: 'LinkedIn',
    progress: 5,
    tags: ['Frontend'],
    description: 'Own editor canvas architecture across performance, collaboration, and rendering.',
    requirements: ['8+ yrs systems-leaning frontend', 'WebGL, Canvas, or CRDT background'],
    nextAction: 'Tailor resume for Editor Platform',
    nextActionDue: daysAgo(-2),
  },
  {
    displayId: 'JT-40',
    status: 'wishlist',
    company: 'cursor',
    role: 'Software Engineer, Agents',
    location: 'San Francisco, CA - Onsite',
    remote: 'Onsite',
    salaryMin: 220,
    salaryMax: 300,
    equity: '0.10-0.25%',
    level: 'Mid-Senior',
    team: 'Agents',
    posted: daysAgo(1),
    applied: null,
    lastActivity: isoDaysAgo(1),
    priority: 'med',
    source: 'Hacker News',
    progress: 5,
    tags: ['AI', 'Onsite'],
    description: 'Make coding agents do longer, harder work autonomously.',
    nextAction: 'Apply by Friday',
    nextActionDue: daysAgo(-4),
  },
  {
    displayId: 'JT-39',
    status: 'applied',
    company: 'stripe',
    role: 'Senior Software Engineer, Payments API',
    location: 'Remote (US)',
    remote: 'Remote',
    salaryMin: 220,
    salaryMax: 290,
    equity: 'Public',
    level: 'L4',
    team: 'Payments API',
    posted: daysAgo(12),
    applied: daysAgo(8),
    lastActivity: isoDaysAgo(8),
    priority: 'high',
    source: 'Stripe careers',
    progress: 20,
    tags: ['Backend', 'Distsys'],
    description: 'Design and ship the next generation of Payments APIs.',
    nextAction: 'Wait - recruiter screen typically within 7 days',
    nextActionDue: daysAgo(-1),
  },
  {
    displayId: 'JT-38',
    status: 'applied',
    company: 'vercel',
    role: 'Software Engineer, Edge Runtime',
    location: 'Remote (Global)',
    remote: 'Remote',
    salaryMin: 180,
    salaryMax: 240,
    equity: '0.02-0.08%',
    level: 'Mid-Senior',
    team: 'Edge Runtime',
    posted: daysAgo(15),
    applied: daysAgo(11),
    lastActivity: isoDaysAgo(11),
    priority: 'med',
    source: 'LinkedIn',
    progress: 20,
    tags: ['Backend', 'Edge'],
    description: 'Push the boundary of what runs at the edge.',
    nextAction: 'Follow up if no reply by 2026-05-15',
  },
  {
    displayId: 'JT-37',
    status: 'applied',
    company: 'linear',
    role: 'Software Engineer, Sync',
    location: 'Remote (Americas + EU)',
    remote: 'Remote',
    salaryMin: 195,
    salaryMax: 265,
    equity: '0.05-0.12%',
    level: 'Senior',
    team: 'Sync Engine',
    posted: daysAgo(20),
    applied: daysAgo(14),
    lastActivity: isoDaysAgo(10),
    priority: 'med',
    source: 'Linear blog',
    progress: 20,
    tags: ['Frontend', 'Sync'],
  },
  {
    displayId: 'JT-36',
    status: 'screen',
    company: 'airbnb',
    role: 'Senior Software Engineer, Trust',
    location: 'San Francisco, CA - Hybrid',
    remote: 'Hybrid',
    salaryMin: 230,
    salaryMax: 305,
    equity: 'Public',
    level: 'L5',
    team: 'Trust & Safety Platform',
    posted: daysAgo(28),
    applied: daysAgo(22),
    lastActivity: isoDaysAgo(2),
    priority: 'high',
    source: 'Recruiter outreach',
    progress: 40,
    tags: ['Backend'],
    description: 'Detect and prevent abuse end-to-end.',
    nextAction: 'Recruiter screen - Mon 2026-05-12, 11:00 PT',
    nextActionDue: daysAgo(-4),
  },
  {
    displayId: 'JT-35',
    status: 'screen',
    company: 'datadog',
    role: 'Senior Backend Engineer',
    location: 'New York, NY - Hybrid',
    remote: 'Hybrid',
    salaryMin: 215,
    salaryMax: 285,
    equity: 'Public',
    level: 'Senior',
    team: 'APM',
    posted: daysAgo(31),
    applied: daysAgo(24),
    lastActivity: isoDaysAgo(5),
    priority: 'med',
    source: 'LinkedIn',
    progress: 40,
    tags: ['Backend', 'Observability'],
    nextAction: 'Phone screen scheduled Wed 2026-05-14, 14:00 ET',
    nextActionDue: daysAgo(-6),
  },
  {
    displayId: 'JT-34',
    status: 'interview',
    company: 'ramp',
    role: 'Staff Software Engineer, Spend',
    location: 'New York, NY - Hybrid',
    remote: 'Hybrid',
    salaryMin: 270,
    salaryMax: 360,
    equity: '0.08-0.18%',
    level: 'Staff',
    team: 'Spend Management',
    posted: daysAgo(45),
    applied: daysAgo(38),
    lastActivity: isoDaysAgo(1),
    priority: 'high',
    source: 'Referral - Marc S.',
    referral: 'Marc S.',
    progress: 70,
    tags: ['Backend', 'Fintech', 'Referral'],
    description: "Lead the architecture for Ramp's spend management primitives.",
    nextAction: 'Onsite loop - Thu 2026-05-15, 09:30 ET',
    nextActionDue: daysAgo(-7),
  },
  {
    displayId: 'JT-33',
    status: 'interview',
    company: 'shopify',
    role: 'Senior Software Engineer, Checkout',
    location: 'Remote (Canada/US)',
    remote: 'Remote',
    salaryMin: 220,
    salaryMax: 295,
    equity: 'Public',
    level: 'L6',
    team: 'Checkout',
    posted: daysAgo(52),
    applied: daysAgo(45),
    lastActivity: isoDaysAgo(4),
    priority: 'high',
    source: 'Recruiter outreach',
    progress: 70,
    tags: ['Frontend', 'Performance'],
    nextAction: 'Tech screen #2 - Fri 2026-05-09, 10:00 PT',
    nextActionDue: daysAgo(-1),
  },
  {
    displayId: 'JT-32',
    status: 'interview',
    company: 'mercury',
    role: 'Senior Software Engineer, Ledger',
    location: 'Remote (US)',
    remote: 'Remote',
    salaryMin: 210,
    salaryMax: 275,
    equity: '0.05-0.12%',
    level: 'Senior',
    team: 'Ledger Platform',
    posted: daysAgo(60),
    applied: daysAgo(50),
    lastActivity: isoDaysAgo(7),
    priority: 'med',
    source: 'LinkedIn',
    progress: 70,
    tags: ['Backend', 'Fintech'],
    nextAction: 'System design - Mon 2026-05-12, 13:00 PT',
    nextActionDue: daysAgo(-4),
  },
  {
    displayId: 'JT-31',
    status: 'offer',
    company: 'notion',
    role: 'Senior Software Engineer, AI',
    location: 'San Francisco, CA - Hybrid',
    remote: 'Hybrid',
    salaryMin: 245,
    salaryMax: 245,
    equity: '0.07%',
    level: 'L5',
    team: 'AI',
    posted: daysAgo(75),
    applied: daysAgo(60),
    lastActivity: isoDaysAgo(0),
    priority: 'high',
    source: 'Referral - Priya R.',
    referral: 'Priya R.',
    progress: 95,
    tags: ['AI', 'Referral'],
    description: 'Build Notion AI features that hundreds of millions of users actually want.',
    offer: { base: 245, bonus: 30, equity: 240, total: 515 },
    nextAction: 'Decision deadline - Mon 2026-05-19',
    nextActionDue: daysAgo(-11),
  },
  {
    displayId: 'JT-30',
    status: 'rejected',
    company: 'openai',
    role: 'Software Engineer, Applied',
    location: 'San Francisco, CA - Onsite',
    remote: 'Onsite',
    salaryMin: 250,
    salaryMax: 350,
    equity: 'PPUs',
    level: 'L4',
    team: 'Applied',
    posted: daysAgo(70),
    applied: daysAgo(58),
    lastActivity: isoDaysAgo(18),
    priority: 'low',
    source: 'Cold apply',
    progress: 100,
    tags: ['AI'],
    rejectedReason: 'No reply after 30+ days; auto-closed',
  },
  {
    displayId: 'JT-29',
    status: 'rejected',
    company: 'databricks',
    role: 'Senior Software Engineer, Lakehouse',
    location: 'Remote (US)',
    remote: 'Remote',
    salaryMin: 215,
    salaryMax: 285,
    level: 'Senior',
    team: 'Lakehouse',
    posted: daysAgo(85),
    applied: daysAgo(72),
    lastActivity: isoDaysAgo(40),
    priority: 'low',
    source: 'LinkedIn',
    progress: 100,
    tags: ['Data'],
    rejectedReason: 'Failed onsite - system design round',
  },
];

export const APPLICATIONS: Application[] = RAW_APPLICATIONS.map((app, index) => ({
  ...audited(app.displayId, Math.max(0, index + 1)),
  ...app,
  id: seedUuid(app.displayId),
  sourceListingId: null,
  sortIndex: index,
  archivedAt: null,
}));

export const displayIdToUuid = Object.fromEntries(
  APPLICATIONS.map((application) => [application.displayId, application.id]),
) as Record<string, Uuid>;

function itemUuid(label: string, index: number): Uuid {
  return `00000000-0000-0000-0001-${String(hashLabel(label) + index).padStart(12, '0')}`;
}

function comments(displayId: string, values: Omit<Comment, 'id'>[]): Comment[] {
  return values.map((comment, index) => ({
    ...comment,
    id: itemUuid(`${displayId}-comment`, index),
  }));
}

function history(displayId: string, values: Omit<HistoryEvent, 'id'>[]): HistoryEvent[] {
  return values.map((event, index) => ({ ...event, id: itemUuid(`${displayId}-history`, index) }));
}

function attachments(displayId: string, values: Omit<Attachment, 'id'>[]): Attachment[] {
  return values.map((attachment, index) => ({
    ...attachment,
    id: itemUuid(`${displayId}-attachment`, index),
  }));
}

export const ACTIVITY: Record<Uuid, Activity> = Object.fromEntries(
  APPLICATIONS.map((application) => [
    application.id,
    {
      comments: [],
      history: history(application.displayId, [
        { type: 'created', when: application.createdAt, who: 'me', text: 'Card created' },
      ]),
      links: [],
      attachments: [],
    },
  ]),
) as Record<Uuid, Activity>;

ACTIVITY[displayIdToUuid['JT-39'] ?? ''] = {
  comments: comments('JT-39', [
    {
      who: 'me',
      when: isoDaysAgo(8),
      text: 'Application submitted via Stripe careers. Resume tailored to Payments API ownership.',
    },
    {
      who: 'me',
      when: isoDaysAgo(5),
      text: 'Cross-checked with Levels.fyi. Will pad ask 5% if it gets to numbers.',
    },
  ]),
  history: history('JT-39', [
    {
      type: 'created',
      when: isoDaysAgo(12),
      who: 'me',
      text: 'Card created from Stripe careers job listing',
    },
    { type: 'field', when: isoDaysAgo(10), who: 'me', text: 'Set Priority to High' },
    { type: 'status', when: isoDaysAgo(8), who: 'me', text: 'Status changed Wishlist to Applied' },
    {
      type: 'attach',
      when: isoDaysAgo(8),
      who: 'me',
      text: 'Added attachment Resume_Stripe_v3.pdf',
    },
  ]),
  links: [
    {
      id: itemUuid('JT-39-link', 1),
      type: 'JD',
      title: 'Job description - Stripe careers',
      meta: 'stripe.com/jobs/4921',
    },
    {
      id: itemUuid('JT-39-link', 2),
      type: 'NOTE',
      title: 'Prep notes - Payments API',
      meta: '6 sections',
    },
  ],
  attachments: attachments('JT-39', [
    { name: 'Resume_Stripe_v3.pdf', kind: 'pdf', size: '184 KB', when: isoDaysAgo(8) },
    { name: 'CoverLetter.pdf', kind: 'pdf', size: '54 KB', when: isoDaysAgo(8) },
    { name: 'JD_snapshot.pdf', kind: 'pdf', size: '92 KB', when: isoDaysAgo(12) },
  ]),
};

ACTIVITY[displayIdToUuid['JT-34'] ?? ''] = {
  comments: comments('JT-34', [
    {
      who: 'me',
      when: isoDaysAgo(12),
      text: 'Recruiter screen went well. Marc referral was the unlock.',
    },
    {
      who: 'marc',
      when: isoDaysAgo(10),
      text: 'Ping me before the panel. Happy to walk you through the team.',
    },
    {
      who: 'me',
      when: isoDaysAgo(2),
      text: 'Did the take-home. API design plus small backfill. Confident.',
    },
  ]),
  history: history('JT-34', [
    { type: 'created', when: isoDaysAgo(45), who: 'me', text: 'Card created' },
    { type: 'status', when: isoDaysAgo(38), who: 'me', text: 'Wishlist to Applied' },
    { type: 'status', when: isoDaysAgo(30), who: 'me', text: 'Applied to Phone Screen' },
    { type: 'status', when: isoDaysAgo(12), who: 'me', text: 'Phone Screen to Interviewing' },
    {
      type: 'field',
      when: isoDaysAgo(8),
      who: 'me',
      text: 'Salary range updated 250-340 to 270-360',
    },
  ]),
  links: [
    {
      id: itemUuid('JT-34-link', 1),
      type: 'JD',
      title: 'JD - Staff SWE, Spend Management',
      meta: 'ramp.com/careers/staff-spend',
    },
    {
      id: itemUuid('JT-34-link', 2),
      type: 'NOTE',
      title: 'Prep - Ramp system design',
      meta: '11 sections',
    },
    {
      id: itemUuid('JT-34-link', 3),
      type: 'JT-39',
      title: 'Stripe - Senior SWE, Payments API',
      meta: 'same domain',
    },
  ],
  attachments: attachments('JT-34', [
    { name: 'Resume_Ramp_v2.pdf', kind: 'pdf', size: '188 KB', when: isoDaysAgo(38) },
    { name: 'Ramp_TakeHome_solution.zip', kind: 'zip', size: '2.1 MB', when: isoDaysAgo(2) },
    { name: 'Onsite_schedule.ics', kind: 'ics', size: '6 KB', when: isoDaysAgo(1) },
  ]),
};

ACTIVITY[displayIdToUuid['JT-31'] ?? ''] = {
  comments: comments('JT-31', [
    {
      who: 'priya',
      when: isoDaysAgo(35),
      text: 'They liked your panel. EM mentioned the AI taste was the differentiator.',
    },
    { who: 'me', when: isoDaysAgo(2), text: 'Got the verbal. Need to negotiate equity refresh.' },
    { who: 'me', when: isoDaysAgo(0), text: 'Written offer landed. Reviewing fully today.' },
  ]),
  history: history('JT-31', [
    { type: 'created', when: isoDaysAgo(75), who: 'me', text: 'Card created' },
    { type: 'status', when: isoDaysAgo(60), who: 'me', text: 'Wishlist to Applied' },
    { type: 'status', when: isoDaysAgo(45), who: 'me', text: 'Applied to Phone Screen' },
    { type: 'status', when: isoDaysAgo(28), who: 'me', text: 'Phone Screen to Interviewing' },
    { type: 'status', when: isoDaysAgo(2), who: 'me', text: 'Interviewing to Offer' },
  ]),
  links: [
    {
      id: itemUuid('JT-31-link', 1),
      type: 'NOTE',
      title: 'Negotiation playbook',
      meta: 'updated 1h ago',
    },
  ],
  attachments: attachments('JT-31', [
    { name: 'Notion_Offer_Letter.pdf', kind: 'pdf', size: '142 KB', when: isoDaysAgo(0) },
    { name: 'Notion_Equity_Sheet.xlsx', kind: 'xls', size: '38 KB', when: isoDaysAgo(2) },
  ]),
};

export const RESUMES: Resume[] = [
  {
    ...audited('resume-distsys', 11),
    name: 'Resume - Distributed Systems / Backend',
    flavor: 'Backend and infra-leaning roles.',
    file: 'Resume_DistSys_v4.pdf',
    size: '186 KB',
    pages: 2,
    updated: isoDaysAgo(11),
    isDefault: true,
    keywords: [
      'Go',
      'Rust',
      'Distributed systems',
      'Kafka',
      'PostgreSQL',
      'gRPC',
      'Observability',
      'High-throughput',
      'On-call',
    ],
    summary: 'Senior backend engineer focused on high-throughput data pipelines.',
    timesUsed: 7,
  },
  {
    ...audited('resume-frontend', 28),
    name: 'Resume - Frontend / Product Engineering',
    flavor: 'Frontend-leaning product roles.',
    file: 'Resume_Frontend_v3.pdf',
    size: '172 KB',
    pages: 2,
    updated: isoDaysAgo(28),
    isDefault: false,
    keywords: [
      'TypeScript',
      'React',
      'Next.js',
      'Performance',
      'Design systems',
      'Accessibility',
      'UX',
    ],
    summary: 'Product-leaning senior engineer who ships polished frontend at scale.',
    timesUsed: 3,
  },
  {
    ...audited('resume-ai', 4),
    name: 'Resume - AI / ML Platform',
    flavor: 'Targets AI infra and applied ML platform roles.',
    file: 'Resume_AI_v2.pdf',
    size: '178 KB',
    pages: 2,
    updated: isoDaysAgo(4),
    isDefault: false,
    keywords: [
      'Python',
      'PyTorch',
      'LLM',
      'Inference',
      'RAG',
      'Distributed systems',
      'Latency',
      'Evals',
    ],
    summary: 'Systems chops for production-grade AI infrastructure.',
    timesUsed: 2,
  },
  {
    ...audited('resume-staff', 45),
    name: 'Resume - Staff Engineer',
    flavor: 'One-pager for staff applications.',
    file: 'Resume_Staff_1pg.pdf',
    size: '124 KB',
    pages: 1,
    updated: isoDaysAgo(45),
    isDefault: false,
    keywords: ['Staff', 'Architecture', 'Cross-team', 'Mentoring', 'Technical leadership', 'RFC'],
    summary: 'Compact narrative for staff-level roles.',
    timesUsed: 1,
  },
];

export const COVER_LETTERS: CoverLetter[] = [
  {
    ...audited('cl-generic', 40),
    name: 'Cover letter - Generic SWE',
    flavor: 'Default narrative.',
    file: 'CoverLetter_Generic_v2.pdf',
    size: '46 KB',
    updated: isoDaysAgo(40),
    isDefault: true,
    timesUsed: 5,
  },
  {
    ...audited('cl-ai', 9),
    name: 'Cover letter - AI / Frontier labs',
    flavor: 'For Anthropic / OpenAI / Perplexity-style applications.',
    file: 'CoverLetter_AI_v3.pdf',
    size: '52 KB',
    updated: isoDaysAgo(9),
    isDefault: false,
    timesUsed: 3,
  },
  {
    ...audited('cl-fintech', 22),
    name: 'Cover letter - Fintech',
    flavor: 'Stripe / Ramp / Mercury-flavored.',
    file: 'CoverLetter_Fintech_v1.pdf',
    size: '48 KB',
    updated: isoDaysAgo(22),
    isDefault: false,
    timesUsed: 2,
  },
];

const resumeByName = Object.fromEntries(RESUMES.map((resume) => [resume.file, resume]));
const coverByName = Object.fromEntries(
  COVER_LETTERS.map((coverLetter) => [coverLetter.file, coverLetter]),
);

export const APP_DOCS: Record<Uuid, AppDocs> = {
  [displayIdToUuid['JT-39'] ?? '']: {
    applicationId: displayIdToUuid['JT-39'] ?? '',
    resumeId: resumeByName['Resume_DistSys_v4.pdf']?.id ?? '',
    coverLetterId: coverByName['CoverLetter_Fintech_v1.pdf']?.id ?? null,
    ats: computeAts({
      resumeKeywords: resumeByName['Resume_DistSys_v4.pdf']?.keywords ?? [],
      required: [
        'Go',
        'PostgreSQL',
        'API design',
        'Distributed systems',
        'High-throughput',
        'Idempotency',
        'On-call',
      ],
      nice: ['Kafka', 'gRPC', 'Payments', 'Observability'],
      edits: [
        'Add a bullet about idempotency keys.',
        'Use the phrase API design in the Datadog role.',
      ],
      rewrites: [
        { from: 'Owned interface for v2 of Charges', to: 'Owned API design for v2 of Charges' },
      ],
    }),
  },
  [displayIdToUuid['JT-34'] ?? '']: {
    applicationId: displayIdToUuid['JT-34'] ?? '',
    resumeId: resumeByName['Resume_Staff_1pg.pdf']?.id ?? '',
    coverLetterId: coverByName['CoverLetter_Generic_v2.pdf']?.id ?? null,
    ats: computeAts({
      resumeKeywords: resumeByName['Resume_Staff_1pg.pdf']?.keywords ?? [],
      required: [
        'Staff',
        'Architecture',
        'Cross-team',
        'Mentoring',
        'Roadmapping',
        'Scope',
        'Technical leadership',
      ],
      nice: ['RFC', 'Hiring', 'Strategy'],
      edits: ['Add Roadmapping and Scope language.', 'Move the QCon talk higher.'],
    }),
  },
};

export const NOTIFICATIONS: Notification[] = [
  {
    id: seedUuid('n1'),
    title: 'Notion: written offer received',
    meta: 'JT-31 - 2 hours ago',
    createdAt: isoDaysAgo(0),
  },
  {
    id: seedUuid('n2'),
    title: 'Shopify scheduled tech screen #2',
    meta: 'JT-33 - Fri 10:00 PT',
    createdAt: isoDaysAgo(0),
  },
  {
    id: seedUuid('n3'),
    title: 'Marc S. commented on Ramp loop',
    meta: 'JT-34 - Yesterday',
    createdAt: isoDaysAgo(1),
  },
  {
    id: seedUuid('n4'),
    title: 'Stripe application moved to under review',
    meta: 'JT-39 - 2 days ago',
    createdAt: isoDaysAgo(2),
  },
  {
    id: seedUuid('n5'),
    title: 'New job match: Anthropic',
    meta: 'Daily picks - 2 days ago',
    createdAt: isoDaysAgo(2),
  },
];

export type SortMode = 'manual' | 'lastActivity' | 'priority' | 'dateApplied';

export function seedAll(): {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
  resumes: Resume[];
  coverLetters: CoverLetter[];
  notifications: Notification[];
  statusSortMode: Record<StatusId, SortMode>;
} {
  return {
    applications: structuredClone(APPLICATIONS),
    activity: structuredClone(ACTIVITY),
    appDocs: structuredClone(APP_DOCS),
    resumes: structuredClone(RESUMES),
    coverLetters: structuredClone(COVER_LETTERS),
    notifications: structuredClone(NOTIFICATIONS),
    statusSortMode: {
      wishlist: 'lastActivity',
      applied: 'lastActivity',
      screen: 'lastActivity',
      interview: 'lastActivity',
      offer: 'lastActivity',
      rejected: 'lastActivity',
    },
  };
}
