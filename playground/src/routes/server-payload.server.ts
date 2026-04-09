import { createHash } from 'node:crypto'

export type ServerPayloadData = {
  generatedAt: string
  helperPath: string
  signature: string
}

export async function getServerPayloadData(): Promise<ServerPayloadData> {
  const generatedAt = new Date().toISOString()

  return {
    generatedAt,
    helperPath: 'src/routes/server-payload.server.ts',
    signature: createHash('sha1').update(generatedAt).digest('hex').slice(0, 10),
  }
}