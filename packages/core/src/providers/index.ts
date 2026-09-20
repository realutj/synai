/**
 * SynAI Provider Registry
 * -----------------------
 * A single source of truth for the model/inference/search providers SynAI can
 * talk to. Every entry is real, verified metadata — nothing here is a guess:
 * an entry is only added when its env-var name and key-management URL are known.
 *
 * Why keep this in core (and not in the CLI)? Two reasons:
 *  1. `ConfigManager` needs it to know which env var belongs to which provider and
 *     which providers are key-based at all (`requiresKey: false` for local servers).
 *  2. Both the CLI (`/keys`) and the Web dashboard read the same list, so a provider
 *     added here shows up in every surface with zero extra wiring.
 *
 * `baseUrl` is only populated for OpenAI-compatible endpoints (the vast majority),
 * because that is the value a client can actually use directly. Providers that use a
 * bespoke protocol (Anthropic Messages, Bedrock SigV4, Vertex ADC) still appear so
 * their key can be stored, but are marked `native` — a caller must not blindly POST
 * OpenAI-shaped JSON to them.
 */

export type ProviderCategory =
  | 'aggregator'
  | 'frontier'
  | 'fast-inference'
  | 'open-hosting'
  | 'cloud'
  | 'regional'
  | 'specialized'
  | 'local';

/**
 * How a provider expects to be called.
 * - `openai-compatible`: `/chat/completions` with `Authorization: Bearer <key>`.
 * - `native`: its own protocol/auth (Anthropic, Bedrock, Vertex, Gemini, …).
 * - `local`: a self-hosted server, usually with NO key at all.
 */
export type ProviderApiStyle = 'openai-compatible' | 'native' | 'local';

export interface ProviderInfo {
  /** Stable slug — also the storage key. Never change it once shipped. */
  id: string;
  /** Human-facing name shown in the CLI/web pickers. */
  name: string;
  /** Conventional env var. Used for env fallback and for `.env` mirroring. */
  envVar: string;
  /** Additional env vars some tools/users use for the same provider. */
  altEnvVars?: string[];
  /** Where the user creates/manages the key. */
  docsUrl: string;
  /** OpenAI-compatible base URL, when applicable. */
  baseUrl?: string;
  apiStyle: ProviderApiStyle;
  category: ProviderCategory;
  /** Optional, non-enforcing sanity hint (e.g. OpenAI keys start with `sk-`). */
  keyPrefix?: string;
  /** `false` for local servers that typically need no credential. */
  requiresKey: boolean;
  /** `true` when the user must supply their own base URL (generic/proxy endpoints). */
  customBaseUrl?: boolean;
  /** Short note surfaced in the picker (auth quirks, region, etc.). */
  note?: string;
}

export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  aggregator: 'Aggregators / Routers',
  frontier: 'Frontier Labs',
  'fast-inference': 'Fast Inference',
  'open-hosting': 'Open-Weight Hosting',
  cloud: 'Cloud Platforms',
  regional: 'Regional / Sovereign',
  specialized: 'Specialized (Embeddings, Audio, Media, Search)',
  local: 'Local / Self-Hosted (no key)',
};

/**
 * The registry. Ordering is intentional: aggregators first (they unlock the most
 * models with one key), then frontier labs, then the rest.
 */
