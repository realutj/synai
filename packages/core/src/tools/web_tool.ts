export interface WebToolResult {
  output: string;
  isError?: boolean;
  actionType: 'info';
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

export async function webFetch(url: string, maxLength: number = 8000): Promise<WebToolResult> {
  try {
    const parsed = (() => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })();

    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      return {
        output: `Invalid URL "${url}": only http:// and https:// URLs can be fetched.`,
        isError: true,
        actionType: 'info',
      };
    }

    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr,en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        output: `Failed to fetch URL ${url}: ${res.status} ${res.statusText}`,
        isError: true,
        actionType: 'info',
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType && !/text|html|xml|json|javascript/i.test(contentType)) {
      return {
        output: `Cannot display URL ${url}: unsupported content type "${contentType}".`,
        isError: true,
        actionType: 'info',
      };
    }

    const text = await res.text();
    // HTML to readable plain text
    let cleaned = text;
    if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('<body')) {
      cleaned = decodeHtmlEntities(
        text
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
    }

    const truncated = cleaned.slice(0, maxLength);
    const suffix = cleaned.length > maxLength ? `\n\n...(truncated ${cleaned.length - maxLength} characters)` : '';

    return {
      output: `Content from ${url}:\n\n${truncated}${suffix}`,
      actionType: 'info',
    };
  } catch (err: any) {
    return {
      output: `Error fetching URL ${url}: ${err.message}`,
      isError: true,
      actionType: 'info',
    };
  }
}
