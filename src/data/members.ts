export type Member = {
  key: string
  name: string
  pseudo: string
  main: string
  secondary: string
  role: 'admin' | 'member'
  optionalModule?: string
}

export const MEMBERS: Member[] = [
  { key: 'kevin', name: 'Kevin', pseudo: 'H4ck4tsuk1', main: 'reverse', secondary: 'stegano', role: 'admin', optionalModule: 'pwn' },
  { key: 'achille', name: 'Achille', pseudo: 'Sn@k3w3b', main: 'web', secondary: 'reseau_ad', role: 'member' },
  { key: 'brave', name: 'Brave', pseudo: 'BlackGod-br', main: 'osint', secondary: 'forensics', role: 'member' },
  { key: 'olayinka', name: 'Olayinka', pseudo: 'Dark_m3dv', main: 'osint', secondary: 'forensics', role: 'member' },
  { key: 'moucharaf', name: 'Moucharaf', pseudo: 'Ghostwire', main: 'crypto', secondary: 'forensics', role: 'member' },
  { key: 'josias', name: 'Josias', pseudo: 'Josias', main: 'web', secondary: 'crypto', role: 'member' },
]

export const SPECIALTY_LABELS: Record<string, string> = {
  reverse: 'Reverse engineering', stegano: 'Stéganographie', web: 'Web',
  reseau_ad: 'Réseau et Active Directory', osint: 'OSINT',
  forensics: 'Forensics', crypto: 'Cryptographie', pwn: 'Système / pwn',
}
