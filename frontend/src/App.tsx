import { Check, Copy, Github, LayoutPanelLeft, LayoutPanelTop, X } from 'lucide-react'
import { Browser } from '@wailsio/runtime'
import { Events } from '@wailsio/runtime'
import { Window } from '@wailsio/runtime'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/button'
import { CurlEditor } from '@/components/curl-editor'
import { OutputEditor } from '@/components/output-editor'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/resizable'
import { CurlRunner, WorkspaceService } from '../bindings/curldesk'
import type { WorkspaceEntry } from '../bindings/curldesk'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
const CURL_STREAM_EVENT = 'curldesk:curl:chunk'

function detectMethod(command: string): RequestMethod {
  const explicitMethod = command.match(/(?:^|\s)(?:-X|--request)\s+["']?([A-Za-z]+)["']?/i)?.[1].toUpperCase()
  if (explicitMethod && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(explicitMethod)) {
    return explicitMethod as RequestMethod
  }
  if (/(?:^|\s)(?:-d|--data(?:-raw|-binary)?|--form)\b/i.test(command)) return 'POST'
  return 'GET'
}

function methodColor(method: RequestMethod) {
  if (method === 'GET') return 'text-emerald-600 dark:text-emerald-400'
  if (method === 'DELETE') return 'text-red-600 dark:text-red-400'
  if (method === 'PUT' || method === 'PATCH') return 'text-amber-600 dark:text-amber-400'
  return 'text-purple-600 dark:text-purple-400'
}

function extractRequestBlock(command: string, startLine: number) {
  const lines = command.split('\n')
  const startIndex = Math.max(0, startLine - 1)
  const endIndex = lines.findIndex((line, index) => index > startIndex && /^\s*curl\b/i.test(line))
  return lines.slice(startIndex, endIndex === -1 ? lines.length : endIndex).join('\n').trim()
}

function formatOutput(output: string) {
  if (!output) return ''
  try {
    return JSON.stringify(JSON.parse(output), null, 2)
  } catch {
    return output
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-emerald-600 dark:text-emerald-400'
  if (status >= 300 && status < 400) return 'text-sky-600 dark:text-sky-400'
  if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400'
  if (status >= 500) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

export default function App() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [requests, setRequests] = useState<{ value: string; label: string; command: string }[]>([])
  const [activeRequest, setActiveRequest] = useState('')
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved'>>({})
  const [runOutput, setRunOutput] = useState('')
  const [runStatus, setRunStatus] = useState<'ready' | 'running' | 'failed'>('ready')
  const [runningLine, setRunningLine] = useState<number | null>(null)
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [outputView, setOutputView] = useState<'response' | 'headers'>('response')
  const [runInfo, setRunInfo] = useState<{ status: number; durationMs: number; requestSize: number; responseSize: number; headers: string } | null>(null)
  const runId = useRef(0)
  const activeStreamId = useRef('')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayOutput = formatOutput(runOutput || 'Run a curl command to see output here.')

  const copyOutput = async () => {
    if (!runOutput) return
    try {
      await navigator.clipboard.writeText(displayOutput)
      setCopiedOutput(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopiedOutput(false), 1400)
    } catch (error) {
      console.error('Unable to copy output', error)
    }
  }

  const syncOpenRequests = async () => {
    try {
      const entries = (await WorkspaceService.ListWorkspace()) ?? []
      const filePaths = new Set(entries.filter((entry) => !entry.isDir).map((entry) => entry.path))
      setRequests((current) => {
        const next = current.filter((request) => filePaths.has(request.value))
        setActiveRequest((active) => filePaths.has(active) ? active : next[0]?.value ?? '')
        return next
      })
    } catch (error) {
      console.error('Unable to sync open requests', error)
    }
  }

  useEffect(() => {
    void syncOpenRequests()
    const unsubscribe = Events.On('curldesk:collections-changed', () => { void syncOpenRequests() })
    return unsubscribe
  }, [])

  useEffect(() => Events.On(CURL_STREAM_EVENT, (event) => {
    const data = event.data as { runId?: string; chunk?: string } | undefined
    if (!data || data.runId !== activeStreamId.current || !data.chunk) return
    setRunOutput((current) => current + data.chunk)
  }), [])

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer))
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  const openFile = async (entry: WorkspaceEntry) => {
    try {
      const command = await WorkspaceService.ReadFile(entry.path)
      setRequests((current) => current.some((request) => request.value === entry.path)
        ? current.map((request) => request.value === entry.path ? { ...request, command } : request)
        : [...current, { value: entry.path, label: entry.name, command }])
      setActiveRequest(entry.path)
    } catch (error) {
      console.error('Unable to open curl file', error)
    }
  }

  const closeRequest = (value: string) => {
    if (requests.length === 1) return
    const index = requests.findIndex((request) => request.value === value)
    const nextRequests = requests.filter((request) => request.value !== value)
    setRequests(nextRequests)
    if (activeRequest === value) {
      setActiveRequest(nextRequests[Math.max(0, index - 1)]?.value ?? nextRequests[0].value)
    }
  }

  const updateCommand = (value: string, command: string) => {
    setRequests((current) => current.map((request) => request.value === value ? { ...request, command } : request))
    if (!/\.curl$/i.test(value)) return
    setSaveStatus((current) => ({ ...current, [value]: 'saving' }))
    clearTimeout(saveTimers.current[value])
    saveTimers.current[value] = setTimeout(async () => {
      try {
        await WorkspaceService.SaveFile(value, command)
        await Events.Emit('curldesk:collections-changed')
        setSaveStatus((current) => ({ ...current, [value]: 'saved' }))
      } catch (error) {
        console.error('Unable to save curl file', error)
      }
    }, 600)
  }

  const runRequestBlock = async (command: string, startLine: number) => {
    if (!activeRequest || runStatus === 'running') return
    const requestBlock = extractRequestBlock(command, startLine)
    if (!requestBlock) return
    const currentRunId = ++runId.current
    const streamId = `${Date.now()}-${currentRunId}`
    activeStreamId.current = streamId
    setRunOutput('')
    setRunInfo(null)
    setOutputView('response')
    setRunStatus('running')
    setRunningLine(startLine)
    try {
      const result = await CurlRunner.RunCurlStream(requestBlock, streamId)
      if (runId.current !== currentRunId) return
      setRunOutput(result.output || `Process exited with code ${result.exitCode}.`)
      setRunInfo({
        status: result.status,
        durationMs: result.durationMs,
        requestSize: result.requestSize,
        responseSize: result.responseSize,
        headers: result.responseHeaders,
      })
      setRunStatus(result.exitCode === 0 ? 'ready' : 'failed')
      setRunningLine(null)
    } catch (error) {
      if (runId.current !== currentRunId) return
      console.error('Unable to run curl command', error)
      setRunOutput(error instanceof Error ? error.message : 'Unable to run curl command.')
      setRunStatus('failed')
      setRunningLine(null)
    }
  }

  const stopRequest = async () => {
    if (runStatus !== 'running') return
    runId.current += 1
    activeStreamId.current = ''
    setRunningLine(null)
    setRunStatus('ready')
    setRunOutput('Request stopped.')
    setRunInfo(null)
    try {
      await CurlRunner.StopCurl()
    } catch (error) {
      console.error('Unable to stop curl command', error)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header
        className="flex h-9 shrink-0 items-center justify-center border-b"
        style={{ '--wails-draggable': 'drag' } as CSSProperties}
        onDoubleClick={() => void Window.ToggleMaximise()}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <img src="/appicon.svg" alt="" className="size-5 rounded-md" />
          CurlDesk
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <SidebarProvider className="!min-h-0 h-full">
          <AppSidebar onOpenFile={openFile} />
          <SidebarInset>
            <Tabs value={activeRequest} onValueChange={setActiveRequest} className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <TabsList className="min-w-0 flex-1 justify-start gap-1 overflow-x-auto bg-transparent p-0 pr-24">
                {requests.map((request) => {
                  const method = detectMethod(request.command)
                  return (
                    <TabsTrigger key={request.value} value={request.value} className="group gap-1 px-2 data-[state=active]:ring-1 data-[state=active]:ring-primary/25">
                      <span className={`font-mono text-[10px] font-semibold ${methodColor(method)}`}>{method}</span>
                      <span>{request.label.replace(/\.curl$/i, '')}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Close ${request.label}`}
                        className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-slate-200 group-hover:opacity-100 group-data-[state=active]:opacity-70 dark:hover:bg-slate-800"
                        onClick={(event) => { event.stopPropagation(); closeRequest(request.value) }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            closeRequest(request.value)
                          }
                        }}
                      >
                        <X className="size-3" />
                      </span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </div>

            {requests.length === 0 && (
              <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                Open a curl file from Collections to start.
              </div>
            )}

            {requests.map((request) => (
              <TabsContent key={request.value} value={request.value} className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                <ResizablePanelGroup orientation={layout} className="min-h-0 flex-1">
                  <ResizablePanel defaultSize="68%" minSize="24%" className="resizable-panel min-w-0 overflow-hidden">
                    <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
                      <CurlEditor
                        value={request.command}
                        onChange={(command) => updateCommand(request.value, command)}
                        onRun={(command, lineNumber) => void runRequestBlock(command, lineNumber)}
                        onStop={() => void stopRequest()}
                        runningLine={request.value === activeRequest ? runningLine : null}
                      />
                    </section>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize="32%" minSize="18%" className="resizable-panel min-w-0 overflow-hidden">
                    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <div className="relative flex h-10 min-w-0 shrink-0 items-center border-t px-4">
                        <div className="flex min-w-0 shrink-0 items-center gap-3">
                          <div className="text-sm font-medium">Output</div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant={outputView === 'response' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setOutputView('response')}
                            >
                              Response
                            </Button>
                            <Button
                              variant={outputView === 'headers' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setOutputView('headers')}
                            >
                              Headers
                            </Button>
                          </div>
                        </div>
                        <div className="absolute right-4 top-1/2 z-10 flex min-w-0 -translate-y-1/2 items-center gap-2 bg-background pl-2">
                          {runInfo && (
                            <div className="mr-1 hidden items-center gap-2 text-[11px] text-muted-foreground 2xl:flex">
                              <span className={statusColor(runInfo.status)}>HTTP {runInfo.status || '—'}</span>
                              <span>{runInfo.durationMs} ms</span>
                              <span>↑ {formatBytes(runInfo.requestSize)}</span>
                              <span>↓ {formatBytes(runInfo.responseSize)}</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-md"
                            aria-label="复制输出"
                            onClick={() => void copyOutput()}
                            disabled={!runOutput}
                          >
                            {copiedOutput ? <Check /> : <Copy />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 shrink-0 rounded-md ${layout === 'vertical' ? 'bg-muted text-foreground' : ''}`}
                            aria-label="上下布局"
                            aria-pressed={layout === 'vertical'}
                            onClick={() => setLayout('vertical')}
                          >
                            <LayoutPanelTop />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 shrink-0 rounded-md ${layout === 'horizontal' ? 'bg-muted text-foreground' : ''}`}
                            aria-label="左右布局"
                            aria-pressed={layout === 'horizontal'}
                            onClick={() => setLayout('horizontal')}
                          >
                            <LayoutPanelLeft />
                          </Button>
                          <span className={`shrink-0 text-xs ${runStatus === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {runStatus === 'running' ? 'Running…' : runStatus === 'failed' ? 'Failed' : saveStatus[request.value] === 'saving' ? 'Saving…' : saveStatus[request.value] === 'saved' ? 'Saved' : 'Ready'}
                          </span>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 overflow-hidden">
                        <OutputEditor
                          key={outputView}
                          value={outputView === 'response' ? displayOutput : formatOutput(runInfo?.headers || 'No response headers yet.')}
                          mode={outputView}
                        />
                      </div>
                    </section>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>
            ))}
            </Tabs>
          </SidebarInset>
        </SidebarProvider>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t px-4 text-xs text-muted-foreground">
        <span>Workspace ready</span>
        <a
          href="https://github.com/FearlessPeople/curldesk"
          onClick={(event) => {
            event.preventDefault()
            void Browser.OpenURL('https://github.com/FearlessPeople/curldesk')
          }}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Github className="size-3.5" /> GitHub
        </a>
        <span className="ml-auto">UTF-8</span>
      </footer>
    </div>
  )
}
