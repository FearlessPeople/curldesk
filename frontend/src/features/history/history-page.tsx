import { useEffect, useState } from 'react'
import { Clock3, Copy, Search, Trash2 } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import type { HistoryEntry } from '../../../bindings/curldesk/models'

type HistoryPageProps = { entries: HistoryEntry[]; onSearch: (query: string) => void; onClear: () => void }

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }

export function HistoryPage({ entries, onSearch, onClear }: HistoryPageProps) {
  const [query, setQuery] = useState('')
  const [copiedID, setCopiedID] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => onSearch(query), 180); return () => window.clearTimeout(timer) }, [onSearch, query])
  const copyCommand = async (entry: HistoryEntry) => { await navigator.clipboard.writeText(entry.command); setCopiedID(entry.id); window.setTimeout(() => setCopiedID((current) => current === entry.id ? '' : current), 1200) }
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><header className="border-b px-8 py-6"><h2 className="text-base font-semibold">Request history</h2><p className="mt-2 text-sm text-muted-foreground">Local request history is automatically redacted for sensitive-looking values.</p></header><div className="flex items-center gap-2 border-b px-8 py-3"><div className="relative min-w-0 max-w-xl flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" aria-label="Search request history" className="pl-9" /></div><Button variant="outline" size="sm" onClick={onClear} disabled={entries.length === 0}><Trash2 className="size-4" /> Clear</Button></div><div className="min-h-0 flex-1 overflow-y-auto p-8">{entries.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No matching requests.</div> : <div className="max-w-4xl space-y-2">{entries.map((entry) => <article key={entry.id} className="rounded-md border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" /><span>{formatDate(entry.createdAt)}</span><span>·</span><span>{entry.environment}</span>{entry.filePath && <><span>·</span><span className="truncate">{entry.filePath}</span></>}<span className="ml-auto">{entry.durationMs} ms</span></div><pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-xs">{entry.command}</pre><div className="mt-2 flex items-center gap-2 text-xs"><span className={entry.exitCode === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{entry.exitCode === 0 ? `HTTP ${entry.status || 'OK'}` : `Exit ${entry.exitCode}`}</span><Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => void copyCommand(entry)}><Copy className="size-3.5" /> {copiedID === entry.id ? 'Copied' : 'Copy command'}</Button></div></article>)}</div>}</div></div>
}
