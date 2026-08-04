import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const distDirectory = join(projectRoot, 'dist')
const clientDirectory = join(distDirectory, 'client')
const serverDirectory = join(distDirectory, 'server')
const hostingDirectory = join(distDirectory, '.openai')

await rm(clientDirectory, { recursive: true, force: true })
await rm(serverDirectory, { recursive: true, force: true })
await mkdir(clientDirectory, { recursive: true })
await mkdir(serverDirectory, { recursive: true })

const entries = await readdir(distDirectory, { withFileTypes: true })

for (const entry of entries) {
  if (entry.name === 'client' || entry.name === 'server') continue

  await cp(
    join(distDirectory, entry.name),
    join(clientDirectory, entry.name),
    { recursive: entry.isDirectory() },
  )
}

await cp(
  join(projectRoot, 'sites-worker', 'index.js'),
  join(serverDirectory, 'index.js'),
)

await mkdir(hostingDirectory, { recursive: true })
await cp(
  join(projectRoot, '.openai', 'hosting.json'),
  join(hostingDirectory, 'hosting.json'),
)
