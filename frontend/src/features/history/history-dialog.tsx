import { useEffect, useState } from 'react'
import { Clock3, Copy, Search, Trash2 } from 'lucide-react'

import { Button } from '@/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog'
import { Input } from '@/components/input'
import type { HistoryEntry } from '../../../bindings/curldesk/models'

type HistoryDialogProps = {
  open: boolean
  entries: HistoryEntry[]
  onOpenChange: (open: boolean) => void
  onSearch: (query: string) => void
  onClear: () => void
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function HistoryDialog({ open, entries, onOpenChange, onSearch, onClear }: HistoryDialogProps) {
  const [query, setQuery] = useState('')
  const [copiedID, setCopiedID] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(query), 180)
    return () => window.clearTimeout(timer)
  }, [onSearch, query])

  const copyCommand = async (entry: HistoryEntry) => {
    await navigator.clipboard.writeText(entry.command)
    setCopiedID(entry.id)
    window.setTimeout(() => setCopiedID((current) => current === entry.id ? '' : current), 1200)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[620px] max-w-[900px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Request history</DialogTitle>
          <DialogDescription>Local request history is automatically redacted for sensitive-looking values.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-6 py-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" aria-label="Search request history" className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={onClear} disabled={entries.length === 0}>
            <Trash2 className="size-4" /> Clear
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No matching requests.</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    <span>{formatDate(entry.createdAt)}</span>
                    <span>·</span>
                    <span>{entry.environment}</span>
                    {entry.filePath && <><span>·</span><span className="truncate">{entry.filePath}</span></>}
                    <span className="ml-auto">{entry.durationMs} ms</span>
                  </div>
                  <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-xs">{entry.command}</pre>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={entry.exitCode === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {entry.exitCode === 0 ? `HTTP ${entry.status || 'OK'}` : `Exit ${entry.exitCode}`}
                    </span>
                    <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => void copyCommand(entry)}>
                      <Copy className="size-3.5" /> {copiedID === entry.id ? 'Copied' : 'Copy command'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
