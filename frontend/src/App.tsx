import { Check, Code2, Copy, Github, LayoutPanelLeft, LayoutPanelTop, LoaderCircle, Monitor, Moon, Palette, RefreshCw, Settings2, SlidersHorizontal, Sun, X } from 'lucide-react'
import { Browser } from '@wailsio/runtime'
import { Events } from '@wailsio/runtime'
import { Window } from '@wailsio/runtime'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/button'
import { CurlEditor } from '@/components/curl-editor'
import { OutputEditor } from '@/components/output-editor'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/resizable'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/dropdown-menu'
import { Separator } from '@/components/separator'
import { CurlRunner, WorkspaceService } from '../bindings/curldesk'
import type { WorkspaceEntry } from '../bindings/curldesk'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
const CURL_STREAM_EVENT = 'curldesk:curl:chunk'
const SETTINGS_STORAGE_KEY = 'curldesk-settings'
const RELEASES_URL = 'https://github.com/FearlessPeople/curldesk/releases/latest'

type AppSettings = {
  autoSave: boolean
  editorFontSize: number
  wrapOutput: boolean
  themeColor: ThemeColor
  appearance: Appearance
}

type ThemeColor = 'blue' | 'violet' | 'emerald' | 'orange' | 'rose'
type Appearance = 'light' | 'dark' | 'system'

type ThemePalette = {
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  border: string
  input: string
  primary: string
  ring: string
  selection: string
  activeLine: string
  sidebarBackground: string
  sidebarForeground: string
  sidebarAccent: string
}

type ThemeDefinition = { label: string; swatch: string; light: ThemePalette; dark: ThemePalette }

const themeColors: Record<ThemeColor, ThemeDefinition> = {
  blue: {
    label: 'Blue', swatch: 'bg-blue-500',
    light: { background: '210 20% 98%', foreground: '222 31% 14%', muted: '210 18% 94%', mutedForeground: '215 12% 45%', border: '214 20% 87%', input: '214 20% 82%', primary: '221 83% 53%', ring: '221 83% 53%', selection: '221 83% 53%', activeLine: '221 83% 53%', sidebarBackground: '0 0% 98%', sidebarForeground: '222 32% 16%', sidebarAccent: '210 40% 96%' },
    dark: { background: '222 31% 10%', foreground: '210 20% 96%', muted: '217 25% 17%', mutedForeground: '215 16% 65%', border: '217 20% 25%', input: '217 20% 30%', primary: '221 83% 65%', ring: '221 83% 65%', selection: '221 83% 65%', activeLine: '221 83% 65%', sidebarBackground: '222 31% 12%', sidebarForeground: '210 20% 96%', sidebarAccent: '217 25% 17%' },
  },
  violet: {
    label: 'Violet', swatch: 'bg-violet-500',
    light: { background: '260 20% 98%', foreground: '250 25% 15%', muted: '260 18% 94%', mutedForeground: '255 12% 45%', border: '260 18% 87%', input: '260 18% 82%', primary: '262 83% 58%', ring: '262 83% 58%', selection: '262 83% 58%', activeLine: '262 83% 58%', sidebarBackground: '260 18% 98%', sidebarForeground: '250 25% 16%', sidebarAccent: '260 35% 96%' },
    dark: { background: '250 28% 10%', foreground: '260 20% 96%', muted: '255 24% 17%', mutedForeground: '255 15% 66%', border: '255 20% 26%', input: '255 20% 31%', primary: '262 83% 68%', ring: '262 83% 68%', selection: '262 83% 68%', activeLine: '262 83% 68%', sidebarBackground: '250 28% 12%', sidebarForeground: '260 20% 96%', sidebarAccent: '255 24% 17%' },
  },
  emerald: {
    label: 'Emerald', swatch: 'bg-emerald-500',
    light: { background: '155 22% 98%', foreground: '155 30% 13%', muted: '155 18% 94%', mutedForeground: '155 12% 43%', border: '155 18% 85%', input: '155 18% 80%', primary: '158 64% 36%', ring: '158 64% 36%', selection: '158 64% 36%', activeLine: '158 64% 36%', sidebarBackground: '155 18% 98%', sidebarForeground: '155 30% 15%', sidebarAccent: '155 35% 95%' },
    dark: { background: '160 28% 9%', foreground: '150 20% 95%', muted: '160 24% 16%', mutedForeground: '155 14% 64%', border: '160 20% 24%', input: '160 20% 29%', primary: '158 64% 52%', ring: '158 64% 52%', selection: '158 64% 52%', activeLine: '158 64% 52%', sidebarBackground: '160 28% 11%', sidebarForeground: '150 20% 95%', sidebarAccent: '160 24% 16%' },
  },
  orange: {
    label: 'Orange', swatch: 'bg-orange-500',
    light: { background: '30 30% 98%', foreground: '25 30% 14%', muted: '30 24% 94%', mutedForeground: '25 13% 45%', border: '30 22% 86%', input: '30 22% 81%', primary: '25 95% 53%', ring: '25 95% 53%', selection: '25 95% 53%', activeLine: '25 95% 53%', sidebarBackground: '30 24% 98%', sidebarForeground: '25 30% 16%', sidebarAccent: '30 40% 95%' },
    dark: { background: '25 28% 10%', foreground: '30 20% 96%', muted: '25 24% 17%', mutedForeground: '25 14% 66%', border: '25 20% 26%', input: '25 20% 31%', primary: '25 95% 62%', ring: '25 95% 62%', selection: '25 95% 62%', activeLine: '25 95% 62%', sidebarBackground: '25 28% 12%', sidebarForeground: '30 20% 96%', sidebarAccent: '25 24% 17%' },
  },
  rose: {
    label: 'Rose', swatch: 'bg-rose-500',
    light: { background: '210 20% 98%', foreground: '222 31% 14%', muted: '210 18% 94%', mutedForeground: '215 12% 45%', border: '214 20% 87%', input: '214 20% 82%', primary: '346 77% 50%', ring: '346 77% 50%', selection: '346 77% 50%', activeLine: '346 77% 50%', sidebarBackground: '0 0% 98%', sidebarForeground: '222 32% 16%', sidebarAccent: '210 40% 96%' },
    dark: { background: '222 31% 10%', foreground: '210 20% 96%', muted: '217 25% 17%', mutedForeground: '215 16% 65%', border: '217 20% 25%', input: '217 20% 30%', primary: '346 77% 64%', ring: '346 77% 64%', selection: '346 77% 64%', activeLine: '346 77% 64%', sidebarBackground: '222 31% 12%', sidebarForeground: '210 20% 96%', sidebarAccent: '217 25% 17%' },
  },
}

