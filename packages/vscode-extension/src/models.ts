export interface OpenRouterRawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    is_moderated?: boolean;
    context_length?: number;
  };
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  group: 'recommended' | 'free' | 'anthropic' | 'openai' | 'google' | 'deepseek' | 'meta' | 'mistral' | 'qwen' | 'other';
  description: string;
  contextLength?: number;
  isFree: boolean;
  pricingPrompt?: string;
}

// Top curated recommended models for fast access
export const TOP_RECOMMENDED_IDS = [
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-3.7-sonnet:thinking',
  'anthropic/claude-3.5-sonnet',
  'openai/o3-mini',
  'openai/o3-mini-high',
  'openai/o1',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-r1',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash-thinking-exp:free',
  'qwen/qwen-2.5-coder-32b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/codestral-2501',
  'openrouter/free'
];

let cachedModels: ModelDefinition[] | null = null;
let lastFetchTimestamp = 0;
const CACHE_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all available models directly from OpenRouter API live.
 */
export async function fetchAllOpenRouterModels(
  apiKey?: string,
  forceRefresh: boolean = false
): Promise<ModelDefinition[]> {
  const now = Date.now();
  if (!forceRefresh && cachedModels && (now - lastFetchTimestamp < CACHE_LIFETIME_MS)) {
    return cachedModels;
  }

  const headers: Record<string, string> = {
    'HTTP-Referer': 'https://github.com/realutj/synai',
    'X-Title': 'SynAI VS Code Extension'
  };

  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { data?: OpenRouterRawModel[] };
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error('Malformed response from OpenRouter');
    }

    const parsedModels: ModelDefinition[] = json.data
      .filter(m => m && m.id && typeof m.id === 'string' && !m.id.includes('lyria'))
      .map(m => {
        const id = m.id;
        const rawName = m.name || id;
        
        // Determine provider from ID prefix (e.g. "anthropic/claude-3.7-sonnet" -> "anthropic")
        const providerSlug = id.includes('/') ? id.split('/')[0].toLowerCase() : 'other';
        const providerName = formatProviderName(providerSlug);

        // Determine if free
        const isFree =
          id.endsWith(':free') ||
          id === 'openrouter/free' ||
          rawName.toLowerCase().includes('(free)') ||
          (m.pricing?.prompt === '0' && m.pricing?.completion === '0') ||
          (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);

        // Determine grouping
        let group: ModelDefinition['group'] = 'other';
        if (TOP_RECOMMENDED_IDS.includes(id)) {
          group = 'recommended';
        } else if (isFree) {
          group = 'free';
        } else if (providerSlug === 'anthropic') {
          group = 'anthropic';
        } else if (providerSlug === 'openai') {
          group = 'openai';
        } else if (providerSlug === 'google') {
          group = 'google';
        } else if (providerSlug === 'deepseek') {
          group = 'deepseek';
        } else if (providerSlug.includes('llama') || providerSlug === 'meta') {
          group = 'meta';
        } else if (providerSlug === 'mistral' || providerSlug === 'mistralai') {
          group = 'mistral';
        } else if (providerSlug === 'qwen' || providerSlug === 'alibaba') {
          group = 'qwen';
        }

        return {
          id,
          name: rawName,
          provider: providerName,
          group,
          description: m.description ? m.description.slice(0, 180) : '',
          contextLength: m.context_length,
          isFree,
          pricingPrompt: m.pricing?.prompt
        };
      });

    // Sort: recommended first, then free, then alphabetical by name
    const recommendedList = parsedModels.filter(m => TOP_RECOMMENDED_IDS.includes(m.id));
    recommendedList.sort((a, b) => TOP_RECOMMENDED_IDS.indexOf(a.id) - TOP_RECOMMENDED_IDS.indexOf(b.id));

    const remainingList = parsedModels.filter(m => !TOP_RECOMMENDED_IDS.includes(m.id));
    remainingList.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });

    cachedModels = [...recommendedList, ...remainingList];
    lastFetchTimestamp = now;
    return cachedModels;
  } catch (error) {
    if (cachedModels && cachedModels.length > 0) {
      return cachedModels;
    }
    // Minimal fallback if completely offline
    return getOfflineFallbackModels();
  }
}

function formatProviderName(slug: string): string {
  const map: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    deepseek: 'DeepSeek',
    'meta-llama': 'Meta',
    meta: 'Meta',
    mistralai: 'Mistral',
    mistral: 'Mistral',
    qwen: 'Qwen / Alibaba',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
    'x-ai': 'xAI',
    microsoft: 'Microsoft',
    amazon: 'Amazon'
  };
  return map[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1));
}

function getOfflineFallbackModels(): ModelDefinition[] {
  return [
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet',
      provider: 'Anthropic',
      group: 'recommended',
      description: 'Hybrid reasoning and frontier coding flagship',
      contextLength: 200000,
      isFree: false
    },
    {
      id: 'openai/o3-mini',
      name: 'OpenAI o3-mini',
      provider: 'OpenAI',
      group: 'recommended',
      description: 'SOTA STEM & coding reasoning',
      contextLength: 200000,
      isFree: false
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      provider: 'DeepSeek',
      group: 'recommended',
      description: 'Frontier open reasoning model',
      contextLength: 128000,
      isFree: false
    },
    {
      id: 'openrouter/free',
      name: 'OpenRouter Free Auto-Router',
      provider: 'OpenRouter',
      group: 'free',
      description: 'Auto-routes to the best live free model',
      contextLength: 200000,
      isFree: true
    }
  ];
}
