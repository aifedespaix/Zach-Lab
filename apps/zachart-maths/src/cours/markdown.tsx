import type { ReactNode } from 'react'
import { BookOpen, Lightbulb, ListChecks, Pin, Ruler, TriangleAlert, type LucideIcon } from 'lucide-react'
import { renderMathToHtml } from '@suite/shared/math'
import { borderOf, toneOf } from '../exercises/toolbarCatalog'

/**
 * Le Markdown des cours, réduit à ce que les cours utilisent : titres, paragraphes, listes,
 * citations, tableaux, gras, italique, code, et formules `$…$` / `$$…$$` composées par KaTeX.
 * Une citation qui s'ouvre par `> [!definition]` (ou `propriete`, `methode`, `exemple`,
 * `attention`, `retenir`, titre facultatif après l'étiquette) devient un encadré coloré dont le
 * corps est lui-même du Markdown.
 *
 * Écrit ici plutôt que tiré d'une bibliothèque : les cours sont écrits par nous et compilés
 * avec l'app, et le rendu ne produit que des éléments React (jamais de HTML brut venu du
 * texte) — seule la sortie de KaTeX, qui échappe ce qu'il émet, passe par `innerHTML`.
 */
export const CALLOUTS = {
  definition: { label: 'Définition', icon: BookOpen, hue: 215 },
  propriete: { label: 'Propriété', icon: Ruler, hue: 280 },
  methode: { label: 'Méthode', icon: ListChecks, hue: 150 },
  exemple: { label: 'Exemple', icon: Lightbulb, hue: 30 },
  attention: { label: 'Attention', icon: TriangleAlert, hue: 0 },
  retenir: { label: 'À retenir', icon: Pin, hue: 48 },
} as const satisfies Record<string, { label: string; icon: LucideIcon; hue: number }>

export type CalloutKind = keyof typeof CALLOUTS

export type MdBlock =
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'callout'; kind: CalloutKind; title: string; body: MdBlock[] }
  | { t: 'math'; latex: string }
  | { t: 'table'; header: string[]; rows: string[][] }

const CALLOUT_OPEN = /^>\s*\[!([a-zé]+)\]\s*(.*)$/i
const isCalloutKind = (k: string): k is CalloutKind => Object.prototype.hasOwnProperty.call(CALLOUTS, k)

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading !== null) {
      blocks.push({ t: 'h', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() })
      i++
      continue
    }

    if (line.trim().startsWith('$$')) {
      let body = line.trim().slice(2)
      if (body.endsWith('$$') && body.length > 0) {
        body = body.slice(0, -2)
        i++
      } else {
        i++
        while (i < lines.length && !lines[i].includes('$$')) body += '\n' + lines[i++]
        if (i < lines.length) body += '\n' + lines[i++].split('$$')[0]
      }
      blocks.push({ t: 'math', latex: body.trim() })
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') rows.push(splitRow(lines[i++]))
      blocks.push({ t: 'table', header, rows })
      continue
    }

    const list = /^\s*(?:([-*])|(\d+)[.)])\s+/.exec(line)
    if (list !== null) {
      const ordered = list[2] !== undefined
      const items: string[] = []
      const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, '').trim())
      blocks.push({ t: ordered ? 'ol' : 'ul', items })
      continue
    }

    if (line.startsWith('>')) {
      const quote: string[] = []
      const open = CALLOUT_OPEN.exec(line)
      const kind = open === null ? undefined : open[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''))
      if (open !== null && kind !== undefined && isCalloutKind(kind)) {
        blocks.push({ t: 'callout', kind, title: open[2].trim(), body: parseMarkdown(quote.slice(1).join('\n')) })
      } else {
        blocks.push({ t: 'quote', text: quote.join(' ') })
      }
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+[.)]\s|\$\$)/.test(lines[i])) paragraph.push(lines[i++].trim())
    if (paragraph.length === 0) paragraph.push(lines[i++].trim())
    blocks.push({ t: 'p', text: paragraph.join(' ') })
  }
  return blocks
}

