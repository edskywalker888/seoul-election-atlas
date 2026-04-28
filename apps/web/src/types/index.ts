// TypeScript interfaces mirroring /schemas/*.schema.json.
// Keep in sync with the JSON Schema files — those are the source of truth.

export type ElectionScope = "seoul" | string;
export type ElectionType = "national_assembly" | string;

export interface Election {
  election_id: string;
  name_en: string;
  name_ko: string;
  date: string;
  scope: ElectionScope;
  type: ElectionType;
  source_ids: string[];
}

export interface District {
  district_id: string;
  name_ko: string;
  name_en: string;
  city: string;
  normalized_slug: string;
}

export type PartyFamily =
  | "liberal"
  | "conservative"
  | "progressive"
  | "centrist"
  | "minor"
  | "independent";

export interface Party {
  party_id: string;
  display_name_en: string;
  display_name_ko: string;
  family: PartyFamily;
  colors: { default: string } & Record<string, string>;
}

export interface CandidateResult {
  name: string;
  party_id: string;
  votes: number;
  vote_pct: number;
}

export interface DistrictResult {
  election_id: string;
  district_id: string;
  winner_party_id: string;
  winner_candidate: string;
  turnout_pct: number;
  candidates: CandidateResult[];
}

export interface IssueEntry {
  tag: string;
  label: string;
  weight: number;
  description?: string;
}

export interface ElectionIssues {
  election_id: string;
  summary: string;
  issues: IssueEntry[];
  confidence: number;
  source_ids: string[];
}

export interface DistrictIssues {
  election_id: string;
  district_id: string;
  summary: string;
  issues: IssueEntry[];
  confidence: number;
  source_ids: string[];
}

export type SourceTier = 1 | 2 | 3;
export type CredibilityWeight = "high" | "medium" | "low";

export interface SourceMetadata {
  source_id: string;
  tier: SourceTier;
  title: string;
  url: string;
  retrieved_at: string;
  credibility_weight?: CredibilityWeight;
  known_bias?: string;
  captured_to?: string;
  used_in?: string[];
  notes?: string;
}

export interface BoundaryMetadata {
  election_id: string;
  feature_count: number;
  simplification_tolerance?: number;
  source: string;
  retrieved_at: string;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
}

export interface ArticleDataPoint {
  label: string;
  value: string;
  date?: string;
  source_id: string;
}

export type MarketSource = "polymarket" | "kalshi";

export interface MarketCandidate {
  name: string;
  name_ko?: string;
  party_id?: string;
  market_id?: string;
  prob: number;
  yes_bid?: number;
  yes_ask?: number;
  last_price?: number;
  volume_usd?: number;
}

export interface MarketSnapshot {
  captured_at: string;
  source: MarketSource;
  event_id: string;
  event_slug?: string;
  event_url: string;
  event_title: string;
  end_date: string;
  total_volume_usd?: number;
  total_liquidity_usd?: number;
  candidates: MarketCandidate[];
  method_notes?: string;
}

export interface MarketHistoryPoint {
  t: string;
  p: number;
}

export interface MarketCandidateHistory {
  name: string;
  name_ko?: string;
  party_id?: string;
  market_id?: string;
  series: MarketHistoryPoint[];
}

export interface MarketHistory {
  source: MarketSource;
  event_id: string;
  event_slug?: string;
  captured_at: string;
  interval?: string;
  candidates: MarketCandidateHistory[];
}

export type PollMethod =
  | "manual_curation"
  | "wiki_aggregation"
  | "nesdc_scrape"
  | "manual_demo";

export interface PollPoint {
  t: string;
  /** Candidate's support share, 0–1 (e.g., 0.55 = 55% of polled voters say they support this candidate) */
  p: number;
  n_polls?: number;
  sources?: string[];
}

export interface PollCandidate {
  name: string;
  name_ko?: string;
  party_id?: string;
  series: PollPoint[];
}

export interface PollAggregate {
  event_slug: string;
  captured_at: string;
  method: PollMethod;
  method_notes?: string;
  interval?: string;
  candidates: PollCandidate[];
}

export type SalienceSentiment = "positive" | "negative" | "neutral" | "mixed";
export type SalienceMethod =
  | "llm_synthesis"
  | "rule_based"
  | "manual_demo"
  | "bigkinds"
  | "datalab";

export interface SalienceEvidenceHeadline {
  title: string;
  outlet?: string;
  url?: string;
}

export interface SalienceTopic {
  rank: number;
  topic_en: string;
  topic_ko: string;
  summary: string;
  sentiment?: SalienceSentiment;
  sentiment_score?: number;
  salience: number;
  issue_tag?: string;
  evidence_headlines?: SalienceEvidenceHeadline[];
}

export interface SalienceSnapshot {
  captured_at: string;
  method: SalienceMethod;
  model?: string;
  source_urls?: string[];
  topics: SalienceTopic[];
  method_notes?: string;
}

export type UpcomingElectionType =
  | "local"
  | "national_assembly"
  | "presidential"
  | "by_election";

export interface UpcomingElection {
  id: string;
  type: UpcomingElectionType;
  name_en: string;
  name_ko: string;
  date: string;
  scope: string;
  estimated?: boolean;
  notes?: string;
}

export interface DriverArticle {
  election_id: string;
  tag: string;
  title: string;
  subtitle?: string;
  thesis: string;
  sections: ArticleSection[];
  key_data_points: ArticleDataPoint[];
  confidence: number;
  source_ids: string[];
  last_updated: string;
}
