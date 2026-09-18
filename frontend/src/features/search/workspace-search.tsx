import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { WorkspaceService } from '../../../bindings/curldesk'
import type { WorkspaceEntry, WorkspaceSearchResult } from '../../../bindings/curldesk/models'

type WorkspaceSearchProps = {
  onOpenFile: (entry: WorkspaceEntry) => void
}

export function WorkspaceSearch({ onOpenFile }: WorkspaceSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WorkspaceSearchResult[]>([])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      try {
        setResults((await WorkspaceService.SearchWorkspace(query)) ?? [])
      } catch (error) {
        console.error('Unable to search workspace', error)
        setResults([])
      }
    }, 180)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <div className="relative px-2 py-3">
      <Search className="pointer-events-none absolute left-4 top-2.5 size-3.5 text-muted-foreground" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" aria-label="Search workspace" className="h-8 pl-8 text-xs" />
      {query.trim() && (
        <div className="absolute inset-x-2 top-11 z-30 max-h-64 overflow-y-auto rounded-md border bg-background p-1 shadow-lg">
          {results.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">No matches.</div>
          ) : results.map((result) => (
            <Button
              key={`${result.path}:${result.line}`}
              variant="ghost"
              className="h-auto w-full justify-start px-2 py-1.5 text-left text-xs"
              onClick={() => {
                onOpenFile({ path: result.path, name: result.name, folder: '', isDir: false, size: 0 })
                setQuery('')
              }}
            >
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{result.name}</span><span className="ml-1 text-muted-foreground">{result.line > 0 ? `:${result.line}` : ''} {result.snippet}</span></span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
