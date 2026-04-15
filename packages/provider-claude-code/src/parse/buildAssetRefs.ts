import type { AssetRef } from '@howicc/canonical'
import { createSourceRevisionHash, type SourceBundle } from '@howicc/parser-core'
import { readUtf8Preview } from '../fs'

export const buildAssetRefs = async (bundle: SourceBundle): Promise<AssetRef[]> =>
  Promise.all(
    bundle.files.map(async file => ({
      id: createAssetId(file.relPath, file.sha256),
      kind: mapSourceFileKindToAssetKind(file.kind),
      storage: 'bundle' as const,
      relPath: file.relPath,
      mimeType: file.mimeType,
      sha256: file.sha256,
      bytes: file.bytes,
      textPreview: await readTextPreviewForAsset(file.absolutePath, file.mimeType),
      providerData: {
        absolutePath: file.absolutePath,
      },
    })),
  )

export const createAssetId = (relPath: string, sha256: string): string =>
  `asset:${createSourceRevisionHash([relPath, sha256]).slice(0, 16)}`

const mapSourceFileKindToAssetKind = (
  kind: SourceBundle['files'][number]['kind'],
): AssetRef['kind'] => {
  switch (kind) {
    case 'tool_result':
      return 'tool_output'
    case 'plan_file':
    case 'recovered_plan':
      return 'plan_file'
    default:
      return 'source_file'
  }
}

const readTextPreviewForAsset = async (
  absolutePath: string,
  mimeType?: string,
): Promise<string | undefined> => {
  if (mimeType && !mimeType.startsWith('text/') && !mimeType.includes('json')) {
    return undefined
  }

  return readUtf8Preview(absolutePath)
}
