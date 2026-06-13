import type { ReelSummary } from "@/lib/api";

/**
 * Client-side hashtag analytics over a set of reels. Recomputes whenever more
 * reels are loaded. The "algorithm" is deliberately simple and honest:
 * frequency (count + % of posts) and co-occurrence (pairs used together).
 */

export interface TagFrequency {
  tag: string;
  count: number;
  pct: number; // % of posts that use this tag
}

export interface TagCombo {
  a: string;
  b: string;
  count: number;
}

export interface HashtagStats {
  posts: number;
  postsWithTags: number;
  uniqueTags: number;
  avgPerPost: number; // average hashtags per post (across all posts)
  avgCaptionLength: number;
}

export interface HashtagAnalysis {
  top: TagFrequency[];
  combos: TagCombo[];
  stats: HashtagStats;
}

export function analyzeHashtags(reels: ReelSummary[]): HashtagAnalysis {
  const posts = reels.length;
  const counts = new Map<string, number>();
  const comboCounts = new Map<string, number>();

  let totalTags = 0;
  let postsWithTags = 0;
  let totalCaptionLength = 0;

  for (const reel of reels) {
    const tags = reel.hashtags ?? [];
    totalCaptionLength += (reel.caption ?? "").length;
    if (tags.length > 0) postsWithTags++;
    totalTags += tags.length;

    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    // Co-occurrence: every unordered pair within this post's tags.
    const sorted = [...new Set(tags)].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]} ${sorted[j]}`;
        comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const top: TagFrequency[] = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, pct: posts ? (count / posts) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const combos: TagCombo[] = [...comboCounts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split(" ");
      return { a, b, count };
    })
    .filter((c) => c.count > 1) // a pair seen once isn't a "pattern"
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    top,
    combos,
    stats: {
      posts,
      postsWithTags,
      uniqueTags: counts.size,
      avgPerPost: posts ? totalTags / posts : 0,
      avgCaptionLength: posts ? Math.round(totalCaptionLength / posts) : 0,
    },
  };
}
