/**
 * Web-side type aliases pulled from @howicc/contracts so SSR and the
 * hydrated React islands stay bolted to a single source of truth. If
 * the contract shape changes, TypeScript fails the build until
 * consumers follow — no silent drift.
 */
import type {
  ConversationVisibility,
  ProfileActivityItem,
  ProfileStats,
} from '@howicc/contracts'

export type ActivityItem = ProfileActivityItem

export type ActivityVisibility = ConversationVisibility

export type ActivitySessionType = ProfileActivityItem['sessionType']

export type ActivityRepository = NonNullable<ProfileActivityItem['repository']>

export type StatsSnapshot = ProfileStats
