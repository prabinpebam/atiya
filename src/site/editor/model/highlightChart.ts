/**
 * The GitHub chart's data for Add slide's preview (documentation/home-views/highlights.md §2.1): the snapshot with the
 * totals the chart shows, as the home draws it. Apart from the screen's model, so the screen's script never carries
 * the snapshot's schema.
 */
import { contributionStats, type GitHubSnapshot } from '../../content/github';
import type { ContributionData } from '../../scripts/contributionRules';

/** The GitHub snapshot with the totals its chart shows. */
export const chartData = (snapshot: GitHubSnapshot): ContributionData => ({ ...snapshot, stats: contributionStats(snapshot) });
