/**
 * Type guard for API-client responses.
 *
 * Every `@howicc/api-client` method returns a success envelope with
 * `success: true` plus the operation's payload, or an error envelope
 * with `success: false`. `unwrapSuccess` lets callers narrow the
 * response to the typed success shape without repeating the same
 * `'success' in response && response.success === true` dance at every
 * call site — and, critically, without `as` casts that silently swallow
 * contract drift.
 *
 * @example
 * const response = await api.profile.stats().catch(() => null)
 * const stats = unwrapSuccess<ProfileStatsResponse>(response)
 * if (stats) {
 *   //  stats.stats is fully typed against the contract
 * }
 */
export const unwrapSuccess = <T extends { success: true }>(
  response: unknown,
): T | null => {
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    (response as { success?: unknown }).success === true
  ) {
    return response as T
  }
  return null
}
