import type { SignalRaw } from "@/core/domain/types";
import { extractTickerCandidates } from "../normalize/symbol_map";
import { nowIso } from "@/core/utils/time";
import { fetchJson } from "./http";

const SUBREDDITS = ["wallstreetbets", "stocks", "investing", "options"];

export async function gatherReddit(limit = 25): Promise<SignalRaw[]> {
  const results: SignalRaw[] = [];
  for (const sub of SUBREDDITS) {
    const data = await fetchJson<{
      data?: { children?: Array<{ data: any }> };
    }>(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`, {
      headers: { "User-Agent": "deepstock-research-only" }
    });
    if (!data) continue;
    const posts = data.data?.children?.map((c) => c.data) ?? [];

    for (const post of posts) {
      const title = String(post.title ?? "");
      const body = String(post.selftext ?? "");
      const text = `${title} ${body}`.trim();
      const symbols = extractTickerCandidates(text);
      if (symbols.length === 0) continue;

      results.push({
        source: "reddit",
        externalId: `reddit_${sub}_${post.id ?? post.name ?? Date.now()}`,
        symbolCandidates: symbols,
        title,
        body,
        url: post.permalink ? `https://reddit.com${post.permalink}` : null,
        author: post.author ?? null,
        publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
        collectedAt: nowIso(),
        engagement: {
          upvotes: Number(post.ups ?? 0),
          comments: Number(post.num_comments ?? 0)
        },
        rawPayload: {
          subreddit: sub,
          flair: post.link_flair_text ?? null
        }
      });
    }
  }

  return results;
}
