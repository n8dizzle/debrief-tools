import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface LeaderboardEntry {
  name: string;
  mention_count: number;
  five_star_count: number;
  avg_rating: number;
  recent_review?: string;
}

/**
 * GET /api/reviews/leaderboard
 * Get team member leaderboard based on review mentions
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const periodStart = searchParams.get('periodStart');
  const periodEnd = searchParams.get('periodEnd');

  const supabase = getServerSupabase();

  // Get team members from database
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('name, aliases')
    .eq('is_active', true);

  // Build date filter
  let dateFilter = '';
  if (periodStart && periodEnd) {
    dateFilter = `create_time >= '${periodStart}' AND create_time <= '${periodEnd}'`;
  } else {
    dateFilter = `create_time >= '${year}-01-01' AND create_time <= '${year}-12-31'`;
  }

  // If we have team members in the database, use team_members_mentioned
  if (teamMembers && teamMembers.length > 0) {
    const { data: reviews } = await supabase
      .from('google_reviews')
      .select('team_members_mentioned, star_rating, comment')
      .not('team_members_mentioned', 'is', null);

    // Aggregate by team member
    const leaderboard: Record<string, LeaderboardEntry> = {};

    reviews?.forEach((review) => {
      const mentions = review.team_members_mentioned as string[];
      if (!mentions || mentions.length === 0) return;

      mentions.forEach((name) => {
        if (!leaderboard[name]) {
          leaderboard[name] = {
            name,
            mention_count: 0,
            five_star_count: 0,
            avg_rating: 0,
            recent_review: undefined,
          };
        }

        leaderboard[name].mention_count++;
        if (review.star_rating === 5) {
          leaderboard[name].five_star_count++;
        }
        if (!leaderboard[name].recent_review && review.comment) {
          leaderboard[name].recent_review = review.comment;
        }
      });
    });

    // Calculate avg rating
    Object.values(leaderboard).forEach((entry) => {
      entry.avg_rating = entry.mention_count > 0
        ? Math.round((entry.five_star_count / entry.mention_count) * 5 * 100) / 100
        : 0;
    });

    const sorted = Object.values(leaderboard).sort((a, b) => b.mention_count - a.mention_count);

    return NextResponse.json({ leaderboard: sorted, source: 'team_members' });
  }

  // Fallback: scan comments directly for common first names
  // This is a heuristic approach when team_members table is empty
  const { data: reviews } = await supabase
    .from('google_reviews')
    .select('comment, star_rating, create_time')
    .not('comment', 'is', null)
    .order('create_time', { ascending: false });

  if (!reviews) {
    return NextResponse.json({ leaderboard: [], source: 'scan' });
  }

  // Common patterns for name mentions in reviews
  // Looking for patterns like "Name was", "Name is", "Name did", "tech Name", "Thanks Name"
  const namePattern = /\b([A-Z][a-z]{2,15})\b(?:\s+(?:was|is|did|came|helped|fixed|arrived|showed|made|provided|explained|took|went|gave|has|had|worked|serviced|installed|checked|cleaned|replaced|diagnosed|repaired|recommended)|\s+(?:is|was)\s+(?:great|awesome|amazing|excellent|wonderful|fantastic|professional|friendly|knowledgeable|helpful|courteous|efficient|thorough|prompt|quick|fast))/gi;

  const thankPattern = /(?:thank(?:s|ed)?|shout\s*out\s*to|kudos\s*to|appreciate)\s+([A-Z][a-z]{2,15})\b/gi;

  const techPattern = /(?:tech(?:nician)?|service\s*tech|hvac\s*tech|plumber|specialist)\s+([A-Z][a-z]{2,15})\b/gi;

  // Common non-name words to exclude
  const excludeWords = new Set([
    'christmas', 'air', 'conditioning', 'plumbing', 'heating', 'cooling',
    'service', 'company', 'business', 'team', 'staff', 'office', 'system',
    'unit', 'thermostat', 'furnace', 'heater', 'conditioner', 'duct', 'vent',
    'the', 'they', 'their', 'this', 'that', 'these', 'those', 'very', 'much',
    'highly', 'would', 'will', 'great', 'good', 'best', 'same', 'next', 'last',
    'first', 'new', 'old', 'hot', 'cold', 'warm', 'cool', 'nice', 'kind',
    'home', 'house', 'work', 'job', 'day', 'time', 'year', 'week', 'month',
    'issue', 'problem', 'repair', 'fix', 'install', 'replace', 'check',
    'texas', 'fort', 'worth', 'dallas', 'denton', 'flower', 'mound', 'argyle',
    'justin', 'prosper', 'lewisville', 'thanks', 'thank', 'called', 'needed'
  ]);

  const nameCounts: Record<string, { count: number; fiveStars: number; reviews: string[] }> = {};

  reviews.forEach((review) => {
    const comment = review.comment || '';
    const allMatches: string[] = [];

    // Extract names from different patterns
    let match;

    const patterns = [namePattern, thankPattern, techPattern];
    patterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(comment)) !== null) {
        const name = match[1];
        if (name && !excludeWords.has(name.toLowerCase())) {
          allMatches.push(name);
        }
      }
    });

    // Also look for standalone capitalized names followed by common praise
    const standalonePraise = /\b([A-Z][a-z]{2,15})\s+(?:rocks|rules|is\s+the\s+best|saved|went\s+above)/gi;
    standalonePraise.lastIndex = 0;
    while ((match = standalonePraise.exec(comment)) !== null) {
      const name = match[1];
      if (name && !excludeWords.has(name.toLowerCase())) {
        allMatches.push(name);
      }
    }

    // Dedupe names for this review
    const uniqueNames = [...new Set(allMatches.map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()))];

    uniqueNames.forEach((name) => {
      if (!nameCounts[name]) {
        nameCounts[name] = { count: 0, fiveStars: 0, reviews: [] };
      }
      nameCounts[name].count++;
      if (review.star_rating === 5) {
        nameCounts[name].fiveStars++;
      }
      if (nameCounts[name].reviews.length < 3) {
        nameCounts[name].reviews.push(comment.substring(0, 200));
      }
    });
  });

  // Filter to names with at least 3 mentions (likely real techs)
  const leaderboard: LeaderboardEntry[] = Object.entries(nameCounts)
    .filter(([_, data]) => data.count >= 3)
    .map(([name, data]) => ({
      name,
      mention_count: data.count,
      five_star_count: data.fiveStars,
      avg_rating: data.count > 0 ? Math.round((data.fiveStars / data.count) * 5 * 100) / 100 : 0,
      recent_review: data.reviews[0],
    }))
    .sort((a, b) => b.mention_count - a.mention_count);

  return NextResponse.json({
    leaderboard,
    source: 'scan',
    note: 'Names detected via comment scanning. Add team members to database for accurate tracking.'
  });
}
