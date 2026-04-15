export const releaseSurfaces = {
  api: {
    key: 'api',
    displayName: 'HowiCC API',
    packageName: '@howicc/api',
    packageJsonPath: 'apps/api/package.json',
    changelogPath: 'apps/api/CHANGELOG.md',
    tagPrefix: 'api-v',
    impactPaths: [
      'apps/api/',
      'packages/auth/',
      'packages/canonical/',
      'packages/contracts/',
      'packages/db/',
      'packages/model-pricing/',
      'packages/profile/',
      'packages/storage/',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'turbo.json',
      'tooling/',
    ],
  },
  web: {
    key: 'web',
    displayName: 'HowiCC Web',
    packageName: '@howicc/web',
    packageJsonPath: 'apps/web/package.json',
    changelogPath: 'apps/web/CHANGELOG.md',
    tagPrefix: 'web-v',
    impactPaths: [
      'apps/web/',
      'packages/api-client/',
      'packages/auth/',
      'packages/contracts/',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'turbo.json',
      'tooling/',
    ],
  },
  cli: {
    key: 'cli',
    displayName: 'HowiCC CLI',
    packageName: 'howicc',
    packageJsonPath: 'apps/cli/package.json',
    changelogPath: 'apps/cli/CHANGELOG.md',
    tagPrefix: 'cli-v',
    impactPaths: [
      'apps/cli/',
      'packages/api-client/',
      'packages/canonical/',
      'packages/model-pricing/',
      'packages/parser-core/',
      'packages/privacy/',
      'packages/profile/',
      'packages/provider-claude-code/',
      'packages/provider-shared-artifacts/',
      'packages/render/',
      'packages/storage/',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'turbo.json',
      'tooling/',
    ],
  },
  jobs: {
    key: 'jobs',
    displayName: 'HowiCC Jobs',
    packageName: '@howicc/jobs',
    packageJsonPath: 'apps/jobs/package.json',
    changelogPath: 'apps/jobs/CHANGELOG.md',
    tagPrefix: 'jobs-v',
    impactPaths: [
      'apps/jobs/',
      'packages/auth/',
      'packages/db/',
      'packages/storage/',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'turbo.json',
      'tooling/',
    ],
  },
}

const pathMatchesRule = (filePath, rule) =>
  rule.endsWith('/') ? filePath.startsWith(rule) : filePath === rule

export const getReleaseSurface = (surfaceKey) => {
  const surface = releaseSurfaces[surfaceKey]

  if (!surface) {
    throw new Error(`Unknown release surface: ${surfaceKey}`)
  }

  return surface
}

export const getChangedSurfaces = (changedFiles) =>
  Object.values(releaseSurfaces)
    .filter((surface) =>
      changedFiles.some((filePath) =>
        surface.impactPaths.some((rule) => pathMatchesRule(filePath, rule)),
      ),
    )
    .map((surface) => surface.key)
