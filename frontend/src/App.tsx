import { Check, ChevronsDownUp, ClipboardCopy, Clock3, Code2, Copy, Download, FilePlus2, Github, LayoutPanelLeft, LayoutPanelTop, LoaderCircle, MoreHorizontal, Monitor, Moon, Palette, Pin, RefreshCw, Search, Settings2, SlidersHorizontal, Sun, WandSparkles, X } from 'lucide-react'
import { Browser } from '@wailsio/runtime'
import { Events } from '@wailsio/runtime'
import { Window } from '@wailsio/runtime'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Alert } from '@/components/alert'
import { CurlEditor } from '@/components/curl-editor'
import { OutputEditor } from '@/components/output-editor'
import { EnvironmentEditor } from '@/features/environment/environment-editor'
import { HistoryPage } from '@/features/history/history-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { CommandPalette, type PaletteCommand } from '@/features/command-palette/command-palette'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/resizable'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/dropdown-menu'
import { Separator } from '@/components/separator'
import { copyText } from '@/lib/clipboard'
import { isMacOS, isWindows } from '@/lib/platform'
import { CurlRunner, UpdateService, WorkspaceService } from '../bindings/curldesk'
import type { WorkspaceEntry } from '../bindings/curldesk'
import type { HistoryEntry, WorkspaceInfo } from '../bindings/curldesk/models'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
const CURL_STREAM_EVENT = 'curldesk:curl:chunk'
const SETTINGS_STORAGE_KEY = 'curldesk-settings'
const RECENT_TABS_STORAGE_KEY = 'curldesk-recent-tabs'
const RELEASES_URL = 'https://github.com/FearlessPeople/curldesk/releases/latest'

type AppSettings = {
  autoSave: boolean
  editorFontSize: number
  wrapOutput: boolean
  historyLimit: number
  curlPath: string
  requestTimeoutMs: number
  themeColor: ThemeColor
  appearance: Appearance
}

type ThemeColor = 'blue' | 'violet' | 'emerald' | 'orange' | 'rose'
type Appearance = 'light' | 'dark' | 'system'
type PageRoute = 'settings' | 'history'
type Environments = Record<string, Record<string, string>>
type GeneratedEnvironmentValues = Record<string, string | undefined> | null | undefined
type GeneratedEnvironments = Record<string, GeneratedEnvironmentValues> | null | undefined
type RequestResult = {
  output: string
  runInfo: { status: number; durationMs: number; requestSize: number; responseSize: number; headers: string; requestHeaders: string; dnsDurationMs: number; connectDurationMs: number; tlsDurationMs: number; ttfbMs: number; remoteIp: string; httpVersion: string; redirects: number } | null
  runStatus: 'ready' | 'running' | 'failed'
  runID?: string
  runningLine?: number | null
}
type FeedbackMessage = { tone: 'success' | 'error'; message: string }

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
    light: { background: '0 0% 100%', foreground: '222 31% 14%', muted: '210 16% 96%', mutedForeground: '215 12% 45%', border: '214 20% 88%', input: '214 20% 82%', primary: '221 83% 53%', ring: '221 83% 53%', selection: '221 83% 53%', activeLine: '221 83% 53%', sidebarBackground: '0 0% 100%', sidebarForeground: '222 31% 20%', sidebarAccent: '210 16% 96%' },
    dark: { background: '222 31% 10%', foreground: '210 20% 96%', muted: '217 25% 17%', mutedForeground: '215 16% 65%', border: '217 20% 25%', input: '217 20% 30%', primary: '221 83% 65%', ring: '221 83% 65%', selection: '221 83% 65%', activeLine: '221 83% 65%', sidebarBackground: '222 31% 12%', sidebarForeground: '210 20% 96%', sidebarAccent: '217 25% 17%' },
  },
  violet: {
    label: 'Violet', swatch: 'bg-violet-500',
    light: { background: '0 0% 100%', foreground: '222 31% 14%', muted: '210 16% 96%', mutedForeground: '215 12% 45%', border: '214 20% 88%', input: '214 20% 82%', primary: '262 83% 58%', ring: '262 83% 58%', selection: '262 83% 58%', activeLine: '262 83% 58%', sidebarBackground: '0 0% 100%', sidebarForeground: '222 31% 20%', sidebarAccent: '210 16% 96%' },
    dark: { background: '250 28% 10%', foreground: '260 20% 96%', muted: '255 24% 17%', mutedForeground: '255 15% 66%', border: '255 20% 26%', input: '255 20% 31%', primary: '262 83% 68%', ring: '262 83% 68%', selection: '262 83% 68%', activeLine: '262 83% 68%', sidebarBackground: '250 28% 12%', sidebarForeground: '260 20% 96%', sidebarAccent: '255 24% 17%' },
  },
  emerald: {
    label: 'Emerald', swatch: 'bg-emerald-500',
    light: { background: '0 0% 100%', foreground: '222 31% 14%', muted: '210 16% 96%', mutedForeground: '215 12% 45%', border: '214 20% 88%', input: '214 20% 82%', primary: '158 64% 36%', ring: '158 64% 36%', selection: '158 64% 36%', activeLine: '158 64% 36%', sidebarBackground: '0 0% 100%', sidebarForeground: '222 31% 20%', sidebarAccent: '210 16% 96%' },
    dark: { background: '160 28% 9%', foreground: '150 20% 95%', muted: '160 24% 16%', mutedForeground: '155 14% 64%', border: '160 20% 24%', input: '160 20% 29%', primary: '158 64% 52%', ring: '158 64% 52%', selection: '158 64% 52%', activeLine: '158 64% 52%', sidebarBackground: '160 28% 11%', sidebarForeground: '150 20% 95%', sidebarAccent: '160 24% 16%' },
  },
  orange: {
    label: 'Orange', swatch: 'bg-orange-500',
    light: { background: '0 0% 100%', foreground: '222 31% 14%', muted: '210 16% 96%', mutedForeground: '215 12% 45%', border: '214 20% 88%', input: '214 20% 82%', primary: '25 95% 53%', ring: '25 95% 53%', selection: '25 95% 53%', activeLine: '25 95% 53%', sidebarBackground: '0 0% 100%', sidebarForeground: '222 31% 20%', sidebarAccent: '210 16% 96%' },
    dark: { background: '25 28% 10%', foreground: '30 20% 96%', muted: '25 24% 17%', mutedForeground: '25 14% 66%', border: '25 20% 26%', input: '25 20% 31%', primary: '25 95% 62%', ring: '25 95% 62%', selection: '25 95% 62%', activeLine: '25 95% 62%', sidebarBackground: '25 28% 12%', sidebarForeground: '30 20% 96%', sidebarAccent: '25 24% 17%' },
  },
  rose: {
    label: 'Rose', swatch: 'bg-rose-500',
    light: { background: '0 0% 100%', foreground: '222 31% 14%', muted: '210 16% 96%', mutedForeground: '215 12% 45%', border: '214 20% 88%', input: '214 20% 82%', primary: '346 77% 50%', ring: '346 77% 50%', selection: '346 77% 50%', activeLine: '346 77% 50%', sidebarBackground: '0 0% 100%', sidebarForeground: '222 31% 20%', sidebarAccent: '210 16% 96%' },
    dark: { background: '222 31% 10%', foreground: '210 20% 96%', muted: '217 25% 17%', mutedForeground: '215 16% 65%', border: '217 20% 25%', input: '217 20% 30%', primary: '346 77% 64%', ring: '346 77% 64%', selection: '346 77% 64%', activeLine: '346 77% 64%', sidebarBackground: '222 31% 12%', sidebarForeground: '210 20% 96%', sidebarAccent: '217 25% 17%' },
  },
}

