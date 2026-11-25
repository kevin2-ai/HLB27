const REQUIRED_PREFIX = 'https://github.com/kevin2-ai/HLB-write-up/'

export type WriteupCheck = { ok: true; url: string } | { ok: false; message: string }

export async function verifyGitHubWriteup(value: string): Promise<WriteupCheck> {
  const candidate = value.trim()
  if (!candidate.startsWith(REQUIRED_PREFIX)) {
    return { ok: false, message: `Le lien doit commencer exactement par ${REQUIRED_PREFIX}` }
  }
  if (!candidate.endsWith('.md')) {
    return { ok: false, message: 'Le lien doit se terminer exactement par .md.' }
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password || parsed.port) {
      return { ok: false, message: 'Le lien GitHub n’est pas valide.' }
    }
  } catch {
    return { ok: false, message: 'Colle l’adresse GitHub directement, sans crochets ni mise en forme Markdown.' }
  }

  return { ok: true, url: candidate }
}