const defaultSettings: AppSettings = { autoSave: true, editorFontSize: 14, wrapOutput: true, themeColor: 'blue', appearance: 'system' }

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

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

function isNewerVersion(latest: string, current: string) {
  const normalize = (version: string) => version.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const latestParts = normalize(latest)
  const currentParts = normalize(current)
  for (let index = 0; index < Math.max(latestParts.length, currentParts.length); index += 1) {
    if ((latestParts[index] ?? 0) !== (currentParts[index] ?? 0)) return (latestParts[index] ?? 0) > (currentParts[index] ?? 0)
  }
  return false
}

export default function App() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateState, setUpdateState] = useState<'checking' | 'latest' | 'available' | 'error'>('checking')
  const [latestRelease, setLatestRelease] = useState<{ version: string; url: string } | null>(null)
  const [settingsSection, setSettingsSection] = useState<'general' | 'editor'>('general')
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const theme = themeColors[settings.themeColor]
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = settings.appearance === 'dark' || (settings.appearance === 'system' && systemDark)
  const palette = theme[isDark ? 'dark' : 'light']
  const [requests, setRequests] = useState<{ value: string; label: string; command: string }[]>([])
  const [activeRequest, setActiveRequest] = useState('')
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
    void syncOpenRequests().finally(() => setBooting(false))
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

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    setSystemDark(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

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
    clearTimeout(saveTimers.current[value])
    if (!settings.autoSave) return
    saveTimers.current[value] = setTimeout(async () => {
      try {
        await WorkspaceService.SaveFile(value, command)
        await Events.Emit('curldesk:collections-changed')
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

  const checkForUpdates = async () => {
    setUpdateOpen(true)
    setUpdateState('checking')
    setLatestRelease(null)
    try {
      const response = await fetch('https://api.github.com/repos/FearlessPeople/curldesk/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!response.ok) throw new Error(`GitHub responded with ${response.status}`)
      const release = await response.json() as { tag_name?: string; html_url?: string }
      const version = release.tag_name?.trim() || ''
      const url = release.html_url?.trim() || RELEASES_URL
      if (!version) throw new Error('Release version is missing')
      setLatestRelease({ version, url })
      setUpdateState(isNewerVersion(version, __APP_VERSION__) ? 'available' : 'latest')
    } catch (error) {
      console.error('Unable to check for updates', error)
      setUpdateState('error')
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="flex h-screen flex-col"
        style={{
          '--background': palette.background,
          '--foreground': palette.foreground,
          '--muted': palette.muted,
          '--muted-foreground': palette.mutedForeground,
          '--border': palette.border,
          '--input': palette.input,
          '--primary': palette.primary,
          '--ring': palette.ring,
          '--selection': palette.selection,
          '--active-line': palette.activeLine,
          '--sidebar-background': palette.sidebarBackground,
          '--sidebar-foreground': palette.sidebarForeground,
          '--sidebar-accent': palette.sidebarAccent,
        } as CSSProperties}
      >
      <header
        className="relative flex h-9 shrink-0 items-center justify-center border-b"
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
            <div className="relative flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <TabsList className="!bg-transparent h-8 min-w-0 flex-1 justify-start gap-1 overflow-x-auto p-0 pr-24">
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
                        fontSize={settings.editorFontSize}
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={outputView === 'response' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setOutputView('response')}
                                >
                                  Response
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">View response body</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={outputView === 'headers' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setOutputView('headers')}
                                >
                                  Headers
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">View response headers</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="absolute right-6 top-1/2 z-10 flex min-w-0 -translate-y-1/2 items-center gap-2 pl-2">
                          {runInfo && (
                            <div className="mr-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] text-muted-foreground sm:gap-2 sm:text-[11px]">
                              <span
                                title="HTTP status code"
                                className={`shrink-0 rounded-sm px-1 py-0.5 font-medium ${statusColor(runInfo.status)}`}
                              >
                                HTTP {runInfo.status || '—'}
                              </span>
                              <span title="Request duration" className="shrink-0">{runInfo.durationMs} ms</span>
                              <span title="Request size" className="shrink-0">↑ {formatBytes(runInfo.requestSize)}</span>
                              <span title="Response size" className="shrink-0">↓ {formatBytes(runInfo.responseSize)}</span>
                            </div>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 rounded-md"
                                aria-label="Copy output"
                                onClick={() => void copyOutput()}
                                disabled={!runOutput}
                              >
                                {copiedOutput ? <Check /> : <Copy />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy output</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 shrink-0 rounded-md ${layout === 'vertical' ? 'bg-muted text-foreground' : ''}`}
                                aria-label="Vertical layout"
                                aria-pressed={layout === 'vertical'}
                                onClick={() => setLayout('vertical')}
                              >
                                <LayoutPanelTop />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Vertical layout</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 shrink-0 rounded-md ${layout === 'horizontal' ? 'bg-muted text-foreground' : ''}`}
                                aria-label="Horizontal layout"
                                aria-pressed={layout === 'horizontal'}
                                onClick={() => setLayout('horizontal')}
                              >
                                <LayoutPanelLeft />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Horizontal layout</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 overflow-hidden">
                        <OutputEditor
                          key={outputView}
                          value={outputView === 'response'
                            ? (runStatus === 'running' && !runOutput ? '' : displayOutput)
                            : formatOutput(runInfo?.headers || 'No response headers yet.')}
                          mode={outputView}
                          fontSize={settings.editorFontSize}
                          wrap={settings.wrapOutput}
                          loading={runStatus === 'running' && outputView === 'response' && !runOutput}
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="h-[560px] max-w-[820px] gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Settings</DialogTitle>
          <DialogDescription className="sr-only">Customize editor and request workspace preferences.</DialogDescription>
          <SidebarProvider className="items-start">
            <Sidebar collapsible="none" className="hidden w-48 shrink-0 border-r md:flex">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          isActive={settingsSection === 'general'}
                          onClick={() => setSettingsSection('general')}
                        >
                          <SlidersHorizontal />
                          <span>General</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          isActive={settingsSection === 'editor'}
                          onClick={() => setSettingsSection('editor')}
                        >
                          <Code2 />
                          <span>Editor</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
            <main className="flex h-[560px] min-w-0 flex-1 flex-col overflow-hidden">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 pr-14">
                <div>
                  <h2 className="text-lg font-semibold">Settings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Customize editor and request workspace preferences.</p>
                </div>
              </header>
              <section className="min-h-0 flex-1 overflow-y-auto p-6">
              {settingsSection === 'general' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold">General</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Manage basic CurlDesk workspace behavior.</p>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                    <span>
                      <span className="block text-sm font-medium">Auto-save</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Automatically save curl content to the local workspace.</span>
                    </span>
                    <Button
                      variant={settings.autoSave ? 'secondary' : 'outline'}
                      size="sm"
                      className="min-w-16"
                      aria-pressed={settings.autoSave}
                      onClick={() => setSettings((current) => ({ ...current, autoSave: !current.autoSave }))}
                    >
                      {settings.autoSave ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                    <span>
                      <span className="block text-sm font-medium">Accent color</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Choose the primary color for CurlDesk.</span>
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`size-3 rounded-full ${theme.swatch}`} />
                      {theme.label}
                    </div>
                  </div>
                </div>
              )}
              {settingsSection === 'editor' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold">Editor</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Adjust how request and response content is displayed.</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                    <span>
                      <span className="block text-sm font-medium">Editor font size</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Applied to both request and output editors.</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {[12, 13, 14, 15, 16, 18].map((size) => (
                        <Button
                          key={size}
                          variant={settings.editorFontSize === size ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 min-w-9 px-2"
                          aria-pressed={settings.editorFontSize === size}
                          onClick={() => setSettings((current) => ({ ...current, editorFontSize: size }))}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                    <span>
                      <span className="block text-sm font-medium">Wrap output</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Wrap long response content to fit the current panel.</span>
                    </span>
                    <Button
                      variant={settings.wrapOutput ? 'secondary' : 'outline'}
                      size="sm"
                      className="min-w-16"
                      aria-pressed={settings.wrapOutput}
                      onClick={() => setSettings((current) => ({ ...current, wrapOutput: !current.wrapOutput }))}
                    >
                      {settings.wrapOutput ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              )}
              </section>
            </main>
          </SidebarProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Check for updates</DialogTitle>
            <DialogDescription>Current version: {__APP_VERSION__}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-20 items-center justify-center text-sm">
            {updateState === 'checking' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Checking for updates…
              </div>
            )}
            {updateState === 'latest' && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> You are up to date ({latestRelease?.version}).
              </div>
            )}
            {updateState === 'available' && (
              <div className="flex w-full flex-col gap-3">
                <p>A new version is available: <span className="font-medium">{latestRelease?.version}</span>.</p>
                <Button onClick={() => void Browser.OpenURL(latestRelease?.url || RELEASES_URL)}>View release</Button>
              </div>
            )}
            {updateState === 'error' && (
              <div className="flex w-full flex-col gap-3">
                <p className="text-muted-foreground">Unable to check for updates right now.</p>
                <Button variant="outline" onClick={() => void checkForUpdates()}><RefreshCw className="mr-2 size-4" />Try again</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

        <footer className="flex h-8 shrink-0 items-center gap-3 border-t px-4 text-xs text-muted-foreground">
        <span>Workspace ready</span>
        <Separator orientation="vertical" className="h-3" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Check for updates"
              onClick={() => void checkForUpdates()}
            >
              Version {__APP_VERSION__}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Check for updates</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-3" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Palette className="size-3.5" />
              <span>Theme: {theme.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-36">
            <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'light' }))} className="gap-2">
              <Sun className="size-3.5" />
              <span className="flex-1">Light</span>
              {settings.appearance === 'light' && <Check className="size-3.5" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'dark' }))} className="gap-2">
              <Moon className="size-3.5" />
              <span className="flex-1">Dark</span>
              {settings.appearance === 'dark' && <Check className="size-3.5" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'system' }))} className="gap-2">
              <Monitor className="size-3.5" />
              <span className="flex-1">System</span>
              {settings.appearance === 'system' && <Check className="size-3.5" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(themeColors).map(([key, color]) => (
              <DropdownMenuItem
                key={key}
                onSelect={() => setSettings((current) => ({ ...current, themeColor: key as ThemeColor }))}
                className="gap-2"
              >
                <span className={`size-3 rounded-full ${color.swatch}`} />
                <span className="flex-1">{color.label}</span>
                {settings.themeColor === key && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-3" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-3.5" />
              <span>Settings</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Settings</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-3" />
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
        <Separator orientation="vertical" className="h-3" />
        <span className="ml-auto">UTF-8</span>
        </footer>
        {booting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground">
            <div className="flex flex-col items-center gap-3">
              <img src="/appicon.svg" alt="" className="size-12 rounded-xl shadow-sm" />
              <div className="text-lg font-semibold tracking-tight">CurlDesk</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" /> Loading workspace…
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
