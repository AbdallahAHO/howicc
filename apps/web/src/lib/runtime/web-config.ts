type WebConfigSource = Partial<{
  PUBLIC_PRODUCT_NAME: string
  PUBLIC_SITE_URL: string
  PUBLIC_API_URL: string
  API_SERVER_URL: string
}>

const pickFirstString = (...values: Array<string | undefined>) =>
  values.find((value) => typeof value === 'string' && value.length > 0)

export const resolveRuntimeWebConfig = (input: {
  workerEnv?: WebConfigSource
  buildEnv?: WebConfigSource
}) => {
  const productName =
    pickFirstString(
      input.workerEnv?.PUBLIC_PRODUCT_NAME,
      input.buildEnv?.PUBLIC_PRODUCT_NAME,
    ) ?? 'HowiCC'

  const siteUrl =
    pickFirstString(
      input.workerEnv?.PUBLIC_SITE_URL,
      input.buildEnv?.PUBLIC_SITE_URL,
    ) ?? 'http://localhost:4321'

  const publicApiUrl =
    pickFirstString(
      input.workerEnv?.PUBLIC_API_URL,
      input.buildEnv?.PUBLIC_API_URL,
    ) ?? 'http://localhost:8787'

  const apiServerUrl =
    pickFirstString(
      input.workerEnv?.API_SERVER_URL,
      input.buildEnv?.API_SERVER_URL,
      publicApiUrl,
    ) ?? publicApiUrl

  return {
    productName,
    siteUrl,
    publicApiUrl,
    apiServerUrl,
  }
}
