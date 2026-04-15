export const buildRevisionStoragePrefix = (
  conversationId: string,
  revisionHash: string,
): string => `conversations/${conversationId}/${revisionHash}`

export const buildSourceBundleKey = (
  conversationId: string,
  revisionHash: string,
): string => `${buildRevisionStoragePrefix(conversationId, revisionHash)}/source-bundle.tar.gz`

export const buildCanonicalKey = (
  conversationId: string,
  revisionHash: string,
): string => `${buildRevisionStoragePrefix(conversationId, revisionHash)}/canonical.json.gz`

export const buildRenderKey = (
  conversationId: string,
  revisionHash: string,
): string => `${buildRevisionStoragePrefix(conversationId, revisionHash)}/render.json.gz`

export const buildArtifactKey = (
  conversationId: string,
  revisionHash: string,
  artifactId: string,
): string => `${buildRevisionStoragePrefix(conversationId, revisionHash)}/artifacts/${artifactId}`
