// Runtime configuration loader. Fetches server-provided app config so we avoid
// baking API base URLs (and similar) at build time.
export type AppRuntimeConfig = {
  apiBaseUrl?: string;
  features?: { msal?: boolean };
  build?: { commit?: string; buildId?: string; generatedAt?: string; hash?: string };
};

let _config: AppRuntimeConfig | null = null;
export function getRuntimeConfig(): AppRuntimeConfig | null { return _config; }

export async function loadRuntimeConfig(signal?: AbortSignal): Promise<AppRuntimeConfig> {
  if (_config) return _config;
  try {
    const res = await fetch('/api/app-config', { signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`config status ${res.status}`);
    _config = await res.json();
  } catch (e) {
    console.warn('[runtime-config] load failed, falling back to legacy env', e);
    _config = {};
  }
  return _config!;
}
