export interface RepoAttributes {
  stars: number;
  new_stars: number;
  pushes: number;
  contributors: number;
  issues_closed: number;
  forks: number;
}

export interface RepoCardData {
  name: string;
  owner: string;
  stars_total: number;
  description: string | null;
  language: string | null;
  topics: string[];
  license: string | null;
  homepage: string | null;
  forks_count: number;
  open_issues_count: number;
  created_at: string | null;
  archived: boolean;
  size: number;
  rank: number;
  total_repos: number;
  attributes: RepoAttributes;
  /** Ever fork: raw counts for the card's "Weekly" row (attributes are percentiles). */
  weekly?: RepoWeekly;
  /** Ever fork: raw contributor count (attributes.contributors is a 0-100 radar value). */
  contributors_count?: number;
  /** Ever fork: "benchmark" = attributes are absolute 0-100 scores, not percentiles. */
  attributes_scale?: "percentile" | "benchmark";
  /** Ever fork: the raw 8-week totals behind the activity axes of the radar. */
  window_8w?: RepoWeekly;
}

/** Ever fork: last-7-days counts, written by ever/seed-gh-data.mjs. */
export interface RepoWeekly {
  new_stars: number;
  pushes: number;
  issues_closed: number;
}
