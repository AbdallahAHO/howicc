declare const __CLI_VERSION__: string

export const cliVersion =
  typeof __CLI_VERSION__ !== 'undefined'
    ? __CLI_VERSION__
    : process.env.HOWICC_CLI_VERSION ?? '0.0.0'
