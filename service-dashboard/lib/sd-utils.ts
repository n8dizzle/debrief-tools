/**
 * Utility functions for the Service Dashboard.
 */

/**
 * Format a Date as YYYY-MM-DD in local (Central) time.
 * NEVER use toISOString() — it converts to UTC and shifts dates.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in local time.
 */
export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Compute percentile-rank scores and weighted overall score.
 *
 * For each KPI, rank all technicians. The score for rank r out of N is:
 *   kpi_score = (N - r + 1) / N
 * This gives 1.0 for first place and approaches 0 for last.
 *
 * The overall score is the weighted sum of KPI scores.
 */
export function computeLeaderboardScores(
  techData: Array<{
    technician_id: string;
    st_technician_id: number;
    name: string;
    trade: 'hvac' | 'plumbing';
    gross_sales: number;
    tgls: number;
    options_per_opportunity: number;
    reviews: number;
    memberships_sold: number;
    attendance_points: number;
  }>,
  weights: Record<string, number>
): Array<{
  technician_id: string;
  st_technician_id: number;
  name: string;
  trade: 'hvac' | 'plumbing';
  gross_sales: number;
  tgls: number;
  options_per_opportunity: number;
  reviews: number;
  memberships_sold: number;
  attendance_points: number;
  score: number;
  rank: number;
  score_breakdown: {
    gross_sales_score: number;
    tgls_score: number;
    options_per_opportunity_score: number;
    reviews_score: number;
    memberships_score: number;
    attendance_score: number;
  };
}> {
  const N = techData.length;
  if (N === 0) return [];

  const w = {
    gross_sales: weights.gross_sales ?? 0.25,
    tgls: weights.tgls ?? 0.15,
    options_per_opportunity: weights.options_per_opportunity ?? 0.15,
    memberships_sold: weights.memberships_sold ?? 0.15,
    reviews: weights.reviews ?? 0.15,
    attendance: weights.attendance ?? 0.15,
  };

  // Rank helper: sort descending, assign rank (1-based), ties get same rank
  type RankableKey = 'gross_sales' | 'tgls' | 'options_per_opportunity' | 'reviews' | 'memberships_sold' | 'attendance_points';
  function rankBy(arr: typeof techData, key: RankableKey, ascending = false): Map<string, number> {
    const sorted = [...arr].sort((a, b) => ascending ? a[key] - b[key] : b[key] - a[key]);
    const rankMap = new Map<string, number>();
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][key] !== sorted[i - 1][key]) {
        currentRank = i + 1;
      }
      rankMap.set(sorted[i].technician_id, currentRank);
    }
    return rankMap;
  }

  const salesRanks = rankBy(techData, 'gross_sales');
  const tglRanks = rankBy(techData, 'tgls');
  const optsRanks = rankBy(techData, 'options_per_opportunity');
  const reviewRanks = rankBy(techData, 'reviews');
  const membershipRanks = rankBy(techData, 'memberships_sold');
  // Attendance: ascending — fewest points = rank #1 (best)
  const attendanceRanks = rankBy(techData, 'attendance_points', true);

  function percentileScore(rank: number): number {
    return (N - rank + 1) / N;
  }

  const scored = techData.map(tech => {
    const gsScore = percentileScore(salesRanks.get(tech.technician_id)!);
    const tglScore = percentileScore(tglRanks.get(tech.technician_id)!);
    const optsScore = percentileScore(optsRanks.get(tech.technician_id)!);
    const revScore = percentileScore(reviewRanks.get(tech.technician_id)!);
    const memScore = percentileScore(membershipRanks.get(tech.technician_id)!);
    const attScore = percentileScore(attendanceRanks.get(tech.technician_id)!);

    const overall =
      gsScore * w.gross_sales +
      tglScore * w.tgls +
      optsScore * w.options_per_opportunity +
      revScore * w.reviews +
      memScore * w.memberships_sold +
      attScore * w.attendance;

    return {
      ...tech,
      score: Math.round(overall * 1000) / 1000,
      rank: 0, // will be assigned below
      score_breakdown: {
        gross_sales_score: Math.round(gsScore * 1000) / 1000,
        tgls_score: Math.round(tglScore * 1000) / 1000,
        options_per_opportunity_score: Math.round(optsScore * 1000) / 1000,
        reviews_score: Math.round(revScore * 1000) / 1000,
        memberships_score: Math.round(memScore * 1000) / 1000,
        attendance_score: Math.round(attScore * 1000) / 1000,
      },
    };
  });

  // Sort by overall score descending, assign final ranks
  scored.sort((a, b) => b.score - a.score);
  let currentRank = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].score < scored[i - 1].score) {
      currentRank = i + 1;
    }
    scored[i].rank = currentRank;
  }

  return scored;
}

/**
 * Default scoring weights.
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  gross_sales: 0.25,
  tgls: 0.15,
  options_per_opportunity: 0.15,
  memberships_sold: 0.15,
  reviews: 0.15,
  attendance: 0.15,
};
