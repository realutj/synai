export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+\d*);/g, (match, code) => {
    if (code[0] === '#') {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

export async function searchWeb(
  query: string,
  maxResults: number = 5
): Promise<{ output: string; isError?: boolean }> {
  // Try multiple search strategies with fallbacks
  const strategies = [
    () => searchViaDuckDuckGoAPI(query, maxResults),
    () => searchViaDuckDuckGoLite(query, maxResults),
    () => searchViaDuckDuckGoHTML(query, maxResults),
  ];

  for (const strategy of strategies) {
    try {
      const raw = await strategy();
      // De-duplicate by URL and drop empty entries before formatting
      const seen = new Set<string>();
      const result = raw
        .map((r) => ({
          title: decodeHtmlEntities(r.title).trim(),
          url: r.url.trim(),
          snippet: decodeHtmlEntities(r.snippet).trim(),
        }))
        .filter((r) => (r.title || r.snippet) && !seen.has(r.url) && (seen.add(r.url), true))
        .slice(0, maxResults);

      if (result.length > 0) {
        const formatted = result
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}${r.url ? `\n   URL: ${r.url}` : ''}`)
          .join('\n\n');
        return {
          output: `Web search results for "${query}":\n\n${formatted}`,
        };
      }
    } catch {
      // Try next strategy
    }
  }

  return {
    output: `No search results found for: "${query}". Try rephrasing or using different keywords.`,
  };
}

async function searchViaDuckDuckGoAPI(
  query: string,
  maxResults: number
): Promise<WebSearchResultItem[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`, {
    headers: {
      'User-Agent': 'SynAI/1.0 (Coding Assistant)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];
  const data = await res.json() as any;
  const results: WebSearchResultItem[] = [];

  // Abstract
  if (data.Abstract && data.AbstractText) {
    results.push({
      title: data.Heading || 'Summary',
      url: data.AbstractURL || '',
      snippet: data.AbstractText.slice(0, 300),
    });
  }

  // Related topics
  if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= maxResults) break;
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0]?.slice(0, 80) || 'Related',
          url: topic.FirstURL,
          snippet: topic.Text.slice(0, 250),
        });
      }
      // Handle subtopics
      if (topic.Topics && Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics) {
          if (results.length >= maxResults) break;
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(' - ')[0]?.slice(0, 80) || 'Related',
              url: sub.FirstURL,
              snippet: sub.Text.slice(0, 250),
            });
          }
        }
      }
    }
  }

  return results;
}

async function searchViaDuckDuckGoLite(
  query: string,
  maxResults: number
): Promise<WebSearchResultItem[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];
  const html = await res.text();
  const results: WebSearchResultItem[] = [];

  // DuckDuckGo Lite uses table rows with class "result-link" and "result-snippet"
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;

  const links: { url: string; title: string }[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
    links.push({
      url: match[1].trim(),
      title: match[2].replace(/<[^>]+>/g, '').trim(),
    });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < links.length; i++) {
    results.push({
      title: links[i].title || `Result #${i + 1}`,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

async function searchViaDuckDuckGoHTML(
  query: string,
  maxResults: number
): Promise<WebSearchResultItem[]> {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

  const res = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `q=${encoded}`,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];
  const html = await res.text();
  const results: WebSearchResultItem[] = [];

  // Extract result blocks
  const blockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g;
  const linkInBlock = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
  const snippetInBlock = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null && results.length < maxResults) {
    const block = blockMatch[0];
    const lm = block.match(linkInBlock);
    const sm = block.match(snippetInBlock);

    if (lm) {
      const rawUrl = lm[1];
      let cleanUrl = rawUrl;
      // DuckDuckGo wraps URLs in redirect links
      const uddg = rawUrl.match(/uddg=([^&]+)/);
      if (uddg) {
        cleanUrl = decodeURIComponent(uddg[1]);
      } else if (rawUrl.startsWith('//')) {
        cleanUrl = `https:${rawUrl}`;
      }

      results.push({
        title: lm[2].replace(/<[^>]+>/g, '').trim() || `Result #${results.length + 1}`,
        url: cleanUrl,
        snippet: sm ? sm[1].replace(/<[^>]+>/g, '').trim() : '',
      });
    }
  }

  // Fallback: simpler regex
  if (results.length === 0) {
    const simpleRegex = /<a[^>]*class="result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let idx = 0;
    while ((blockMatch = simpleRegex.exec(html)) !== null && results.length < maxResults) {
      const snippet = blockMatch[2].replace(/<[^>]+>/g, '').trim();
      const rawUrl = blockMatch[1];
      const cleanUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
      if (snippet) {
        results.push({
          title: `Result #${++idx}`,
          url: cleanUrl,
          snippet,
        });
      }
    }
  }

  return results;
}