const defaultSettings: AppSettings = { autoSave: true, editorFontSize: 14, wrapOutput: true, historyLimit: 100, curlPath: '', requestTimeoutMs: 0, themeColor: 'blue', appearance: 'system' }
const statusBarActionClass = 'h-7 rounded-md px-2 text-xs text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-primary hover:text-primary-foreground hover:shadow-sm'

function normalizeEnvironmentValues(values: GeneratedEnvironmentValues): Record<string, string> {
  const entries = Object.entries(values ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return Object.fromEntries(entries)
}

function normalizeEnvironments(values: GeneratedEnvironments): Environments {
  return Object.fromEntries(Object.entries(values ?? {}).map(([name, variables]) => [name, normalizeEnvironmentValues(variables)]))
}

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

function formatOutput(output: string, pretty = true) {
  if (!output) return ''
  if (!pretty) return output
  try {
    return JSON.stringify(JSON.parse(output), null, 2)
  } catch {
    return output
  }
}

function headerValue(headers: string, name: string) {
  const line = headers.split(/\r?\n/).find((value) => value.toLowerCase().startsWith(`${name.toLowerCase()}:`))
  return line ? line.slice(line.indexOf(':') + 1).trim() : ''
}

function isJsonResponse(output: string, headers: string) {
  const contentType = headerValue(headers, 'content-type').toLowerCase()
  if (contentType.includes('json') || contentType.includes('+json')) return true
  const trimmed = output.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
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

type ReleaseAsset = { name?: string; browser_download_url?: string }

function selectReleaseAsset(assets: ReleaseAsset[]) {
  const candidates = assets
    .map((asset) => ({ name: asset.name?.trim() || '', url: asset.browser_download_url?.trim() || '' }))
    .filter((asset) => asset.name && asset.url)

  if (isWindows) return candidates.find((asset) => /windows/i.test(asset.name) && /setup\.exe$/i.test(asset.name)) || null
  if (isMacOS) return candidates.find((asset) => /darwin/i.test(asset.name) && /\.zip$/i.test(asset.name)) || null
  return candidates.find((asset) => /linux/i.test(asset.name) && /\.tar\.gz$/i.test(asset.name)) || null
}

function splitCurlCommand(command: string) {
  const tokens: string[] = []
  let token = ''
  let quote = ''
  let escaped = false
  const normalized = command.replace(/\\\s*\r?\n/g, ' ')
  for (const character of normalized) {
    if (escaped) {
      token += character
      escaped = false
      continue
    }
    if (character === '\\' && quote !== "'") {
      token += character
      escaped = true
      continue
    }
    if (quote) {
      token += character
      if (character === quote) quote = ''
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      token += character
      continue
    }
    if (/\s/.test(character)) {
      if (token) {
        tokens.push(token)
        token = ''
      }
      continue
    }
    token += character
  }
  if (token) tokens.push(token)
  return tokens
}

function formatCurlArgument(argument: string) {
  const trimmed = argument.trim()
  const quote = trimmed[0]
  if ((quote === "'" || quote === '"') && trimmed.endsWith(quote)) {
    const body = trimmed.slice(1, -1)
    try {
      if (body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) {
        return `${quote}${JSON.stringify(JSON.parse(body), null, 2)}${quote}`
      }
    } catch {
      // Keep non-JSON shell arguments unchanged.
    }
    if (body.includes('\n')) return `${quote}${body.split(/\r?\n/).map((line) => line.trim()).join('\n    ')}${quote}`
  }
  return trimmed
}

function formatCurlCommand(command: string) {
  const tokens = splitCurlCommand(command.trim())
  if (tokens.length <= 1) return tokens.join('')
  const lines = [tokens[0]]
  for (let index = 1; index < tokens.length; index += 1) {
    let line = `  ${formatCurlArgument(tokens[index])}`
    const next = tokens[index + 1]
    if (next && !next.startsWith('-')) {
      line += ` ${formatCurlArgument(next)}`
      index += 1
    }
    lines.push(line)
  }
  const continuation = isWindows ? ' ^' : ' \\'
  return lines.map((line, index) => `${line}${index < lines.length - 1 ? continuation : ''}`).join('\n')
}

function compactCurlCommand(command: string) {
  return command.replace(/\\\s*\r?\n/g, ' ').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function App() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [booting, setBooting] = useState(true)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateState, setUpdateState] = useState<'checking' | 'latest' | 'available' | 'installing' | 'error'>('checking')
  const [latestRelease, setLatestRelease] = useState<{ version: string; url: string; assetName: string; downloadUrl: string } | null>(null)
  const [settingsSection, setSettingsSection] = useState<'general' | 'editor' | 'environment' | 'history'>('general')
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [environments, setEnvironments] = useState<Environments>({ Dev: {} })
  const [globalEnvironments, setGlobalEnvironments] = useState<Environments>({ Dev: {} })
  const [workspace, setWorkspace] = useState<WorkspaceInfo>({ path: '', name: 'My Workspace', default: true })
  const [activeEnvironment, setActiveEnvironment] = useState('Dev')
  const theme = themeColors[settings.themeColor]
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = settings.appearance === 'dark' || (settings.appearance === 'system' && systemDark)
  const palette = theme[isDark ? 'dark' : 'light']
  const [requests, setRequests] = useState<{ value: string; label: string; command: string; dirty?: boolean; pinned?: boolean }[]>([])
  const [activeRequest, setActiveRequest] = useState('')
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [outputView, setOutputView] = useState<'response' | 'headers' | 'request'>('response')
  const [responseFormat, setResponseFormat] = useState<'pretty' | 'raw'>('pretty')
  const [outputSearch, setOutputSearch] = useState('')
  const [collapseOutputSignal, setCollapseOutputSignal] = useState(0)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [requestResults, setRequestResults] = useState<Record<string, RequestResult>>({})
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const [windowTransitioning, setWindowTransitioning] = useState(false)
  const [openPages, setOpenPages] = useState<PageRoute[]>([])
  const [activePage, setActivePage] = useState<PageRoute | null>(null)

  const toggleWindowMaximise = () => {
    if (!isWindows) {
      void Window.ToggleMaximise()
      return
    }
    setWindowTransitioning(true)
    void Window.ToggleMaximise()
    window.setTimeout(() => setWindowTransitioning(false), 180)
  }

  useEffect(() => {
    if (!isWindows) return
    let timer: number | undefined
    const playTransition = () => {
      setWindowTransitioning(true)
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => setWindowTransitioning(false), 180)
    }
    const unsubscribeMaximise = Events.On('windows:WindowMaximise', playTransition)
    const unsubscribeRestore = Events.On('windows:WindowUnMaximise', playTransition)
    return () => {
      unsubscribeMaximise()
      unsubscribeRestore()
      if (timer) window.clearTimeout(timer)
    }
  }, [])
  const activeStreams = useRef<Record<string, string>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredTabs = useRef(false)
  const activeResult = requestResults[activeRequest]
  const runOutput = activeResult?.output || ''
  const runInfo = activeResult?.runInfo || null
  const runStatus = activeResult?.runStatus || 'ready'
  const runningLine = activeResult?.runningLine ?? null
  const displayOutput = outputView === 'response'
    ? formatOutput(runOutput || 'Run a curl command to see output here.', responseFormat === 'pretty' && isJsonResponse(runOutput, runInfo?.headers || ''))
    : outputView === 'headers'
      ? (runInfo?.headers || 'No response headers yet.')
      : (runInfo?.requestHeaders || 'No explicit request headers.')
  const responseContentType = headerValue(runInfo?.headers || '', 'content-type') || (runOutput ? 'text/plain' : '—')
  const activeTab = activePage ? `page:${activePage}` : activeRequest

  const setErrorMessage = (message: string) => setFeedback({ tone: 'error', message })
  const setSuccessMessage = (message: string) => setFeedback({ tone: 'success', message })

  const openPage = (page: PageRoute) => {
    setOpenPages((current) => current.includes(page) ? current : [...current, page])
    setActivePage(page)
  }

  const closePage = (page: PageRoute) => {
    const nextPages = openPages.filter((current) => current !== page)
    setOpenPages(nextPages)
    if (activePage !== page) return
    const nextPage = nextPages[nextPages.length - 1] || null
    setActivePage(nextPage)
    if (!nextPage && requests.length > 0) setActiveRequest((current) => current || requests[0].value)
  }

  const selectTab = (value: string) => {
    if (value.startsWith('page:')) {
      setActivePage(value.slice(5) as PageRoute)
      return
    }
    setActivePage(null)
    setActiveRequest(value)
  }

  const copyOutput = async () => {
    if (!activeResult || !displayOutput || displayOutput.startsWith('No ') || displayOutput.startsWith('Run a curl')) return
    try {
      await copyText(displayOutput)
      setCopiedOutput(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopiedOutput(false), 1400)
    } catch (error) {
      console.error('Unable to copy output', error)
    }
  }

  const formatCurrentRequest = () => {
    const request = requests.find((item) => item.value === activeRequest)
    if (!request) return
    const formatted = formatCurlCommand(request.command)
    updateCommand(request.value, formatted)
    setSuccessMessage('Curl command formatted.')
  }

  const copyRawRequest = async () => {
    const request = requests.find((item) => item.value === activeRequest)
    if (!request) return
    try {
      const resolved = await WorkspaceService.ResolveEnvironment(request.command, activeEnvironment)
      await copyText(compactCurlCommand(resolved))
      setSuccessMessage('Resolved curl command copied.')
    } catch (error) {
      console.error('Unable to copy resolved curl command', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to copy resolved curl command.')
    }
  }

  const downloadOutput = () => {
    if (!activeResult || !displayOutput || displayOutput.startsWith('No ') || displayOutput.startsWith('Run a curl')) return
    const blob = new Blob([displayOutput], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${outputView}.txt`
    link.click()
    URL.revokeObjectURL(url)
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

  const loadEnvironmentSets = useCallback(async () => {
    try {
      const [workspaceLoaded, globalLoaded] = await Promise.all([
        WorkspaceService.ListEnvironments(),
        WorkspaceService.ListGlobalEnvironments(),
      ])
      const nextWorkspace = normalizeEnvironments(workspaceLoaded)
      const nextGlobal = normalizeEnvironments(globalLoaded)
      const workspaceValues = Object.keys(nextWorkspace).length > 0 ? nextWorkspace : { Dev: {} }
      const globalValues = Object.keys(nextGlobal).length > 0 ? nextGlobal : { Dev: {} }
      setEnvironments(workspaceValues)
      setGlobalEnvironments(globalValues)
      setActiveEnvironment((current) => workspaceValues[current] ? current : Object.keys(workspaceValues)[0] || 'Dev')
    } catch (error) {
      console.error('Unable to load environments', error)
    }
  }, [])

  useEffect(() => {
    void WorkspaceService.CurrentWorkspace().then(setWorkspace).catch((error) => console.error('Unable to load current workspace', error))
    void syncOpenRequests().finally(() => setBooting(false))
    const unsubscribe = Events.On('curldesk:collections-changed', () => { void syncOpenRequests() })
    const unsubscribeWorkspace = Events.On('curldesk:workspace-changed', () => {
      setRequests([])
      setRequestResults({})
      setActiveRequest('')
      void WorkspaceService.CurrentWorkspace().then(setWorkspace)
      void loadEnvironmentSets()
      void syncOpenRequests()
    })
    return () => { unsubscribe(); unsubscribeWorkspace() }
  }, [loadEnvironmentSets])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === 'PageUp' || event.key === 'PageDown')) {
        event.preventDefault()
        switchRequestTab(event.key === 'PageUp' ? -1 : 1)
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === '[' || event.key === ']')) {
        event.preventDefault()
        switchRequestTab(event.key === '[' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [activeRequest, requests])

  useEffect(() => { void loadEnvironmentSets() }, [loadEnvironmentSets])

  useEffect(() => {
    void WorkspaceService.LoadSettings().then((stored) => {
      if (stored && Object.keys(stored).length > 0) {
        setSettings((current) => ({
          ...current,
          ...(stored.autoSave !== undefined ? { autoSave: stored.autoSave === 'true' } : {}),
          ...(stored.editorFontSize ? { editorFontSize: Number(stored.editorFontSize) || current.editorFontSize } : {}),
          ...(stored.wrapOutput !== undefined ? { wrapOutput: stored.wrapOutput === 'true' } : {}),
          ...(stored.historyLimit !== undefined ? { historyLimit: Math.min(1000, Math.max(10, Number(stored.historyLimit) || current.historyLimit)) } : {}),
          ...(stored.curlPath !== undefined ? { curlPath: stored.curlPath } : {}),
          ...(stored.requestTimeoutMs !== undefined ? { requestTimeoutMs: Math.max(0, Number(stored.requestTimeoutMs) || 0) } : {}),
          ...(stored.themeColor && stored.themeColor in themeColors ? { themeColor: stored.themeColor as ThemeColor } : {}),
          ...(stored.appearance && ['light', 'dark', 'system'].includes(stored.appearance) ? { appearance: stored.appearance as Appearance } : {}),
        }))
      }
      setSettingsLoaded(true)
    }).catch((error) => {
      console.error('Unable to load settings', error)
      setSettingsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  useEffect(() => Events.On(CURL_STREAM_EVENT, (event) => {
    const data = event.data as { runId?: string; chunk?: string } | undefined
    if (!data?.runId || !data.chunk) return
    const filePath = activeStreams.current[data.runId]
    if (!filePath) return
    setRequestResults((current) => {
      const result = current[filePath]
      if (!result || result.runID !== data.runId) return current
      return { ...current, [filePath]: { ...result, output: result.output + data.chunk } }
    })
  }), [])

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer))
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    void WorkspaceService.SaveSettings({
      autoSave: String(settings.autoSave),
      editorFontSize: String(settings.editorFontSize),
      wrapOutput: String(settings.wrapOutput),
      historyLimit: String(settings.historyLimit),
      curlPath: settings.curlPath,
      requestTimeoutMs: String(settings.requestTimeoutMs),
      themeColor: settings.themeColor,
      appearance: settings.appearance,
    }).catch((error) => console.error('Unable to save settings', error))
    void CurlRunner.SetCurlPath(settings.curlPath).catch((error) => {
      console.error('Unable to configure curl executable', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to configure curl executable.')
    })
    void CurlRunner.SetTimeout(settings.requestTimeoutMs).catch((error) => {
      console.error('Unable to configure curl timeout', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to configure curl timeout.')
    })
  }, [settings, settingsLoaded])

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
        : [...current, { value: entry.path, label: entry.name, command, dirty: false, pinned: false }])
      setActivePage(null)
      setActiveRequest(entry.path)
    } catch (error) {
      console.error('Unable to open curl file', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open curl file.')
    }
  }

  const createNewCurl = async () => {
    try {
      const created = await WorkspaceService.CreateFile('', `request-${Date.now()}`)
      await Events.Emit('curldesk:collections-changed')
      await openFile(created)
    } catch (error) {
      console.error('Unable to create curl file', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create curl file.')
    }
  }

  useEffect(() => {
    if (booting || restoredTabs.current) return
    let saved: { active?: string; tabs?: { path: string; pinned?: boolean }[] } = {}
    try { saved = JSON.parse(localStorage.getItem(RECENT_TABS_STORAGE_KEY) || '{}') } catch { saved = {} }
    const tabs = saved.tabs ?? []
    if (tabs.length === 0) {
      restoredTabs.current = true
      return
    }
    void Promise.all(tabs.map(async (tab) => {
      try {
        const command = await WorkspaceService.ReadFile(tab.path)
        return { value: tab.path, label: tab.path.split('/').pop() || tab.path, command, dirty: false, pinned: Boolean(tab.pinned) }
      } catch {
        return null
      }
    })).then((loaded) => {
      const restored = loaded.filter((request): request is NonNullable<typeof request> => request !== null)
      setRequests(restored)
      setActiveRequest(restored.some((request) => request.value === saved.active) ? saved.active || '' : restored[0]?.value || '')
      restoredTabs.current = true
    })
  }, [booting])

  useEffect(() => {
    if (booting || !restoredTabs.current) return
    localStorage.setItem(RECENT_TABS_STORAGE_KEY, JSON.stringify({
      active: activeRequest,
      tabs: requests.map((request) => ({ path: request.value, pinned: request.pinned })),
    }))
  }, [activeRequest, booting, requests])

  const closeRequest = (value: string) => {
    if (requests.length === 1) return
    const runningID = requestResults[value]?.runID
    if (requestResults[value]?.runStatus === 'running' && runningID) {
      delete activeStreams.current[runningID]
      void CurlRunner.StopCurlByID(runningID)
    }
    const index = requests.findIndex((request) => request.value === value)
    const nextRequests = requests.filter((request) => request.value !== value)
    setRequests(nextRequests)
    if (activeRequest === value) {
      setActiveRequest(nextRequests[Math.max(0, index - 1)]?.value ?? nextRequests[0].value)
    }
  }

  const togglePinRequest = (value: string) => {
    setRequests((current) => current.map((request) => request.value === value ? { ...request, pinned: !request.pinned } : request))
  }

  const closeOtherRequests = (value: string) => {
    requests.filter((request) => request.value !== value && !request.pinned).forEach((request) => {
      const runningID = requestResults[request.value]?.runID
      if (runningID) {
        delete activeStreams.current[runningID]
        void CurlRunner.StopCurlByID(runningID)
      }
    })
    setRequests((current) => current.filter((request) => request.value === value || request.pinned))
    setActiveRequest(value)
  }

  const closeAllRequests = () => {
    void CurlRunner.StopCurl()
    activeStreams.current = {}
    setRequests([])
    setActiveRequest('')
    setRequestResults({})
  }

  const switchRequestTab = (offset: number) => {
    if (requests.length < 2) return
    const currentIndex = Math.max(0, requests.findIndex((request) => request.value === activeRequest))
    const nextIndex = (currentIndex + offset + requests.length) % requests.length
    setActiveRequest(requests[nextIndex].value)
  }

  const updateCommand = (value: string, command: string) => {
    setRequests((current) => current.map((request) => request.value === value ? { ...request, command, dirty: true } : request))
    if (!/\.curl$/i.test(value)) return
    clearTimeout(saveTimers.current[value])
    if (!settings.autoSave) return
    saveTimers.current[value] = setTimeout(async () => {
      try {
        await WorkspaceService.SaveFile(value, command)
        setRequests((current) => current.map((request) => request.value === value ? { ...request, dirty: false } : request))
        await Events.Emit('curldesk:collections-changed')
      } catch (error) {
        console.error('Unable to save curl file', error)
        setErrorMessage(error instanceof Error ? error.message : 'Unable to save curl file.')
      }
    }, 600)
  }

  const saveEnvironments = async (next: Environments, successMessage = 'Workspace environment saved.') => {
    setEnvironments(next)
    try {
      await WorkspaceService.SaveEnvironments(next)
      setSuccessMessage(successMessage)
    } catch (error) {
      console.error('Unable to save environments', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save environments.')
    }
  }

  const saveGlobalEnvironments = async (next: Environments) => {
    setGlobalEnvironments(next)
    try {
      await WorkspaceService.SaveGlobalEnvironments(next)
      setSuccessMessage('Global environment saved.')
    } catch (error) {
      console.error('Unable to save global environments', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save global environments.')
    }
  }

  const loadDotEnv = async () => {
    try {
      const dotenv = await WorkspaceService.LoadDotEnv()
      await saveEnvironments({ ...environments, [activeEnvironment]: normalizeEnvironmentValues(dotenv) }, '.env loaded into workspace environment.')
    } catch (error) {
      console.error('Unable to load .env', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load .env.')
    }
  }

  const saveDotEnv = async () => {
    try {
      await WorkspaceService.SaveDotEnv(environments[activeEnvironment] || {})
      setSuccessMessage('.env file saved.')
    } catch (error) {
      console.error('Unable to save .env', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save .env.')
    }
  }

  const searchHistory = useCallback(async (query: string) => {
    try {
      setHistoryEntries((await WorkspaceService.ListHistory(query)) ?? [])
    } catch (error) {
      console.error('Unable to load history', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load request history.')
    }
  }, [])

  const clearHistory = useCallback(async () => {
    try {
      await WorkspaceService.ClearHistory()
      setHistoryEntries([])
    } catch (error) {
      console.error('Unable to clear history', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to clear request history.')
    }
  }, [])

  const runRequestBlock = async (command: string, startLine: number) => {
    if (!activeRequest || runStatus === 'running') return
    const filePath = activeRequest
    const environmentName = activeEnvironment
    const requestBlock = extractRequestBlock(command, startLine)
    if (!requestBlock) return
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    activeStreams.current[streamId] = filePath
    setRequestResults((current) => ({
      ...current,
      [filePath]: { output: '', runInfo: null, runStatus: 'running', runID: streamId, runningLine: startLine },
    }))
    setOutputView('response')
    setResponseFormat('pretty')
    setOutputSearch('')
    try {
      const missing = await WorkspaceService.ValidateEnvironment(requestBlock, activeEnvironment)
      if (missing && missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`)
      const resolvedRequestBlock = await WorkspaceService.ResolveEnvironment(requestBlock, activeEnvironment)
      const validation = await CurlRunner.ValidateCurl(resolvedRequestBlock)
      if (!validation.valid) {
        const diagnostic = validation.diagnostics?.[0]
        throw new Error(diagnostic ? `${diagnostic.message} (${diagnostic.line}:${diagnostic.column})` : 'Invalid curl command.')
      }
      const result = await CurlRunner.RunCurlStream(resolvedRequestBlock, streamId)
      delete activeStreams.current[streamId]
      const nextOutput = result.output || `Process exited with code ${result.exitCode}.`
      const nextInfo = {
        status: result.status,
        durationMs: result.durationMs,
        requestSize: result.requestSize,
        responseSize: result.responseSize,
        headers: result.responseHeaders,
        requestHeaders: result.requestHeaders,
        dnsDurationMs: result.dnsDurationMs,
        connectDurationMs: result.connectDurationMs,
        tlsDurationMs: result.tlsDurationMs,
        ttfbMs: result.ttfbMs,
        remoteIp: result.remoteIp,
        httpVersion: result.httpVersion,
        redirects: result.redirects,
      }
      setRequestResults((current) => {
        const existing = current[filePath]
        if (!existing || existing.runID !== streamId) return current
        return { ...current, [filePath]: { output: nextOutput, runInfo: nextInfo, runStatus: result.exitCode === 0 ? 'ready' : 'failed', runID: streamId, runningLine: null } }
      })
      void WorkspaceService.RecordHistory(filePath, environmentName, requestBlock, nextOutput, nextInfo.headers, result.exitCode, nextInfo.status, nextInfo.durationMs).catch((error) => {
        console.error('Unable to record request history', error)
      })
    } catch (error) {
      delete activeStreams.current[streamId]
      console.error('Unable to run curl command', error)
      const message = error instanceof Error ? error.message : 'Unable to run curl command.'
      setRequestResults((current) => {
        const existing = current[filePath]
        if (!existing || existing.runID !== streamId) return current
        return { ...current, [filePath]: { output: message, runInfo: null, runStatus: 'failed', runID: streamId, runningLine: null } }
      })
      setErrorMessage(error instanceof Error ? error.message : 'Unable to run curl command.')
    }
  }

  const stopRequest = async () => {
    if (runStatus !== 'running') return
    const streamId = activeResult?.runID || ''
    if (streamId) delete activeStreams.current[streamId]
    setRequestResults((current) => ({ ...current, [activeRequest]: { output: 'Request stopped.', runInfo: null, runStatus: 'ready', runningLine: null } }))
    try {
      await CurlRunner.StopCurlByID(streamId)
    } catch (error) {
      console.error('Unable to stop curl command', error)
    }
  }

  const checkForUpdates = async () => {
    setUpdateOpen(true)
    setUpdateState('checking')
    setLatestRelease(null)
    try {
      const release = await UpdateService.CheckForUpdates()
      const version = release.version?.trim() || ''
      const url = release.url?.trim() || RELEASES_URL
      if (!version) throw new Error('Release version is missing')
      const asset = selectReleaseAsset((release.assets || []).map((item) => ({ name: item.name, browser_download_url: item.url })))
      setLatestRelease({ version, url, assetName: asset?.name || '', downloadUrl: asset?.url || '' })
      setUpdateState(isNewerVersion(version, __APP_VERSION__) ? 'available' : 'latest')
    } catch (error) {
      console.error('Unable to check for updates', error)
      setUpdateState('error')
    }
  }

  const installUpdate = async () => {
    const downloadUrl = latestRelease?.downloadUrl
    if (!downloadUrl) {
      await Browser.OpenURL(latestRelease?.url || RELEASES_URL)
      return
    }
    if (!isWindows) {
      await Browser.OpenURL(downloadUrl)
      return
    }
    setUpdateState('installing')
    try {
      await UpdateService.InstallUpdate(downloadUrl)
    } catch (error) {
      console.error('Unable to install update', error)
      setUpdateState('error')
    }
  }

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const active = requests.find((request) => request.value === activeRequest)
    return [
      { id: 'run', label: 'Run current request', description: 'Execute the active curl request', shortcut: '⌘ Enter', onSelect: () => active && void runRequestBlock(active.command, 1) },
      { id: 'new-curl', label: 'Create new curl file', description: 'Start a new request in the workspace', onSelect: () => void createNewCurl() },
      { id: 'save', label: 'Save current request', description: 'Write the active curl file to the workspace', onSelect: () => {
        if (!active) return
        void WorkspaceService.SaveFile(active.value, active.command).then(() => setRequests((current) => current.map((request) => request.value === active.value ? { ...request, dirty: false } : request)))
      } },
      { id: 'history', label: 'Open request history', description: 'Search previous local curl runs', onSelect: () => { setSettingsSection('history'); openPage('settings') } },
      { id: 'environment', label: 'Switch environment', description: 'Open environment settings', onSelect: () => { setSettingsSection('environment'); openPage('settings') } },
      { id: 'close-tab', label: 'Close current tab', description: 'Close the active request tab', onSelect: () => activeRequest && closeRequest(activeRequest) },
      { id: 'close-others', label: 'Close other tabs', description: 'Keep the active tab and pinned tabs', onSelect: () => activeRequest && closeOtherRequests(activeRequest) },
      { id: 'close-all', label: 'Close all tabs', description: 'Stop running requests and close every tab', onSelect: closeAllRequests },
      { id: 'next-tab', label: 'Next tab', description: 'Switch to the next request tab', shortcut: '⌘ PageDown', onSelect: () => switchRequestTab(1) },
      { id: 'previous-tab', label: 'Previous tab', description: 'Switch to the previous request tab', shortcut: '⌘ PageUp', onSelect: () => switchRequestTab(-1) },
    ]
  }, [activeRequest, requests, runRequestBlock])

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={`flex h-screen flex-col ${windowTransitioning ? 'window-maximise-transition' : ''}`}
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
      {isMacOS && (
        <header
          className="relative flex h-9 shrink-0 select-none items-center justify-center border-b"
          style={{ '--wails-draggable': 'drag' } as CSSProperties}
          onDoubleClick={toggleWindowMaximise}
        >
          <div className="flex items-center gap-2 text-sm font-medium no-underline">
            <img src="/appicon.svg" alt="" className="size-5 rounded-md" />
            CurlDesk
          </div>
        </header>
      )}

      {feedback && (
        <Alert
          aria-live="polite"
          className={`pointer-events-auto fixed bottom-10 right-4 z-[80] flex max-w-sm items-center gap-2 bg-background shadow-lg ${feedback.tone === 'success' ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'border-destructive/30 text-destructive'}`}
        >
          {feedback.tone === 'success' ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
          <span>{feedback.message}</span>
        </Alert>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <SidebarProvider className="!min-h-0 h-full">
          <AppSidebar
            onOpenFile={openFile}
            workspace={workspace}
            onWorkspaceChanged={setWorkspace}
            environments={environments}
            activeEnvironment={activeEnvironment}
            onSelectEnvironment={setActiveEnvironment}
            onManageEnvironments={() => { setSettingsSection('environment'); openPage('settings') }}
          />
          <SidebarInset>
            <Tabs value={activeTab} onValueChange={selectTab} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <TabsList className="!bg-transparent h-8 min-w-0 flex-1 justify-start gap-1 overflow-x-auto p-0 pr-24">
                {openPages.map((page) => (
                  <TabsTrigger key={`page:${page}`} value={`page:${page}`} className="group gap-1 px-2 data-[state=active]:ring-1 data-[state=active]:ring-primary/25">
                    <span>{page === 'settings' ? 'Settings' : 'History'}</span>
                    <span role="button" tabIndex={0} aria-label={`Close ${page} page`} className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-slate-200 group-hover:opacity-100 group-data-[state=active]:opacity-70 dark:hover:bg-slate-800" onClick={(event) => { event.stopPropagation(); closePage(page) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); closePage(page) } }}><X className="size-3" /></span>
                  </TabsTrigger>
                ))}
                {requests.map((request) => {
                  const method = detectMethod(request.command)
                  return (
                    <TabsTrigger key={request.value} value={request.value} className="group gap-1 px-2 data-[state=active]:ring-1 data-[state=active]:ring-primary/25">
                      <span className={`font-mono text-[10px] font-semibold ${methodColor(method)}`}>{method}</span>
                      <span>{request.dirty ? `${request.label.replace(/\.curl$/i, '')} ·` : request.label.replace(/\.curl$/i, '')}</span>
                      {request.pinned && <Pin className="size-3 text-primary" />}
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
              <div className="absolute right-10 flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Format current curl command" onClick={formatCurrentRequest} disabled={!activeRequest}>
                      <WandSparkles className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Format curl command</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Copy resolved curl command" onClick={() => void copyRawRequest()} disabled={!activeRequest}>
                      <ClipboardCopy className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Copy resolved curl command</TooltipContent>
                </Tooltip>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="absolute right-2 size-7" aria-label="Tab actions"><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {activeRequest && <DropdownMenuItem onSelect={() => togglePinRequest(activeRequest)}><Pin className="size-3.5" /> {requests.find((request) => request.value === activeRequest)?.pinned ? 'Unpin tab' : 'Pin tab'}</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => activeRequest && closeOtherRequests(activeRequest)} disabled={!activeRequest || requests.length < 2}>Close others</DropdownMenuItem>
                  <DropdownMenuItem onSelect={closeAllRequests} disabled={requests.length === 0}>Close all</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {requests.length === 0 && openPages.length === 0 && (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6">
                <div className="w-full max-w-md rounded-lg border bg-muted/20 px-8 py-9 text-center shadow-sm">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Code2 className="size-5" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">Start with a curl request</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Open a .curl file from Collections, or create a new request to begin working.</p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={() => void createNewCurl()}><FilePlus2 className="size-4" />New curl file</Button>
                    <Button variant="outline" size="sm" onClick={() => setCommandPaletteOpen(true)}>Open commands <kbd className="ml-1 text-[10px] text-muted-foreground">⌘K</kbd></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSettingsSection('history'); openPage('settings') }}><Clock3 className="size-4" />History</Button>
                  </div>
                </div>
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={outputView === 'request' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setOutputView('request')}
                                >
                                  Request
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">View explicit request headers</TooltipContent>
                            </Tooltip>
                          </div>
                          {outputView === 'response' && isJsonResponse(runOutput, runInfo?.headers || '') && (
                            <div className="flex items-center gap-1">
                              {(['pretty', 'raw'] as const).map((format) => (
                                <Button key={format} variant={responseFormat === format ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => setResponseFormat(format)}>
                                  {format === 'pretty' ? 'Pretty' : 'Raw'}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="absolute right-6 top-1/2 z-10 flex min-w-0 -translate-y-1/2 items-center gap-2 pl-2">
                          <div className="relative hidden w-32 sm:block">
                            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input value={outputSearch} onChange={(event) => setOutputSearch(event.target.value)} placeholder="Search" aria-label="Search response output" className="h-7 pl-7 text-xs" />
                          </div>
                          {outputView === 'response' && responseFormat === 'pretty' && isJsonResponse(runOutput, runInfo?.headers || '') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-md" aria-label="Collapse JSON" onClick={() => setCollapseOutputSignal((current) => current + 1)}>
                                  <ChevronsDownUp />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Collapse JSON</TooltipContent>
                            </Tooltip>
                          )}
                          {runInfo && (
                            <div className="mr-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] text-muted-foreground sm:gap-2 sm:text-[11px]">
                              <span
                                title="HTTP status code"
                                className={`shrink-0 rounded-sm px-1 py-0.5 font-medium ${statusColor(runInfo.status)}`}
                              >
                                HTTP {runInfo.status || '—'}
                              </span>
                              <span title="Request duration" className="shrink-0">{runInfo.durationMs} ms</span>
                              <span title="Response size" className="shrink-0">↓ {formatBytes(runInfo.responseSize)}</span>
                              <span title="Response content type" className="hidden max-w-28 truncate lg:inline">{responseContentType}</span>
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
                                disabled={!activeResult || !displayOutput || displayOutput.startsWith('No ') || displayOutput.startsWith('Run a curl')}
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
                                className="h-7 w-7 shrink-0 rounded-md"
                                aria-label="Download output"
                                onClick={downloadOutput}
                                disabled={!activeResult || !displayOutput || displayOutput.startsWith('No ') || displayOutput.startsWith('Run a curl')}
                              >
                                <Download />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Download output</TooltipContent>
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
                            : displayOutput}
                          mode={outputView}
                          fontSize={settings.editorFontSize}
                          wrap={settings.wrapOutput}
                          searchTerm={outputSearch}
                          collapseSignal={collapseOutputSignal}
                          loading={runStatus === 'running' && outputView === 'response' && !runOutput}
                        />
                      </div>
                    </section>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>
            ))}
            {openPages.map((page) => (
              <TabsContent key={`page:${page}`} value={`page:${page}`} className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                {page === 'settings' && <SettingsPage settings={settings} onSettingsChange={(update) => setSettings((current) => { const next = update(current); return { ...current, ...next, themeColor: next.themeColor as ThemeColor, appearance: next.appearance as Appearance } })} section={settingsSection} onSectionChange={setSettingsSection} themeLabel={theme.label} themeSwatch={theme.swatch} environments={environments} globalEnvironments={globalEnvironments} activeEnvironment={activeEnvironment} onSelectEnvironment={setActiveEnvironment} onWorkspaceChange={saveEnvironments} onGlobalChange={saveGlobalEnvironments} onLoadDotEnv={() => void loadDotEnv()} onSaveDotEnv={() => void saveDotEnv()} historyEntries={historyEntries} onHistorySearch={searchHistory} onClearHistory={() => void clearHistory()} />}
                {page === 'history' && <HistoryPage entries={historyEntries} onSearch={searchHistory} onClear={() => void clearHistory()} />}
              </TabsContent>
            ))}
            </Tabs>
          </SidebarInset>
        </SidebarProvider>
      </div>

      {false && (
        <Dialog>
        <DialogContent className="h-[620px] max-w-[900px] gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Settings</DialogTitle>
          <DialogDescription className="sr-only">Customize editor and request workspace preferences.</DialogDescription>
          <SidebarProvider className="items-start">
            <Sidebar collapsible="none" className="hidden w-52 shrink-0 border-r bg-muted/20 md:flex">
              <SidebarContent className="gap-1 px-2 py-3">
                <SidebarGroup className="p-0">
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="h-9 rounded-md px-3 text-sm data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
                          isActive={settingsSection === 'general'}
                          onClick={() => setSettingsSection('general')}
                        >
                          <SlidersHorizontal />
                          <span>General</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="h-9 rounded-md px-3 text-sm data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
                          isActive={settingsSection === 'editor'}
                          onClick={() => setSettingsSection('editor')}
                        >
                          <Code2 />
                          <span>Editor</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="h-9 rounded-md px-3 text-sm data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
                          isActive={settingsSection === 'environment'}
                          onClick={() => setSettingsSection('environment')}
                        >
                          <SlidersHorizontal />
                          <span>Environment</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
            <main className="flex h-[620px] min-w-0 flex-1 flex-col overflow-hidden">
              <section className="min-h-0 flex-1 overflow-y-auto px-8 py-7 pr-12">
              {settingsSection === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">General settings</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Manage basic CurlDesk workspace behavior.</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span>
                      <span className="block text-sm">Enable auto-save</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Automatically save curl content to the local workspace.</span>
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`size-5 shrink-0 rounded-sm p-0 ${settings.autoSave ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                      aria-pressed={settings.autoSave}
                      onClick={() => setSettings((current) => ({ ...current, autoSave: !current.autoSave }))}
                    >
                      {settings.autoSave && <Check className="size-3.5" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span>
                      <span className="block text-sm">Accent color</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Choose the primary color for CurlDesk.</span>
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`size-3 rounded-full ${theme.swatch}`} />
                      {theme.label}
                    </div>
                  </div>
                  <div className="space-y-2 py-1">
                    <div>
                      <span className="block text-sm">curl executable</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Leave empty to use curl from the system PATH.</span>
                    </div>
                    <Input
                      value={settings.curlPath}
                      placeholder="curl"
                      aria-label="curl executable path"
                      onChange={(event) => setSettings((current) => ({ ...current, curlPath: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 py-1">
                    <div>
                      <span className="block text-sm">Request timeout</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Set milliseconds, or 0 for no application timeout.</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={settings.requestTimeoutMs}
                      aria-label="Request timeout in milliseconds"
                      onChange={(event) => setSettings((current) => ({ ...current, requestTimeoutMs: Math.max(0, Number(event.target.value) || 0) }))}
                    />
                  </div>
                </div>
              )}
              {settingsSection === 'editor' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editor settings</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Adjust how request and response content is displayed.</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span>
                      <span className="block text-sm">Editor font size</span>
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
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span>
                      <span className="block text-sm">Wrap output</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Wrap long response content to fit the current panel.</span>
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`size-5 shrink-0 rounded-sm p-0 ${settings.wrapOutput ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                      aria-pressed={settings.wrapOutput}
                      onClick={() => setSettings((current) => ({ ...current, wrapOutput: !current.wrapOutput }))}
                    >
                      {settings.wrapOutput && <Check className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              )}
              {settingsSection === 'environment' && (
                <EnvironmentEditor
                  workspaceEnvironments={environments}
                  globalEnvironments={globalEnvironments}
                  activeEnvironment={activeEnvironment}
                  onSelectEnvironment={setActiveEnvironment}
                  onWorkspaceChange={saveEnvironments}
                  onGlobalChange={saveGlobalEnvironments}
                  onLoadDotEnv={() => void loadDotEnv()}
                  onSaveDotEnv={() => void saveDotEnv()}
                />
              )}
              </section>
            </main>
          </SidebarProvider>
        </DialogContent>
      </Dialog>
      )}

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
                {latestRelease?.assetName && <p className="text-xs text-muted-foreground">Package: {latestRelease.assetName}</p>}
                <Button onClick={() => void installUpdate()}>
                  <Download className="mr-2 size-4" />{latestRelease?.downloadUrl && isWindows ? 'Download and install' : 'Download update'}
                </Button>
                <Button variant="ghost" onClick={() => void Browser.OpenURL(latestRelease?.url || RELEASES_URL)}>View release notes</Button>
              </div>
            )}
            {updateState === 'installing' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Downloading update and preparing installation…
              </div>
            )}
            {updateState === 'error' && (
              <div className="flex w-full flex-col gap-3">
                <p className="text-muted-foreground">Unable to complete the update right now. You can open the release page and download it manually.</p>
                <Button variant="outline" onClick={() => void Browser.OpenURL(latestRelease?.url || RELEASES_URL)}>Open release page</Button>
                <Button variant="outline" onClick={() => void checkForUpdates()}><RefreshCw className="mr-2 size-4" />Try again</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CommandPalette open={commandPaletteOpen} commands={paletteCommands} onOpenChange={setCommandPaletteOpen} />

        <footer className="flex h-8 shrink-0 items-center justify-between border-t px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className={`${statusBarActionClass} gap-1`} aria-label={`Theme, current ${theme.label}`}>
                      <Palette className="size-3.5" />
                      <span>Theme</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Change theme · {theme.label}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="top" align="start" className="w-36">
                <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'light' }))} className="gap-2"><Sun className="size-3.5" /><span className="flex-1">Light</span>{settings.appearance === 'light' && <Check className="size-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'dark' }))} className="gap-2"><Moon className="size-3.5" /><span className="flex-1">Dark</span>{settings.appearance === 'dark' && <Check className="size-3.5" />}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSettings((current) => ({ ...current, appearance: 'system' }))} className="gap-2"><Monitor className="size-3.5" /><span className="flex-1">System</span>{settings.appearance === 'system' && <Check className="size-3.5" />}</DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(themeColors).map(([key, color]) => <DropdownMenuItem key={key} onSelect={() => setSettings((current) => ({ ...current, themeColor: key as ThemeColor }))} className="gap-2"><span className={`size-3 rounded-full ${color.swatch}`} /><span className="flex-1">{color.label}</span>{settings.themeColor === key && <Check className="size-3.5" />}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-3" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={`${statusBarActionClass} gap-1`} aria-label="Settings" onClick={() => openPage('settings')}>
                  <Settings2 className="size-3.5" />
                  <span>Settings</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Settings</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://github.com/FearlessPeople/curldesk" aria-label="Open CurlDesk on GitHub" onClick={(event) => { event.preventDefault(); void Browser.OpenURL('https://github.com/FearlessPeople/curldesk') }} className={`${statusBarActionClass} flex items-center gap-1`}>
                  <Github className="size-3.5" /> GitHub
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">Open CurlDesk on GitHub</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-3" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={statusBarActionClass} aria-label="Check for updates" onClick={() => void checkForUpdates()}>v{__APP_VERSION__}</Button>
              </TooltipTrigger>
              <TooltipContent side="top">Check for updates</TooltipContent>
            </Tooltip>
          </div>
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
