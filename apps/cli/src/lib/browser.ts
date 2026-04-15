import { spawn } from 'node:child_process'

export const openExternalUrl = async (url: string): Promise<void> => {
  const platform = process.platform
  const command =
    platform === 'darwin'
      ? 'open'
      : platform === 'win32'
        ? 'cmd'
        : 'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', reject)
    child.unref()
    resolve()
  })
}
