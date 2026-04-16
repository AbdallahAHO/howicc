import { env as workerEnv } from 'cloudflare:workers'
import { resolveRuntimeWebConfig } from './web-config'

export const getRuntimeWebConfig = () =>
  resolveRuntimeWebConfig({
    workerEnv,
    buildEnv: import.meta.env as Record<string, string | undefined>,
  })