const INLINE = /(\$[^$\n]+\$)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)/g

function Formula({ latex, display }: { latex: string; display?: boolean }) {
  return <span dangerouslySetInnerHTML={{ __html: renderMathToHtml(latex, display) }} />
}

function inline(text: string, keyPrefix = ''): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const key = `${keyPrefix}${m.index}`
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<Formula key={key} latex={m[1].slice(1, -1)} />)
    else if (m[2] !== undefined) out.push(<strong key={key}>{inline(m[2].slice(2, -2), key)}</strong>)
    else if (m[3] !== undefined) out.push(<em key={key}>{inline(m[3].slice(1, -1), key)}</em>)
    else out.push(<code key={key}>{m[4].slice(1, -1)}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const HEADING_SIZE = { 1: 18, 2: 15, 3: 14 } as const

const HEADING_STYLE = {
  1: { paddingBottom: 4, borderBottom: `2px solid ${borderOf(215)}` },
  2: { paddingLeft: 8, borderLeft: `4px solid ${borderOf(215)}`, background: toneOf(215), borderRadius: '0 4px 4px 0' },
  3: { color: `color-mix(in oklab, hsl(215 75% 50%) 70%, var(--foreground))` },
} as const

function renderBlocks(blocks: MdBlock[]): ReactNode[] {
  return blocks.map((b, i) => {
        switch (b.t) {
          case 'h': {
            const Tag = `h${b.level + 1}` as 'h2' | 'h3' | 'h4'
            return <Tag key={i} style={{ fontSize: HEADING_SIZE[b.level], fontWeight: 700, margin: '14px 0 6px', ...HEADING_STYLE[b.level] }}>{inline(b.text)}</Tag>
          }
          case 'callout': {
            const { label, icon: Icon, hue } = CALLOUTS[b.kind]
            return (
              <aside key={i} data-callout={b.kind} style={{ margin: '10px 0', borderRadius: 6, border: `1px solid ${borderOf(hue)}`, borderLeftWidth: 4, background: toneOf(hue), padding: '6px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: `color-mix(in oklab, hsl(${hue} 75% 50%) 75%, var(--foreground))` }}>
                  <Icon size={15} aria-hidden />
                  <span>{label}{b.title !== '' && <span style={{ fontWeight: 600 }}> — {inline(b.title)}</span>}</span>
                </div>
                {renderBlocks(b.body)}
              </aside>
            )
          }
          case 'p': return <p key={i} style={{ margin: '6px 0' }}>{inline(b.text)}</p>
          case 'ul':
          case 'ol': {
            const List = b.t
            return (
              <List key={i} style={{ margin: '6px 0', paddingLeft: 22, listStyle: b.t === 'ul' ? 'disc' : 'decimal' }}>
                {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
              </List>
            )
          }
          case 'quote': return <blockquote key={i} style={{ margin: '6px 0', paddingLeft: 10, borderLeft: '3px solid var(--border)' }}>{inline(b.text)}</blockquote>
          case 'math': return <div key={i} style={{ margin: '8px 0', overflowX: 'auto' }}><Formula latex={b.latex} display /></div>
          case 'table': return (
            <table key={i} style={{ borderCollapse: 'collapse', margin: '8px 0' }}>
              <thead><tr>{b.header.map((h, j) => <th key={j} style={{ border: '1px solid var(--border)', padding: '3px 8px', background: toneOf(215) }}>{inline(h)}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ border: '1px solid var(--border)', padding: '3px 8px' }}>{inline(c)}</td>)}</tr>)}</tbody>
            </table>
          )
        }
  })
}

export function Markdown({ source }: { source: string }) {
  return <div style={{ fontSize: 14, lineHeight: 1.55 }}>{renderBlocks(parseMarkdown(source))}</div>
}
