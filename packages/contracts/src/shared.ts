import { z } from '@hono/zod-openapi'

export { errorResponseSchema } from './errors'

const dateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-04-14T12:34:56.000Z',
})

const dateSchema = z.string().openapi({
  format: 'date',
  example: '2026-04-14',
})

const nonNegativeIntSchema = z.number().int().nonnegative()
const rateSchema = z.number().min(0).max(1)

export const conversationVisibilityValues = ['private', 'unlisted', 'public'] as const
export const uploadAssetKindValues = ['source_bundle', 'canonical_json', 'render_json'] as const
export const providerIdValues = ['claude_code', 'openai_codex', 'custom'] as const
export const toolCategoryValues = [
  'read',
  'write',
  'search',
  'command',
  'agent',
  'mcp',
  'plan',
  'question',
  'task',
  'web',
  'other',
] as const
export const sessionTypeValues = [
  'building',
  'debugging',
  'exploring',
  'investigating',
  'mixed',
] as const

const questionOutcomeValues = [
  'answered',
  'declined',
  'redirected',
  'finished_plan_interview',
] as const
const calloutToneValues = ['info', 'warning', 'error'] as const
const toolRunStatusValues = ['ok', 'error', 'partial'] as const
const toolRunSourceValues = ['native', 'mcp'] as const
const repositorySourceValues = ['git_remote', 'pr_link', 'cwd_derived'] as const

export const visibilitySchema = z
  .enum(conversationVisibilityValues)
  .openapi('ConversationVisibility')

export const uploadAssetKindSchema = z
  .enum(uploadAssetKindValues)
  .openapi('UploadAssetKind')

export const providerIdSchema = z.enum(providerIdValues).openapi('ProviderId')

export const toolCategorySchema = z
  .enum(toolCategoryValues)
  .openapi('ToolCategory')

export const sessionTypeSchema = z
  .enum(sessionTypeValues)
  .openapi('SessionType')

export const healthResponseSchema = z
  .object({
    success: z.literal(true),
    status: z.literal('ok'),
  })
  .openapi('HealthResponse')

export const uploadAssetSchema = z
  .object({
    kind: uploadAssetKindSchema,
    bytes: nonNegativeIntSchema,
    sha256: z.string(),
  })
  .openapi('UploadAsset')

export const conversationSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    visibility: visibilitySchema,
    updatedAt: dateTimeSchema,
  })
  .openapi('ConversationSummary')

export const questionOptionSchema = z
  .object({
    label: z.string(),
    description: z.string(),
    preview: z.string().optional(),
  })
  .openapi('RenderQuestionOption')

export const questionItemSchema = z
  .object({
    question: z.string(),
    header: z.string(),
    options: z.array(questionOptionSchema),
    answer: z.string().optional(),
    notes: z.string().optional(),
    selectedPreview: z.string().optional(),
    multiSelect: z.boolean(),
  })
  .openapi('RenderQuestionItem')

export const toolRunActivitySchema = z
  .object({
    type: z.literal('tool_run'),
    id: z.string(),
    toolUseId: z.string(),
    toolName: z.string(),
    source: z.enum(toolRunSourceValues),
    title: z.string(),
    inputPreview: z.string().optional(),
    outputPreview: z.string().optional(),
    artifactId: z.string().optional(),
    status: z.enum(toolRunStatusValues),
  })
  .openapi('RenderToolRunActivity')

export const hookActivitySchema = z
  .object({
    type: z.literal('hook_event'),
    id: z.string(),
    title: z.string(),
    body: z.string().optional(),
    tone: z.enum(calloutToneValues),
  })
  .openapi('RenderHookActivity')

export const messageBlockSchema = z
  .object({
    type: z.literal('message'),
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  })
  .openapi('RenderMessageBlock')

