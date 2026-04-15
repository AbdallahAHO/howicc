export type AssetRef = {
  id: string
  kind:
    | 'source_file'
    | 'tool_output'
    | 'plan_file'
    | 'brief_attachment'
    | 'mcp_blob'
    | 'unknown'
  storage: 'bundle' | 'inline' | 'remote'
  relPath?: string
  mimeType?: string
  sha256?: string
  bytes?: number
  textPreview?: string
  providerData?: Record<string, unknown>
}
