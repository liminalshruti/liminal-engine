/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional fallback LiveKit server ws/wss URL. The POST /livekit/token endpoint
   * returns the canonical `url`; this is only used if that response omits one.
   */
  readonly VITE_LIVEKIT_URL?: string;
  /**
   * Optional base URL for the apps/api server that mints LiveKit tokens. Defaults
   * to same-origin "" (use a dev proxy, see vite.config.ts).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
