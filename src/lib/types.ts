export type Uuid = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type StatusId = 'wishlist' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected';
export type Priority = 'high' | 'med' | 'low';
export type CompanyId = string;
export type TeamId = 'me' | 'dana' | 'marc' | 'priya';
export type RemoteMode = 'Remote' | 'Hybrid' | 'Onsite';

export type Audited = {
  id: Uuid;
  ownerUserId: Uuid;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

export type Status = {
  id: StatusId;
  title: string;
  dot: string;
  color: string;
  desc: string;
};

export type Company = {
  id: CompanyId;
  name: string;
  bg: string;
  initial: string;
  ring?: boolean;
  dark?: boolean;
};

export type TeamMember = {
  id: TeamId;
  name: string;
  color: string;
  initial: string;
};

export type Contact = { name: string; role: string; email: string };

export type Application = Audited & {
  displayId: string;
  status: StatusId;
  company: CompanyId;
  role: string;
  location: string;
  remote: RemoteMode;
  salaryMin: number;
  salaryMax: number;
  equity?: string;
  level: string;
  team: string;
  posted: IsoDate;
  applied: IsoDate | null;
  lastActivity: IsoDateTime;
  priority: Priority;
  source: string;
  referral?: string;
  progress: number;
  tags: string[];
  description?: string;
  requirements?: string[];
  contacts?: Contact[];
  nextAction?: string;
  nextActionDue?: IsoDate;
  rejectedReason?: string;
  offer?: { base: number; bonus: number; equity: number; total: number };
  sourceListingId: Uuid | null;
  sortIndex: number;
  archivedAt: IsoDateTime | null;
};

export type Comment = { id: Uuid; who: TeamId; when: IsoDateTime; text: string };
export type HistoryEvent = {
  id: Uuid;
  type: 'created' | 'status' | 'field' | 'attach' | 'comment' | 'link' | 'document';
  when: IsoDateTime;
  who: TeamId;
  text: string;
};
export type ApplicationLink = { id: Uuid; type: string; title: string; meta: string };
export type Attachment = {
  id: Uuid;
  name: string;
  kind: 'pdf' | 'zip' | 'xls' | 'img' | 'ics';
  size: string;
  when: IsoDateTime;
};
export type Activity = {
  comments: Comment[];
  history: HistoryEvent[];
  links: ApplicationLink[];
  attachments: Attachment[];
};

export type Notification = {
  id: Uuid;
  title: string;
  meta: string;
  createdAt: IsoDateTime;
};

export type AtsResult = {
  required: string[];
  nice: string[];
  reqHit: number;
  niceHit: number;
  score: number;
  edits: string[];
  missingHard: string[];
  missingSoft: string[];
  rewrites: { from: string; to: string }[];
};

export type Resume = Audited & {
  name: string;
  flavor: string;
  file: string;
  size: string;
  pages: number;
  updated: IsoDateTime;
  isDefault: boolean;
  keywords: string[];
  summary: string;
  timesUsed: number;
};

export type CoverLetter = Audited & {
  name: string;
  flavor: string;
  file: string;
  size: string;
  updated: IsoDateTime;
  isDefault: boolean;
  timesUsed: number;
};

export type AppDocs = {
  applicationId: Uuid;
  resumeId: Uuid;
  coverLetterId: Uuid | null;
  ats: AtsResult;
};

export const DEMO_USER_ID: Uuid = '00000000-0000-0000-0000-000000000001';
