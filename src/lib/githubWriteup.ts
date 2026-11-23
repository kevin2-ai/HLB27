type GitHubContentResponse = { type?: string; size?: number }

export type WriteupCheck = { ok: true; url: string } | { ok: false; message: string }

export async function verifyGitHubWriteup(value: string): Promise<WriteupCheck> {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return { ok: false, message: 'Colle un lien GitHub valide vers ton write-up.' }
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port) {
    return { ok: false, message: 'Le lien doit pointer vers github.com en HTTPS.' }
  }

  let parts: string[]
  try {
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return { ok: false, message: 'Le chemin du lien GitHub est invalide.' }
  }
  if (parts.length < 5 || parts[2] !== 'blob' || parts.some((part) => part === '.' || part === '..' || part.includes('/'))) {
    return { ok: false, message: 'Utilise le lien direct d’un fichier .md : github.com/propriétaire/dépôt/blob/main/writeups/fichier.md.' }
  }

  const [owner, repo, , branch, ...fileParts] = parts
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo) || !/^[A-Za-z0-9._-]+$/.test(branch) || !fileParts.join('/').toLowerCase().endsWith('.md')) {
    return { ok: false, message: 'Le lien doit cibler un fichier Markdown (.md) dans un dépôt GitHub public.' }
  }

  const apiPath = fileParts.map(encodeURIComponent).join('/')
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`
  try {
    const response = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    if (response.status === 404) return { ok: false, message: 'Ce dépôt, cette branche ou ce fichier write-up est introuvable ou privé.' }
    if (response.status === 403) return { ok: false, message: 'GitHub limite temporairement les vérifications. Réessaie dans quelques minutes.' }
    if (!response.ok) return { ok: false, message: 'GitHub n’a pas pu vérifier ce lien. Réessaie plus tard.' }
    const content = await response.json() as GitHubContentResponse
    if (content.type !== 'file' || !content.size) return { ok: false, message: 'Le lien doit pointer vers un fichier Markdown non vide.' }
    return { ok: true, url: url.href }
  } catch {
    return { ok: false, message: 'Impossible de joindre GitHub pour vérifier le write-up. Vérifie ta connexion.' }
  }
}