export const questionBlockSchema = z
  .object({
    type: z.literal('question'),
    id: z.string(),
    title: z.string(),
    questions: z.array(questionItemSchema),
    outcome: z.enum(questionOutcomeValues),
    feedbackText: z.string().optional(),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderQuestionBlock')

export const activityGroupBlockSchema = z
  .object({
    type: z.literal('activity_group'),
    id: z.string(),
    label: z.string(),
    defaultCollapsed: z.boolean(),
    summary: z.string().optional(),
    items: z.array(z.union([toolRunActivitySchema, hookActivitySchema])),
  })
  .openapi('RenderActivityGroupBlock')

export const calloutBlockSchema = z
  .object({
    type: z.literal('callout'),
    id: z.string(),
    tone: z.enum(calloutToneValues),
    title: z.string(),
    body: z.string().optional(),
  })
  .openapi('RenderCalloutBlock')

export const todoSnapshotItemSchema = z
  .object({
    content: z.string(),
    status: z.string(),
    priority: z.string().optional(),
  })
  .openapi('RenderTodoItem')

export const todoSnapshotBlockSchema = z
  .object({
    type: z.literal('todo_snapshot'),
    id: z.string(),
    title: z.string(),
    items: z.array(todoSnapshotItemSchema),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderTodoSnapshotBlock')

export const taskTimelineEntrySchema = z
  .object({
    taskId: z.string(),
    status: z.string(),
    description: z.string(),
    deltaSummary: z.string().nullable().optional(),
  })
  .openapi('RenderTaskTimelineEntry')

export const taskTimelineBlockSchema = z
  .object({
    type: z.literal('task_timeline'),
    id: z.string(),
    title: z.string(),
    entries: z.array(taskTimelineEntrySchema),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderTaskTimelineBlock')

export const resourceBlockSchema = z
  .object({
    type: z.literal('resource'),
    id: z.string(),
    title: z.string(),
    server: z.string().optional(),
    uri: z.string().optional(),
    previewText: z.string().optional(),
    assetId: z.string().optional(),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderResourceBlock')

export const structuredDataBlockSchema = z
  .object({
    type: z.literal('structured_data'),
    id: z.string(),
    title: z.string(),
    data: z.unknown(),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderStructuredDataBlock')

export const briefDeliveryAttachmentSchema = z
  .object({
    label: z.string(),
    assetId: z.string().optional(),
    fileUuid: z.string().optional(),
  })
  .openapi('RenderBriefDeliveryAttachment')

export const briefDeliveryBlockSchema = z
  .object({
    type: z.literal('brief_delivery'),
    id: z.string(),
    title: z.string(),
    message: z.string(),
    attachments: z.array(briefDeliveryAttachmentSchema),
    defaultCollapsed: z.boolean(),
  })
  .openapi('RenderBriefDeliveryBlock')

export const subagentThreadBlockSchema = z
  .object({
    type: z.literal('subagent_thread'),
    id: z.string(),
    title: z.string(),
    defaultCollapsed: z.boolean(),
    blocks: z
      .array(z.unknown())
      .openapi({
        description:
          'Nested render blocks for the delegated subagent thread. The outer document carries the full discriminated block schema.',
      }),
  })
  .openapi('RenderSubagentThreadBlock')

export const compactBoundaryBlockSchema = z
  .object({
    type: z.literal('compact_boundary'),
    id: z.string(),
    text: z.string(),
  })
  .openapi('RenderCompactBoundaryBlock')

export const renderBlockSchema = z.union([
  messageBlockSchema,
  questionBlockSchema,
  activityGroupBlockSchema,
  calloutBlockSchema,
  todoSnapshotBlockSchema,
  taskTimelineBlockSchema,
  resourceBlockSchema,
  structuredDataBlockSchema,
  briefDeliveryBlockSchema,
  subagentThreadBlockSchema,
  compactBoundaryBlockSchema,
])

export const renderDocumentContextSchema = z
  .object({
    currentPlan: z
      .object({
        title: z.string(),
        body: z.string(),
        source: z.enum(['file', 'transcript_recovered']),
        filePath: z.string().optional(),
        artifactId: z.string().optional(),
      })
      .optional(),
  })
  .openapi('RenderDocumentContext')

export const renderDocumentSummarySchema = z
  .object({
    kind: z.literal('render_document'),
    schemaVersion: z.literal(1),
    session: z
      .object({
        sessionId: z.string(),
        title: z.string(),
        provider: z.string(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
        gitBranch: z.string().optional(),
        tag: z.string().optional(),
        stats: z
          .object({
            messageCount: nonNegativeIntSchema,
            toolRunCount: nonNegativeIntSchema,
            activityGroupCount: nonNegativeIntSchema,
          })
          .openapi('RenderSessionStats'),
      })
      .openapi('RenderDocumentSession'),
    context: renderDocumentContextSchema.optional(),
    blocks: z.array(renderBlockSchema),
  })
  .openapi('RenderDocument')

export type RenderDocumentSummary = z.infer<typeof renderDocumentSummarySchema>

// -----------------------------------------------------------------------
// Render block type exports — narrow each member of the discriminated
// union so UI components can import exactly the shape they render.
// -----------------------------------------------------------------------

export type RenderBlock = z.infer<typeof renderBlockSchema>
export type RenderMessageBlock = z.infer<typeof messageBlockSchema>
export type RenderQuestionBlock = z.infer<typeof questionBlockSchema>
export type RenderQuestionItem = z.infer<typeof questionItemSchema>
export type RenderQuestionOption = z.infer<typeof questionOptionSchema>
export type RenderActivityGroupBlock = z.infer<typeof activityGroupBlockSchema>
export type RenderToolRunActivity = z.infer<typeof toolRunActivitySchema>
export type RenderHookActivity = z.infer<typeof hookActivitySchema>
export type RenderCalloutBlock = z.infer<typeof calloutBlockSchema>
export type RenderTodoSnapshotBlock = z.infer<typeof todoSnapshotBlockSchema>
export type RenderTodoItem = z.infer<typeof todoSnapshotItemSchema>
export type RenderTaskTimelineBlock = z.infer<typeof taskTimelineBlockSchema>
export type RenderTaskTimelineEntry = z.infer<typeof taskTimelineEntrySchema>
export type RenderResourceBlock = z.infer<typeof resourceBlockSchema>
export type RenderStructuredDataBlock = z.infer<typeof structuredDataBlockSchema>
export type RenderBriefDeliveryBlock = z.infer<typeof briefDeliveryBlockSchema>
export type RenderBriefDeliveryAttachment = z.infer<typeof briefDeliveryAttachmentSchema>
export type RenderSubagentThreadBlock = z.infer<typeof subagentThreadBlockSchema>
export type RenderCompactBoundaryBlock = z.infer<typeof compactBoundaryBlockSchema>

// -----------------------------------------------------------------------
// Profile type exports. Dashboards, /insights, and the public profile
// page all render narrowed slices of these; exporting the inferred union
// once keeps every consumer on the same source of truth.
// -----------------------------------------------------------------------

export type UserProfile = z.infer<typeof userProfileSchema>
export type UserProfileActivity = z.infer<typeof userProfileActivitySchema>
export type UserProfileDailyActivity = z.infer<typeof userProfileDailyActivitySchema>
export type UserProfileProject = z.infer<typeof userProfileProjectSchema>
export type UserProfileToolcraft = z.infer<typeof userProfileToolcraftSchema>
export type UserProfileProductivity = z.infer<typeof userProfileProductivitySchema>
export type UserProfileModel = z.infer<typeof userProfileModelSchema>
export type UserProfileCost = z.infer<typeof userProfileCostSchema>
export type UserProfileIntegrations = z.infer<typeof userProfileIntegrationsSchema>
export type UserProfileMcpServer = z.infer<typeof userProfileMcpServerSchema>
export type UserProfileSkill = z.infer<typeof userProfileSkillSchema>
export type UserProfileProvider = z.infer<typeof userProfileProviderSchema>
export type ProjectLanguages = z.infer<typeof projectLanguagesSchema>
export type RepoProfile = z.infer<typeof repoProfileSchema>
export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationVisibility = z.infer<typeof visibilitySchema>

export const cliAuthAuthorizeBodySchema = z
  .object({
    callbackUrl: z.url(),
    codeChallenge: z.string().min(16),
    state: z.string().min(8),
  })
  .openapi('CliAuthAuthorizeBody')

export const cliAuthAuthorizeResponseSchema = z
  .object({
    success: z.literal(true),
    redirectUrl: z.url(),
    expiresAt: dateTimeSchema,
  })
  .openapi('CliAuthAuthorizeResponse')

export const cliAuthExchangeBodySchema = z
  .object({
    code: z.string().min(8),
    codeVerifier: z.string().min(16),
  })
  .openapi('CliAuthExchangeBody')

export const cliAuthUserSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
  })
  .openapi('CliAuthUser')

export const cliAuthExchangeResponseSchema = z
  .object({
    success: z.literal(true),
    token: z.string(),
    user: cliAuthUserSchema,
  })
  .openapi('CliAuthExchangeResponse')

export const cliAuthWhoamiResponseSchema = z
  .object({
    success: z.literal(true),
    user: cliAuthUserSchema,
  })
  .openapi('CliAuthWhoamiResponse')

const repositorySummarySchema = z
  .object({
    fullName: z.string().openapi({
      example: 'openai/openai-node',
    }),
    source: z.enum(repositorySourceValues),
  })
  .openapi('ProfileRepositorySummary')

const projectLanguagesSchema = z
  .record(z.string(), nonNegativeIntSchema)
  .openapi('ProfileLanguageBreakdown')

const toolCategoryBreakdownSchema = z
  .object({
    read: nonNegativeIntSchema,
    write: nonNegativeIntSchema,
    search: nonNegativeIntSchema,
    command: nonNegativeIntSchema,
    agent: nonNegativeIntSchema,
    mcp: nonNegativeIntSchema,
    plan: nonNegativeIntSchema,
    question: nonNegativeIntSchema,
    task: nonNegativeIntSchema,
    web: nonNegativeIntSchema,
    other: nonNegativeIntSchema,
  })
  .openapi('ToolCategoryBreakdown')

const sessionTypeDistributionSchema = z
  .object({
    building: nonNegativeIntSchema,
    debugging: nonNegativeIntSchema,
    exploring: nonNegativeIntSchema,
    investigating: nonNegativeIntSchema,
    mixed: nonNegativeIntSchema,
  })
  .openapi('SessionTypeDistribution')

export const userProfileDailyActivitySchema = z
  .object({
    date: dateSchema,
    sessionCount: nonNegativeIntSchema,
    totalDurationMs: nonNegativeIntSchema,
  })
  .openapi('UserProfileDailyActivity')

export const userProfileActivitySchema = z
  .object({
    totalSessions: nonNegativeIntSchema,
    totalDurationMs: nonNegativeIntSchema,
    activeDays: nonNegativeIntSchema,
    currentStreak: nonNegativeIntSchema,
    longestStreak: nonNegativeIntSchema,
    averageSessionDurationMs: nonNegativeIntSchema,
    averageTurnsPerSession: z.number().nonnegative(),
    hourlyDistribution: z.array(nonNegativeIntSchema).length(24),
    weekdayDistribution: z.array(nonNegativeIntSchema).length(7),
    dailyActivity: z.array(userProfileDailyActivitySchema),
    firstSessionAt: dateTimeSchema.optional(),
    lastSessionAt: dateTimeSchema.optional(),
  })
  .openapi('UserProfileActivity')

export const userProfileProjectSchema = z
  .object({
    projectKey: z.string(),
    projectPath: z.string().optional(),
    displayName: z.string(),
    repository: repositorySummarySchema.optional(),
    sessionCount: nonNegativeIntSchema,
    totalDurationMs: nonNegativeIntSchema,
    estimatedCostUsd: z.number().nonnegative(),
    lastActiveAt: dateTimeSchema,
    languages: projectLanguagesSchema,
    branches: z.array(z.string()),
  })
  .openapi('UserProfileProject')

export const userProfileToolcraftSchema = z
  .object({
    totalToolRuns: nonNegativeIntSchema,
    categoryBreakdown: toolCategoryBreakdownSchema,
    errorRate: rateSchema,
    apiErrorCount: nonNegativeIntSchema,
    apiErrorTypes: z.record(z.string(), nonNegativeIntSchema),
    rejectionRate: rateSchema,
    interruptionRate: rateSchema,
    compactionRate: rateSchema,
    planUsageRate: rateSchema,
    agentUsageRate: rateSchema,
    thinkingVisibleRate: rateSchema,
  })
  .openapi('UserProfileToolcraft')

export const userProfileModelSchema = z
  .object({
    model: z.string(),
    sessionCount: nonNegativeIntSchema,
    inputTokens: nonNegativeIntSchema,
    outputTokens: nonNegativeIntSchema,
    estimatedCostUsd: z.number().nonnegative(),
  })
  .openapi('UserProfileModel')

const userProfileMonthlyCostSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    totalUsd: z.number().nonnegative(),
    sessionCount: nonNegativeIntSchema,
  })
  .openapi('UserProfileMonthlyCost')

export const userProfileCostSchema = z
  .object({
    totalUsd: z.number().nonnegative(),
    averagePerSessionUsd: z.number().nonnegative(),
    byMonth: z.array(userProfileMonthlyCostSchema),
  })
  .openapi('UserProfileCost')

const userProfileMcpServerSchema = z
  .object({
    server: z.string(),
    configuredCount: nonNegativeIntSchema,
    usedCount: nonNegativeIntSchema,
    totalToolCalls: nonNegativeIntSchema,
  })
  .openapi('UserProfileMcpServer')

const userProfileSkillSchema = z
  .object({
    name: z.string(),
    sessionCount: nonNegativeIntSchema,
    totalInvocations: nonNegativeIntSchema,
  })
  .openapi('UserProfileSkill')

export const userProfileIntegrationsSchema = z
  .object({
    mcpServers: z.array(userProfileMcpServerSchema),
    skills: z.array(userProfileSkillSchema),
  })
  .openapi('UserProfileIntegrations')

const providerVersionBreakdownSchema = z
  .object({
    version: z.string(),
    sessionCount: nonNegativeIntSchema,
  })
  .openapi('UserProfileProviderVersion')

export const userProfileProviderSchema = z
  .object({
    provider: providerIdSchema,
    sessionCount: nonNegativeIntSchema,
    totalDurationMs: nonNegativeIntSchema,
    estimatedCostUsd: z.number().nonnegative(),
    versions: z.array(providerVersionBreakdownSchema),
  })
  .openapi('UserProfileProvider')

const claudeCodeProviderProfileSchema = z
  .object({
    cacheHitRate: rateSchema.optional(),
    thinkingVisibleRate: rateSchema,
    avgTurnsPerSession: z.number().nonnegative(),
  })
  .openapi('ClaudeCodeProviderProfile')

export const userProfileProductivitySchema = z
  .object({
    totalFilesChanged: nonNegativeIntSchema,
    totalFilesRead: nonNegativeIntSchema,
    uniqueFilesChanged: nonNegativeIntSchema,
    uniqueFilesRead: nonNegativeIntSchema,
    totalGitCommits: nonNegativeIntSchema,
    totalGitPushes: nonNegativeIntSchema,
    totalPrLinks: nonNegativeIntSchema,
    prRepositories: z.array(
      z
        .object({
          repository: z.string(),
          prCount: nonNegativeIntSchema,
        })
        .openapi('UserProfilePrRepository'),
    ),
    languages: projectLanguagesSchema,
    topLanguages: z.array(
      z
        .object({
          language: z.string(),
          fileCount: nonNegativeIntSchema,
        })
        .openapi('UserProfileTopLanguage'),
    ),
    topEditedFiles: z.array(
      z
        .object({
          file: z.string(),
          sessionCount: nonNegativeIntSchema,
        })
        .openapi('UserProfileTopEditedFile'),
    ),
    averageFilesChangedPerSession: z.number().nonnegative(),
    averageFileIterationDepth: z.number().nonnegative(),
    averageTimeToFirstEditMs: nonNegativeIntSchema.optional(),
    sessionTypeDistribution: sessionTypeDistributionSchema,
  })
  .openapi('UserProfileProductivity')

export const userProfileSchema = z
  .object({
    userId: z.string(),
    generatedAt: dateTimeSchema,
    digestCount: nonNegativeIntSchema,
    activity: userProfileActivitySchema,
    projects: z.array(userProfileProjectSchema),
    productivity: userProfileProductivitySchema,
    toolcraft: userProfileToolcraftSchema,
    models: z.array(userProfileModelSchema),
    cost: userProfileCostSchema,
    integrations: userProfileIntegrationsSchema,
    providers: z.array(userProfileProviderSchema),
    providerProfiles: z
      .object({
        claudeCode: claudeCodeProviderProfileSchema.optional(),
      })
      .optional(),
  })
  .openapi('UserProfile')

export const repoProfileSchema = userProfileSchema
  .extend({
    repository: z.string().openapi({
      example: 'openai/openai-node',
    }),
    contributorCount: nonNegativeIntSchema,
    contributors: z.array(
      z
        .object({
          userId: z.string(),
          name: z.string().optional(),
          sessionCount: nonNegativeIntSchema,
        })
        .openapi('RepoProfileContributor'),
    ),
  })
  .openapi('RepoProfile')

export const viewerUserSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    image: z.string().nullable().optional(),
    emailVerified: z.boolean().optional(),
    createdAt: dateTimeSchema.optional(),
    updatedAt: dateTimeSchema.optional(),
    isAnonymous: z.boolean().optional(),
  })
  .openapi('ViewerUser')

export const viewerSessionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    expiresAt: dateTimeSchema,
  })
  .openapi('ViewerSession')
