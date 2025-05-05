/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_EMPTY_NWC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
