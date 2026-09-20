import { useMemo, useState } from 'react'
import { ClipboardCopy, FilePlus2, Search, Terminal } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { copyText } from '@/lib/clipboard'

export type CurlTutorial = {
  id: string
  category: string
  title: string
  summary: string
  command: string
  notes: { option: string; description: string }[]
}

const tutorials: CurlTutorial[] = [
  {
    id: 'get', category: 'Basics', title: 'Make a GET request', summary: 'Fetch a resource and print the response body.',
    command: "curl --url 'https://httpbin.org/get'",
    notes: [{ option: '--url', description: 'The address to request.' }],
  },
  {
    id: 'post-json', category: 'Basics', title: 'Send JSON data', summary: 'Create a POST request with a JSON request body.',
    command: `curl --request POST \\
  --url 'https://httpbin.org/post' \\
  --header 'content-type: application/json' \\
  --data-raw '{
  "name": "CurlDesk",
  "active": true
}'`,
    notes: [
      { option: '--request POST', description: 'Use the POST method.' },
      { option: '--data-raw', description: 'Send the JSON request body.' },
    ],
  },
  {
    id: 'headers', category: 'Headers & auth', title: 'Add request headers', summary: 'Send content negotiation or tracing headers with a request.',
    command: `curl --url 'https://httpbin.org/headers' \\
  --header 'accept: application/json' \\
  --header 'x-request-id: {{REQUEST_ID}}'`,
    notes: [{ option: '--header', description: 'Add one HTTP header. Repeat it for multiple headers.' }],
  },
  {
    id: 'bearer', category: 'Headers & auth', title: 'Use a Bearer token', summary: 'Keep the token in the active environment instead of hard-coding it.',
    command: `curl --url 'https://api.example.com/profile' \\
  --header 'authorization: Bearer {{API_TOKEN}}'`,
    notes: [{ option: '{{API_TOKEN}}', description: 'Create API_TOKEN in Environment settings before running.' }],
  },
  {
    id: 'query', category: 'Requests', title: 'Add query parameters', summary: 'Pass filters and pagination values in the URL.',
    command: "curl --url 'https://api.example.com/items?limit=20&offset=0'",
    notes: [{ option: '?limit=20', description: 'Query parameters are part of the request URL.' }],
  },
  {
    id: 'upload', category: 'Files', title: 'Upload a file', summary: 'Send a local file as multipart form data.',
    command: `curl --request POST \\
  --url 'https://httpbin.org/post' \\
  --form 'file=@./example.txt'`,
    notes: [{ option: '--form', description: 'Build a multipart form request. Use @ before a local file path.' }],
  },
  {
    id: 'download', category: 'Files', title: 'Download a file', summary: 'Save the response to a local file instead of printing it.',
    command: "curl --url 'https://httpbin.org/image/png' --output './response.png'",
    notes: [{ option: '--output', description: 'Write the response body to the specified path.' }],
  },
  {
    id: 'debug', category: 'Debugging', title: 'Inspect response headers', summary: 'Show response headers while keeping the response body visible.',
    command: "curl --include --url 'https://httpbin.org/get'",
    notes: [{ option: '--include', description: 'Include response headers in the output.' }],
  },
  {
    id: 'timeout', category: 'Debugging', title: 'Set a timeout', summary: 'Stop waiting when a server does not respond in time.',
    command: "curl --connect-timeout 10 --max-time 30 --url 'https://httpbin.org/delay/2'",
    notes: [
      { option: '--connect-timeout', description: 'Maximum time to establish a connection.' },
      { option: '--max-time', description: 'Maximum time for the complete request.' },
    ],
  },
]

type TutorialsPageProps = { onCreateCurl: (tutorial: CurlTutorial) => void }

export function TutorialsPage({ onCreateCurl }: TutorialsPageProps) {
  const [query, setQuery] = useState('')
  const [selectedID, setSelectedID] = useState(tutorials[0].id)
  const [copied, setCopied] = useState(false)
  const selected = tutorials.find((tutorial) => tutorial.id === selectedID) || tutorials[0]
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = normalized
      ? tutorials.filter((tutorial) => `${tutorial.title} ${tutorial.summary} ${tutorial.category} ${tutorial.command}`.toLowerCase().includes(normalized))
      : tutorials
    return filtered.reduce<Record<string, CurlTutorial[]>>((result, tutorial) => {
      result[tutorial.category] = [...(result[tutorial.category] || []), tutorial]
      return result
    }, {})
  }, [query])

  const selectTutorial = (tutorial: CurlTutorial) => {
    setSelectedID(tutorial.id)
    setCopied(false)
  }

  const copyCommand = async () => {
    await copyText(selected.command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-60 shrink-0 border-r bg-background p-3 md:flex md:flex-col">
        <div className="mb-3 px-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Terminal className="size-4 text-primary" /> Curl tutorials</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Short, practical examples for everyday curl work.</p>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tutorials" aria-label="Search tutorials" className="h-8 pl-8 text-xs" />
        </div>
        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{category}</div>
              <div className="space-y-0.5">
                {items.map((tutorial) => (
                  <Button key={tutorial.id} variant="ghost" className="h-auto w-full justify-start px-2 py-1.5 text-left text-xs" data-active={selected.id === tutorial.id} onClick={() => selectTutorial(tutorial)}>
                    <span className={`size-1.5 shrink-0 rounded-full ${selected.id === tutorial.id ? 'bg-primary' : 'bg-border'}`} />
                    <span className="truncate">{tutorial.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groups).length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No tutorials found.</div>}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{selected.category}</div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{selected.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{selected.summary}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={() => void copyCommand()}><ClipboardCopy className="size-3.5" />{copied ? 'Copied' : 'Copy command'}</Button>
              <Button size="sm" onClick={() => onCreateCurl(selected)}><FilePlus2 className="size-3.5" />Create curl file</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-1 shadow-sm">
            <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs leading-6 text-foreground"><code>{selected.command}</code></pre>
          </div>
          <div className="mt-3 flex gap-2 sm:hidden">
            <Button variant="outline" size="sm" onClick={() => void copyCommand()}><ClipboardCopy className="size-3.5" />{copied ? 'Copied' : 'Copy command'}</Button>
            <Button size="sm" onClick={() => onCreateCurl(selected)}><FilePlus2 className="size-3.5" />Create curl file</Button>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to know</div>
            <div className="divide-y">
              {selected.notes.map((note) => (
                <div key={note.option} className="grid gap-1 py-3 sm:grid-cols-[minmax(150px,0.35fr)_1fr] sm:gap-5">
                  <code className="font-mono text-xs text-primary">{note.option}</code>
                  <p className="text-sm text-muted-foreground">{note.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
