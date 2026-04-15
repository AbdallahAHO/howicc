export const resolveLoginCallbackUrl = (input: {
  siteUrl: string
  requestedReturnTo: string | null
}): string => {
  const safeReturnTo = input.requestedReturnTo?.startsWith('/')
    ? input.requestedReturnTo
    : '/'

  return new URL(safeReturnTo, input.siteUrl).toString()
}
