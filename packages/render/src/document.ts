import type { RenderBlock } from './block'

export type RenderDocument = {
  kind: 'render_document'
  schemaVersion: 1
  session: {
    sessionId: string
    title: string
    provider: string
    createdAt: string
    updatedAt: string
    gitBranch?: string
    tag?: string
    stats: {
      messageCount: number
      toolRunCount: number
      activityGroupCount: number
    }
  }
  context?: {
    currentPlan?: {
      title: string
      body: string
      source: 'file' | 'transcript_recovered'
      filePath?: string
      artifactId?: string
    }
  }
  blocks: RenderBlock[]
}
