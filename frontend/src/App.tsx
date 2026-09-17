import { Github, LayoutPanelLeft, LayoutPanelTop, Play, X } from 'lucide-react'
import { Browser } from '@wailsio/runtime'
import { Events } from '@wailsio/runtime'
import { Window } from '@wailsio/runtime'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/resizable'
import { WorkspaceService } from '../bindings/curldesk'
import type { WorkspaceEntry } from '../bindings/curldesk'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

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

export default function App() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [requests, setRequests] = useState<{ value: string; label: string; command: string }[]>([])
  const [activeRequest, setActiveRequest] = useState('')
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved'>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <TabsList className="gap-1 bg-transparent p-0">
                {requests.map((request) => {
                  const method = detectMethod(request.command)
                  return (
                    <TabsTrigger key={request.value} value={request.value} className="group gap-1.5 px-2.5">
                      <span className={`font-mono text-[11px] font-semibold ${methodColor(method)}`}>{method}</span>
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
              <Button size="sm" className="ml-auto"><Play /> Run</Button>
            </div>

            {requests.length === 0 && (
              <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                Open a curl file from Collections to start.
              </div>
            )}

            {requests.map((request) => (
              <TabsContent key={request.value} value={request.value} className="mt-0 flex min-h-0 flex-1 flex-col">
                <ResizablePanelGroup orientation={layout} className="min-h-0 flex-1">
                  <ResizablePanel defaultSize="68%" minSize="24%" className="resizable-panel">
                    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
                      <div className="w-12 shrink-0 select-none border-r px-2 py-4 text-right font-mono text-xs leading-6 text-muted-foreground">
                        {request.command.split('\n').map((_, index) => <div key={index}>{String(index + 1).padStart(2, '0')}</div>)}
                      </div>
                      <textarea aria-label={`${request.label} command editor`} className="min-h-full min-w-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none" value={request.command} onChange={(event) => updateCommand(request.value, event.target.value)} spellCheck={false} />
                    </section>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize="32%" minSize="18%" className="resizable-panel">
                    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
                        <div className="text-sm font-medium">Output</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={layout === 'vertical' ? 'secondary' : 'ghost'}
                            size="icon"
                            aria-label="上下布局"
                            aria-pressed={layout === 'vertical'}
                            onClick={() => setLayout('vertical')}
                          >
                            <LayoutPanelTop />
                          </Button>
                          <Button
                            variant={layout === 'horizontal' ? 'secondary' : 'ghost'}
                            size="icon"
                            aria-label="左右布局"
                            aria-pressed={layout === 'horizontal'}
                            onClick={() => setLayout('horizontal')}
                          >
                            <LayoutPanelLeft />
                          </Button>
                          <span className="text-xs text-muted-foreground">{saveStatus[request.value] === 'saving' ? 'Saving…' : saveStatus[request.value] === 'saved' ? 'Saved' : 'Ready'}</span>
                        </div>
                      </div>
                      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-sm text-muted-foreground">Run a curl command to see output here.</pre>
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