export const PROVIDERS: ProviderInfo[] = [
  // ── Aggregators / Routers ────────────────────────────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    docsUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    keyPrefix: 'sk-or-',
    requiresKey: true,
    note: 'SynAI default — one key, hundreds of models incl. free tiers',
  },
  {
    id: 'requesty',
    name: 'Requesty',
    envVar: 'REQUESTY_API_KEY',
    docsUrl: 'https://app.requesty.ai/api-keys',
    baseUrl: 'https://router.requesty.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'portkey',
    name: 'Portkey Gateway',
    envVar: 'PORTKEY_API_KEY',
    docsUrl: 'https://app.portkey.ai/api-keys',
    baseUrl: 'https://api.portkey.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'helicone',
    name: 'Helicone',
    envVar: 'HELICONE_API_KEY',
    docsUrl: 'https://us.helicone.ai/settings/api-keys',
    baseUrl: 'https://oai.helicone.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'unify',
    name: 'Unify AI',
    envVar: 'UNIFY_API_KEY',
    docsUrl: 'https://console.unify.ai',
    baseUrl: 'https://api.unify.ai/v0',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'aimlapi',
    name: 'AI/ML API',
    envVar: 'AIMLAPI_KEY',
    docsUrl: 'https://aimlapi.com/app/keys',
    baseUrl: 'https://api.aimlapi.com/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'eden-ai',
    name: 'Eden AI',
    envVar: 'EDENAI_API_KEY',
    docsUrl: 'https://app.edenai.run',
    baseUrl: 'https://api.edenai.run/v2',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    envVar: 'AI_GATEWAY_API_KEY',
    docsUrl: 'https://vercel.com/dashboard',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: true,
  },

  // ── Frontier Labs ───────────────────────────────────────────────────────────
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    keyPrefix: 'sk-',
    requiresKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    envVar: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com/v1',
    apiStyle: 'native',
    category: 'frontier',
    keyPrefix: 'sk-ant-',
    requiresKey: true,
    note: 'Messages API (x-api-key header), not OpenAI chat/completions',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    altEnvVars: ['GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiStyle: 'native',
    category: 'frontier',
    requiresKey: true,
    note: 'Key passed as ?key= query param; also honours GOOGLE_API_KEY',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    envVar: 'XAI_API_KEY',
    docsUrl: 'https://console.x.ai',
    baseUrl: 'https://api.x.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    keyPrefix: 'xai-',
    requiresKey: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    envVar: 'MISTRAL_API_KEY',
    docsUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    envVar: 'COHERE_API_KEY',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    keyPrefix: 'sk-',
    requiresKey: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    envVar: 'PERPLEXITY_API_KEY',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    baseUrl: 'https://api.perplexity.ai',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    keyPrefix: 'pplx-',
    requiresKey: true,
    note: 'Search-grounded models (sonar)',
  },
  {
    id: 'ai21',
    name: 'AI21 Labs',
    envVar: 'AI21_API_KEY',
    docsUrl: 'https://studio.ai21.com/account/api-key',
    baseUrl: 'https://api.ai21.com/studio/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    envVar: 'GITHUB_TOKEN',
    docsUrl: 'https://github.com/settings/tokens',
    baseUrl: 'https://models.inference.ai.azure.com',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
    note: 'Any GitHub PAT with models:read',
  },

  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    envVar: 'AZURE_OPENAI_API_KEY',
    docsUrl: 'https://portal.azure.com',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'Needs your own https://<resource>.openai.azure.com endpoint + deployment',
  },
  {
    id: 'aws-bedrock',
    name: 'Amazon Bedrock',
    envVar: 'AWS_ACCESS_KEY_ID',
    docsUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'SigV4-signed; also needs AWS_SECRET_ACCESS_KEY + AWS_REGION',
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex AI',
    envVar: 'GOOGLE_APPLICATION_CREDENTIALS',
    docsUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'Path to a service-account JSON, not a raw key',
  },
  {
    id: 'watsonx',
    name: 'IBM watsonx.ai',
    envVar: 'WATSONX_API_KEY',
    docsUrl: 'https://cloud.ibm.com/iam/apikeys',
    baseUrl: 'https://us-south.ml.cloud.ibm.com',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'Also needs WATSONX_PROJECT_ID',
  },
  {
    id: 'databricks',
    name: 'Databricks',
    envVar: 'DATABRICKS_TOKEN',
    docsUrl: 'https://docs.databricks.com/en/dev-tools/auth/pat.html',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'Per-workspace host required',
  },
  {
    id: 'oracle-oci-genai',
    name: 'Oracle OCI Generative AI',
    envVar: 'OCI_GENAI_API_KEY',
    docsUrl: 'https://cloud.oracle.com',
    apiStyle: 'native',
    category: 'cloud',
    requiresKey: true,
    note: 'Needs an OCI config/profile in addition to the key',
  },
  {
    id: 'writer',
    name: 'Writer (Palmyra)',
    envVar: 'WRITER_API_KEY',
    docsUrl: 'https://app.writer.com',
    baseUrl: 'https://api.writer.com/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },
  {
    id: 'upstage',
    name: 'Upstage (Solar)',
    envVar: 'UPSTAGE_API_KEY',
    docsUrl: 'https://console.upstage.ai',
    baseUrl: 'https://api.upstage.ai/v1/solar',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },

  // ── Fast Inference ──────────────────────────────────────────────────────────
  {
    id: 'groq',
    name: 'Groq',
    envVar: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    keyPrefix: 'gsk_',
    requiresKey: true,
    note: 'Very low latency LPU inference',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    envVar: 'CEREBRAS_API_KEY',
    docsUrl: 'https://cloud.cerebras.ai',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    keyPrefix: 'csk-',
    requiresKey: true,
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    envVar: 'SAMBANOVA_API_KEY',
    docsUrl: 'https://cloud.sambanova.ai/apis',
    baseUrl: 'https://api.sambanova.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    envVar: 'TOGETHER_API_KEY',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
    baseUrl: 'https://api.together.xyz/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    envVar: 'FIREWORKS_API_KEY',
    docsUrl: 'https://fireworks.ai/account/api-keys',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    keyPrefix: 'fw_',
    requiresKey: true,
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra',
    envVar: 'DEEPINFRA_API_KEY',
    docsUrl: 'https://deepinfra.com/dash/api_keys',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },
  {
    id: 'novita',
    name: 'Novita AI',
    envVar: 'NOVITA_API_KEY',
    docsUrl: 'https://novita.ai/settings/key-management',
    baseUrl: 'https://api.novita.ai/v3/openai',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },
  {
    id: 'hyperbolic',
    name: 'Hyperbolic',
    envVar: 'HYPERBOLIC_API_KEY',
    docsUrl: 'https://app.hyperbolic.xyz/settings',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },
  {
    id: 'lepton',
    name: 'Lepton AI',
    envVar: 'LEPTON_API_KEY',
    docsUrl: 'https://dashboard.lepton.ai',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
    note: 'Endpoint is per-model: https://<model>.lepton.run/api/v1',
  },
  {
    id: 'friendli',
    name: 'FriendliAI',
    envVar: 'FRIENDLI_TOKEN',
    docsUrl: 'https://suite.friendli.ai',
    baseUrl: 'https://api.friendli.ai/serverless/v1',
    apiStyle: 'openai-compatible',
    category: 'fast-inference',
    requiresKey: true,
  },

  // ── Open-Weight Hosting ─────────────────────────────────────────────────────
  {
    id: 'baseten',
    name: 'Baseten',
    envVar: 'BASETEN_API_KEY',
    docsUrl: 'https://app.baseten.co/settings/api_keys',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
    note: 'Endpoint is per-deployment: https://model-<id>.baseten.co/v1',
  },
  {
    id: 'runpod',
    name: 'RunPod',
    envVar: 'RUNPOD_API_KEY',
    docsUrl: 'https://www.runpod.io/console/user/settings',
    baseUrl: 'https://api.runpod.ai/v2',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'kluster',
    name: 'Kluster.ai',
    envVar: 'KLUSTER_API_KEY',
    docsUrl: 'https://platform.kluster.ai/apikeys',
    baseUrl: 'https://api.kluster.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'gmi-cloud',
    name: 'GMI Cloud',
    envVar: 'GMI_API_KEY',
    docsUrl: 'https://console.gmicloud.ai',
    baseUrl: 'https://api.gmi-serving.com/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'nebius',
    name: 'Nebius AI Studio',
    envVar: 'NEBIUS_API_KEY',
    docsUrl: 'https://studio.nebius.ai',
    baseUrl: 'https://api.studio.nebius.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'lambda-labs',
    name: 'Lambda Labs',
    envVar: 'LAMBDA_API_KEY',
    docsUrl: 'https://cloud.lambdalabs.com/api-keys',
    baseUrl: 'https://api.lambdalabs.com/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },

  {
    id: 'modal',
    name: 'Modal',
    envVar: 'MODAL_TOKEN_ID',
    docsUrl: 'https://modal.com/settings/tokens',
    apiStyle: 'native',
    category: 'open-hosting',
    requiresKey: true,
    note: 'Also needs MODAL_TOKEN_SECRET',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    envVar: 'REPLICATE_API_TOKEN',
    docsUrl: 'https://replicate.com/account/api-tokens',
    baseUrl: 'https://api.replicate.com/v1',
    apiStyle: 'native',
    category: 'open-hosting',
    keyPrefix: 'r8_',
    requiresKey: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    envVar: 'HF_TOKEN',
    docsUrl: 'https://huggingface.co/settings/tokens',
    baseUrl: 'https://router.huggingface.co/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    keyPrefix: 'hf_',
    requiresKey: true,
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    envVar: 'NVIDIA_API_KEY',
    docsUrl: 'https://build.nvidia.com',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    keyPrefix: 'nvapi-',
    requiresKey: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    envVar: 'SILICONFLOW_API_KEY',
    docsUrl: 'https://cloud.siliconflow.cn/account/ak',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'cloudflare-workers-ai',
    name: 'Cloudflare Workers AI',
    envVar: 'CLOUDFLARE_API_TOKEN',
    docsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    apiStyle: 'openai-compatible',
    category: 'cloud',
    requiresKey: true,
    note: 'Also needs your CLOUDFLARE_ACCOUNT_ID',
  },

  // ── Regional / Sovereign ────────────────────────────────────────────────────
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    envVar: 'MOONSHOT_API_KEY',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiStyle: 'openai-compatible',
    category: 'regional',
    keyPrefix: 'sk-',
    requiresKey: true,
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (GLM)',
    envVar: 'ZHIPUAI_API_KEY',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiStyle: 'openai-compatible',
    category: 'regional',
    requiresKey: true,
  },
  {
    id: 'alibaba-dashscope',
    name: 'Alibaba Qwen (DashScope)',
    envVar: 'DASHSCOPE_API_KEY',
    docsUrl: 'https://bailian.console.alibabacloud.com',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiStyle: 'openai-compatible',
    category: 'regional',
    requiresKey: true,
  },
  {
    id: 'bytedance-doubao',
    name: 'ByteDance Doubao (Volcengine)',
    envVar: 'ARK_API_KEY',
    docsUrl: 'https://console.volcengine.com/ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiStyle: 'openai-compatible',
    category: 'regional',
    requiresKey: true,
  },
  {
    id: 'baidu-qianfan',
    name: 'Baidu Qianfan (ERNIE)',
    envVar: 'QIANFAN_ACCESS_KEY',
    docsUrl: 'https://console.bce.baidu.com/qianfan',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    apiStyle: 'openai-compatible',
    category: 'regional',
    requiresKey: true,
    note: 'Also needs QIANFAN_SECRET_KEY',
  },

  // ─ Specialized (Embeddings, Audio, Media, Search) ──────────────────────────
  {
    id: 'voyage',
    name: 'Voyage AI (embeddings)',
    envVar: 'VOYAGE_API_KEY',
    docsUrl: 'https://dash.voyageai.com/api-keys',
    baseUrl: 'https://api.voyageai.com/v1',
    apiStyle: 'openai-compatible',
    category: 'specialized',
    keyPrefix: 'pa-',
    requiresKey: true,
  },
  {
    id: 'jina',
    name: 'Jina AI (embeddings)',
    envVar: 'JINA_API_KEY',
    docsUrl: 'https://jina.ai/embeddings',
    baseUrl: 'https://api.jina.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'specialized',
    keyPrefix: 'jina_',
    requiresKey: true,
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI (speech-to-text)',
    envVar: 'ASSEMBLYAI_API_KEY',
    docsUrl: 'https://www.assemblyai.com/dashboard',
    baseUrl: 'https://api.assemblyai.com/v2',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'deepgram',
    name: 'Deepgram (speech)',
    envVar: 'DEEPGRAM_API_KEY',
    docsUrl: 'https://console.deepgram.com',
    baseUrl: 'https://api.deepgram.com/v1',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs (TTS)',
    envVar: 'ELEVENLABS_API_KEY',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    baseUrl: 'https://api.elevenlabs.io/v1',
    apiStyle: 'native',
    category: 'specialized',
    keyPrefix: 'sk_',
    requiresKey: true,
  },

  {
    id: 'fal',
    name: 'fal.ai (media)',
    envVar: 'FAL_KEY',
    docsUrl: 'https://fal.ai/dashboard/keys',
    baseUrl: 'https://fal.run',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'stability-ai',
    name: 'Stability AI (images)',
    envVar: 'STABILITY_API_KEY',
    docsUrl: 'https://platform.stability.ai/account/keys',
    baseUrl: 'https://api.stability.ai',
    apiStyle: 'native',
    category: 'specialized',
    keyPrefix: 'sk-',
    requiresKey: true,
  },
  {
    id: 'runway',
    name: 'Runway (video)',
    envVar: 'RUNWAY_API_KEY',
    docsUrl: 'https://dev.runwayml.com',
    baseUrl: 'https://api.dev.runwayml.com/v1',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'luma',
    name: 'Luma AI (video)',
    envVar: 'LUMAAI_API_KEY',
    docsUrl: 'https://lumalabs.ai/dashboard/api',
    baseUrl: 'https://api.lumalabs.ai/dream-machine/v1',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'ideogram',
    name: 'Ideogram (images)',
    envVar: 'IDEOGRAM_API_KEY',
    docsUrl: 'https://ideogram.ai/manage-api',
    baseUrl: 'https://api.ideogram.ai',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },

  {
    id: 'tavily',
    name: 'Tavily (web search)',
    envVar: 'TAVILY_API_KEY',
    docsUrl: 'https://app.tavily.com/home',
    baseUrl: 'https://api.tavily.com',
    apiStyle: 'native',
    category: 'specialized',
    keyPrefix: 'tvly-',
    requiresKey: true,
    note: 'Powers higher-quality web_search results when present',
  },
  {
    id: 'exa',
    name: 'Exa (web search)',
    envVar: 'EXA_API_KEY',
    docsUrl: 'https://dashboard.exa.ai/api-keys',
    baseUrl: 'https://api.exa.ai',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },
  {
    id: 'brave-search',
    name: 'Brave Search API',
    envVar: 'BRAVE_API_KEY',
    docsUrl: 'https://api-dashboard.search.brave.com/app/keys',
    baseUrl: 'https://api.search.brave.com/res/v1',
    apiStyle: 'native',
    category: 'specialized',
    keyPrefix: 'BSA',
    requiresKey: true,
  },
  {
    id: 'serper',
    name: 'Serper (Google SERP)',
    envVar: 'SERPER_API_KEY',
    docsUrl: 'https://serper.dev/api-key',
    baseUrl: 'https://google.serper.dev',
    apiStyle: 'native',
    category: 'specialized',
    requiresKey: true,
  },

  // ── Local / Self-Hosted (no key required) ───────────────────────────────────
  {
    id: 'ollama',
    name: 'Ollama',
    envVar: 'OLLAMA_HOST',
    docsUrl: 'https://ollama.com/download',
    baseUrl: 'http://localhost:11434/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
    note: 'Runs locally; no API key needed',
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    envVar: 'LMSTUDIO_HOST',
    docsUrl: 'https://lmstudio.ai',
    baseUrl: 'http://localhost:1234/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
    note: 'Enable the local server in LM Studio first',
  },
  {
    id: 'vllm',
    name: 'vLLM',
    envVar: 'VLLM_API_KEY',
    docsUrl: 'https://docs.vllm.ai',
    baseUrl: 'http://localhost:8000/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
    note: 'Optional --api-key on the server; leave blank for none',
  },
  {
    id: 'llama-cpp',
    name: 'llama.cpp server',
    envVar: 'LLAMA_CPP_HOST',
    docsUrl: 'https://github.com/ggml-org/llama.cpp',
    baseUrl: 'http://localhost:8080/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },
  {
    id: 'text-generation-webui',
    name: 'text-generation-webui',
    envVar: 'TEXTGEN_HOST',
    docsUrl: 'https://github.com/oobabooga/text-generation-webui',
    baseUrl: 'http://localhost:5000/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },

  {
    id: 'jan',
    name: 'Jan',
    envVar: 'JAN_HOST',
    docsUrl: 'https://jan.ai',
    baseUrl: 'http://localhost:1337/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },
  {
    id: 'gpt4all',
    name: 'GPT4All',
    envVar: 'GPT4ALL_HOST',
    docsUrl: 'https://www.nomic.ai/gpt4all',
    baseUrl: 'http://localhost:4891/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },
  {
    id: 'koboldcpp',
    name: 'KoboldCpp',
    envVar: 'KOBOLDCPP_HOST',
    docsUrl: 'https://github.com/LostRuins/koboldcpp',
    baseUrl: 'http://localhost:5001/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },
  {
    id: 'llamafile',
    name: 'llamafile',
    envVar: 'LLAMAFILE_HOST',
    docsUrl: 'https://github.com/Mozilla-Ocho/llamafile',
    baseUrl: 'http://localhost:8080/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },
  {
    id: 'lemonade',
    name: 'Lemonade Server',
    envVar: 'LEMONADE_HOST',
    docsUrl: 'https://lemonade-server.ai',
    baseUrl: 'http://localhost:8000/api/v1',
    apiStyle: 'local',
    category: 'local',
    requiresKey: false,
  },

  // ── Additional hosting & research providers ─────────────────────────────────
  {
    id: 'chutes',
    name: 'Chutes',
    envVar: 'CHUTES_API_KEY',
    docsUrl: 'https://chutes.ai/app/api',
    baseUrl: 'https://llm.chutes.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'featherless',
    name: 'Featherless AI',
    envVar: 'FEATHERLESS_API_KEY',
    docsUrl: 'https://featherless.ai/account/api-keys',
    baseUrl: 'https://api.featherless.ai/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'nous-research',
    name: 'Nous Research',
    envVar: 'NOUS_API_KEY',
    docsUrl: 'https://portal.nousresearch.com',
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    apiStyle: 'openai-compatible',
    category: 'open-hosting',
    requiresKey: true,
  },
  {
    id: 'meta-llama',
    name: 'Meta Llama API',
    envVar: 'LLAMA_API_KEY',
    docsUrl: 'https://llama.developer.meta.com',
    baseUrl: 'https://api.llama.com/compat/v1',
    apiStyle: 'openai-compatible',
    category: 'frontier',
    requiresKey: true,
  },
  {
    id: 'aleph-alpha',
    name: 'Aleph Alpha',
    envVar: 'ALEPH_ALPHA_API_KEY',
    docsUrl: 'https://app.aleph-alpha.com',
    baseUrl: 'https://api.aleph-alpha.com',
    apiStyle: 'native',
    category: 'regional',
    requiresKey: true,
    note: 'EU-hosted (sovereign) inference',
  },
  {
    id: 'openai-compatible',
    name: 'Custom OpenAI-compatible endpoint',
    envVar: 'CUSTOM_API_KEY',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    apiStyle: 'openai-compatible',
    category: 'aggregator',
    requiresKey: false,
    customBaseUrl: true,
    note: 'Point baseUrl at any /v1 endpoint (proxy, self-host, gateway)',
  },
];

/**
 * Mask a secret for display. Never returns the full key: a short, fixed-length
 * fragment is enough for a human to confirm which key is stored, while staying
 * useless to anyone reading over their shoulder. ASCII-only, because this string is
 * rendered on terminals whose code page may not encode decorative glyphs.
 */
export function maskApiKey(key: string | undefined | null): string {
  if (!key) return '-';
  const trimmed = key.trim();
  if (trimmed.length === 0) return '-';
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}${'*'.repeat(8)}${trimmed.slice(-4)}`;
}

/** Look up a provider by its stable id. Case-insensitive. */
export function getProvider(id: string): ProviderInfo | undefined {
  if (!id) return undefined;
  const needle = id.trim().toLowerCase();
  return PROVIDERS.find((p) => p.id === needle);
}

/** All providers, in registry order. */
export function listProviders(): ProviderInfo[] {
  return [...PROVIDERS];
}

/** Providers belonging to a category, in registry order. */
export function listProvidersByCategory(category: ProviderCategory): ProviderInfo[] {
  return PROVIDERS.filter((p) => p.category === category);
}

/**
 * Find a provider by its env var (case-insensitive). Lets config loading answer
 * "who does `GROQ_API_KEY` belong to?" without hardcoding a second mapping.
 */
export function findProviderByEnvVar(envVar: string): ProviderInfo | undefined {
  if (!envVar) return undefined;
  const needle = envVar.trim().toUpperCase();
  return PROVIDERS.find((p) => p.envVar.toUpperCase() === needle);
}

/**
 * Free-text search across id, name, env var and category. Used by `/keys search`
 * so a user who remembers "groq" or "GROQ_API_KEY" lands on the same result.
 */
export function searchProviders(term: string): ProviderInfo[] {
  const needle = (term || '').trim().toLowerCase();
  if (!needle) return listProviders();
  return PROVIDERS.filter((p) => {
    const haystack = [p.id, p.name, p.envVar, p.category, p.note || '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * Providers that need a credential — the ones `/keys` should offer to configure.
 * Local servers are excluded because prompting for a key they don't use is noise.
 */
export function listKeyBasedProviders(): ProviderInfo[] {
  return PROVIDERS.filter((p) => p.requiresKey);
}

/** Total number of registered providers (handy for the `/keys` header + tests). */
export function providerCount(): number {
  return PROVIDERS.length;
}