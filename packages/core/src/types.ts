/** Where a saved link comes from. */
export type Platform =
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'reddit'
  | 'threads'
  | 'pinterest'
  | 'spotify'
  | 'web';

/** The shape of the content behind a link. */
export type ContentKind = 'reel' | 'video' | 'short' | 'post' | 'thread' | 'article' | 'audio' | 'image' | 'doc' | 'page';

export const CATEGORIES = [
  'AI',
  'Food',
  'Travel',
  'Tech',
  'Career',
  'Finance',
  'Fitness',
  'Learning',
  'Shopping',
  'Entertainment',
  'Home',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ENTITY_TYPES = [
  'place',
  'product',
  'tool',
  'person',
  'book',
  'price',
  'step',
  'ingredient',
  'date',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** A named thing found inside the content: a café, a product, a step. */
export interface Entity {
  type: EntityType;
  name: string;
  detail?: string;
}

/** Where inside the content a link was found. */
export type LinkSource = 'caption' | 'description' | 'audio' | 'screen' | 'page';

export interface ExtractedLink {
  url: string;
  label?: string;
  source: LinkSource;
}

/** Which engine produced the analysis. Shown to the user so AI output is always labelled. */
export type AnalysisEngine = 'rules' | 'ai-text' | 'ai-video';

export type SaveStatus = 'queued' | 'processing' | 'ready' | 'failed';

export type SaveChannel = 'app' | 'share' | 'whatsapp' | 'web' | 'import';

/** The user's own triage state for a save. */
export type Progress = 'inbox' | 'todo' | 'done';

/** What we know about a link before analysis (from yt-dlp, oEmbed or Open Graph). */
export interface LinkMetadata {
  url: string;
  platform: Platform;
  kind: ContentKind;
  title?: string;
  description?: string;
  author?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  publishedAt?: string;
  siteName?: string;
}

/** The structured result of analysing one link. */
export interface Analysis {
  title: string;
  summary: string;
  keyPoints: string[];
  category: Category;
  tags: string[];
  entities: Entity[];
  links: ExtractedLink[];
  language?: string;
  transcriptExcerpt?: string;
  engine: AnalysisEngine;
  model?: string;
  confidence: number;
}

export interface BoardPosition {
  x: number;
  y: number;
}

/** One saved link, as stored and shown in the app. */
export interface SaveItem {
  id: string;
  /** Human-friendly running number, e.g. #129, used by the WhatsApp bot and the table view. */
  seq: number;
  url: string;
  platform: Platform;
  kind: ContentKind;
  status: SaveStatus;
  error?: string;
  channel: SaveChannel;
  meta: LinkMetadata;
  analysis?: Analysis;
  note?: string;
  pinned?: boolean;
  progress?: Progress;
  /** User-made collections this save belongs to. */
  collections?: string[];
  /** When the content was first shared, if earlier than the save (e.g. imported from an old WhatsApp chat). */
  sharedAt?: string;
  lastOpenedAt?: string;
  board?: BoardPosition;
  createdAt: string;
  updatedAt: string;
}
