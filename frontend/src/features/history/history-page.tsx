import { useEffect, useState } from 'react'
import { Check, Clock3, Copy, Search, Trash2 } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip'
import type { HistoryEntry } from '../../../bindings/curldesk/models'

type HistoryPageProps = { entries: HistoryEntry[]; onSearch: (query: string) => void; onClear: () => void }

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function HistoryPage({ entries, onSearch, onClear }: HistoryPageProps) {
  const [query, setQuery] = useState('')
  const [copiedID, setCopiedID] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => onSearch(query), 180); return () => window.clearTimeout(timer) }, [onSearch, query])
  const copyCommand = async (entry: HistoryEntry) => { await navigator.clipboard.writeText(entry.command); setCopiedID(entry.id); window.setTimeout(() => setCopiedID((current) => current === entry.id ? '' : current), 1200) }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-b px-8 py-4">
        <h2 className="text-base font-semibold">Request history</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Local request history is automatically redacted for sensitive-looking values.</p>
      </header>
      <div className="flex items-center gap-2 border-b px-8 py-2.5">
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" aria-label="Search request history" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={onClear} disabled={entries.length === 0}><Trash2 className="size-4" /> Clear</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-8 pt-4">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No matching requests.</div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="h-9 whitespace-nowrap px-3 text-left font-medium">Time</th>
                  <th className="h-9 px-3 text-left font-medium">Request</th>
                  <th className="h-9 px-3 text-left font-medium">Environment</th>
                  <th className="h-9 whitespace-nowrap px-3 text-left font-medium">Result</th>
                  <th className="h-9 whitespace-nowrap px-3 text-right font-medium">Duration</th>
                  <th className="h-9 w-10 px-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const successful = entry.exitCode === 0
                  return (
                    <tr key={entry.id} className="group hover:bg-muted/25">
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs tabular-nums text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{formatDate(entry.createdAt)}</span>
                      </td>
                      <td className="max-w-[34rem] px-3 py-2.5 align-middle">
                        <div className="truncate font-medium" title={entry.filePath || 'Untitled request'}>{entry.filePath || 'Untitled request'}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground" title={entry.command}>{entry.command}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-muted-foreground">{entry.environment || '—'}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 align-middle text-xs font-medium ${successful ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {successful ? `HTTP ${entry.status || 'OK'}` : `Exit ${entry.exitCode}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle font-mono text-xs tabular-nums text-muted-foreground">{entry.durationMs} ms</td>
                      <td className="px-2 py-2 align-middle text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 opacity-60 group-hover:opacity-100" aria-label={copiedID === entry.id ? 'Command copied' : 'Copy command'} onClick={() => void copyCommand(entry)}>
                              {copiedID === entry.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{copiedID === entry.id ? 'Copied' : 'Copy command'}</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
