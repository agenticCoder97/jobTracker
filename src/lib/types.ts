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
  domain?: string;
  logoUrl?: string;
  ring?: boolean;
  dark?: boolean;
};

export type CompanyDetail = {
  id: CompanyId;
  industry: string;
  hq: string;
  size: string;
  founded: number;
  rating: number;
  ceoApproval: number;
  recommendFriend: number;
  openRoles: number;
  interviewDifficulty: number;
  medianComp: number;
  fundingStage: string;
  tags: string[];
};

export type JobListing = {
  id: Uuid;
  displayId: string;
  company: CompanyId;
  role: string;
  location: string;
  remote: RemoteMode;
  salaryMin: number;
  salaryMax: number;
  posted: IsoDate;
  match: number;
  tags: string[];
  saved: boolean;
};

export type DailyPick = {
  id: Uuid;
  company: CompanyId;
  role: string;
  location: string;
  salary: string;
  match: number;
  why: string[];
  posted: string;
  applicants: string;
};

export type ProfileLink = { label: string; url: string; icon: string };
export type SearchPrefs = {
  roles: string[];
  remote: string[];
  minComp: number;
  industries: string[];
  avoid: string[];
  notice: string;
};
export type Experience = {
  id: string;
  company: CompanyId;
  role: string;
  from: string;
  to: string;
  dur: string;
  location: string;
  bullets: string[];
};
export type Education = {
  id: string;
  school: string;
  degree: string;
  from: string;
  to: string;
  detail: string;
};
export type SkillLevel = 1 | 2 | 3 | 4 | 5;
export type Skill = { name: string; level: SkillLevel; years: number; endorsements: number };
export type LanguageLevel = 'Native' | 'Conversational' | 'Beginner';
export type Language = { name: string; level: LanguageLevel };
export type Cert = { name: string; issuer: string; when: string };
export type ProfileCompletenessSection = { id: string; label: string; done: boolean };
export type Profile = Audited & {
  name: string;
  handle: string;
  email: string;
  phone: string;
  location: string;
  pronouns: string;
  headline: string;
  about: string;
  links: ProfileLink[];
  openToWork: boolean;
  preferences: SearchPrefs;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  certifications: Cert[];
  achievements: string[];
  completeness: { sections: ProfileCompletenessSection[] };
};

export type MarketSalary = { lvl: string; comp: number; hi: boolean };
export type MarketSkill = { name: string; weight: number; delta: string; down?: boolean };
export type LinkedInPerson = {
  id: string;
  name: string;
  title: string;
  mutual?: string;
  color: string;
};
export type LinkedInInMail = LinkedInPerson & { preview: string; when: string };
export type LinkedInEvent = { id: string; month: string; day: string; title: string; meta: string };
export type CompanyWatch = { company: CompanyId; name: string; meta: string; count: number };

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
