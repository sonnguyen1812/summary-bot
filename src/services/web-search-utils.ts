import { config } from "../config.js";

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";
const SEARCH_TIMEOUT_MS = 10_000;

export async function braveSearch(query: string, count: number = 5): Promise<BraveSearchResult[]> {
  if (!config.braveApiKey) {
    throw new Error("BRAVE_API_KEY is not configured");
  }

  const url = new URL(BRAVE_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", count.toString());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": config.braveApiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;
    const results = data.web?.results ?? [];

    return results.slice(0, count).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

const FETCH_TIMEOUT_MS = 5_000;
const MAX_CONTENT_CHARS = 3000;

export async function fetchPageContent(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SummaryBot/1.0)",
        "Accept": "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const html = await response.text();
    // Strip HTML tags, scripts, styles to get plain text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length === 0) return null;

    return text.length > MAX_CONTENT_CHARS
      ? text.slice(0, MAX_CONTENT_CHARS) + "…"
      : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichSearchResults(
  results: BraveSearchResult[],
  maxFetch: number = 2
): Promise<string> {
  if (results.length === 0) return "Không tìm thấy kết quả nào.";

  // Fetch content for top results in parallel
  const toFetch = results.slice(0, maxFetch);
  const contents = await Promise.all(
    toFetch.map((r) => fetchPageContent(r.url))
  );

  return results
    .map((r, i) => {
      const base = `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`;
      if (i < maxFetch && contents[i]) {
        return `${base}\n\nNội dung trang:\n${contents[i]}`;
      }
      return base;
    })
    .join("\n\n---\n\n");
}

export function formatSearchResultsForAI(results: BraveSearchResult[]): string {
  if (results.length === 0) return "Không tìm thấy kết quả nào.";

  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
    .join("\n\n");
}

export function formatCitations(results: BraveSearchResult[], maxCitations: number = 3): string {
  if (results.length === 0) return "";

  const lines = results.slice(0, maxCitations).map((r) => {
    let domain: string;
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      domain = r.url;
    }
    return `• ${r.title} (${domain})`;
  });
  return "\n\n🔗 Nguồn:\n" + lines.join("\n");
}
