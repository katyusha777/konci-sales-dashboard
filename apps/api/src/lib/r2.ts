/**
 * Public CDN URL for an R2 object (VIDEOS_PUBLIC_URL = the bucket's r2.dev or custom
 * domain). Null when not configured — callers fall back to serving through the Worker.
 */
export function r2PublicUrl(env: Env, key: string | null): string | null {
  const base = env.VIDEOS_PUBLIC_URL?.replace(/\/+$/, '')
  return base && key ? `${base}/${key}` : null
}
