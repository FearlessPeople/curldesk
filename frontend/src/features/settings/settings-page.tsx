import { Check, Code2, History, Settings2 } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { HistoryPage } from '@/features/history/history-page'
import type { HistoryEntry } from '../../../bindings/curldesk/models'

type AppSettings = {
  autoSave: boolean
  editorFontSize: number
  wrapOutput: boolean
  historyLimit: number
  curlPath: string
  requestTimeoutMs: number
  themeColor: string
  appearance: string
}

export type SettingsSection = 'general' | 'editor' | 'history'
type SettingsSectionValue = SettingsSection | 'environment'

type SettingsPageProps = {
  settings: AppSettings
  onSettingsChange: (update: (current: AppSettings) => AppSettings) => void
  section: SettingsSectionValue
  onSectionChange: (section: SettingsSectionValue) => void
  themeLabel: string
  themeSwatch: string
  historyEntries: HistoryEntry[]
  onHistorySearch: (query: string) => void
  onClearHistory: () => void
}

export function SettingsPage({
  settings,
  onSettingsChange,
  section,
  onSectionChange,
  themeLabel,
  themeSwatch,
  historyEntries,
  onHistorySearch,
  onClearHistory,
}: SettingsPageProps) {
  const settingsNavButtonClass = 'h-8 w-full justify-start gap-2 px-2 text-sm hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary'

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-52 shrink-0 border-r bg-background p-3 md:block">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Settings</div>
        <nav className="space-y-1">
          <Button variant="ghost" className={settingsNavButtonClass} data-active={section === 'general'} onClick={() => onSectionChange('general')}>
            <Settings2 className="size-4" /> General
          </Button>
          <Button variant="ghost" className={settingsNavButtonClass} data-active={section === 'editor'} onClick={() => onSectionChange('editor')}>
            <Code2 className="size-4" /> Editor
          </Button>
          <div className="px-2 pb-0.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Tools</div>
          <Button variant="ghost" className={settingsNavButtonClass} data-active={section === 'history'} onClick={() => onSectionChange('history')}>
            <History className="size-4" /> History
          </Button>
        </nav>
      </aside>
      <main className={`min-w-0 flex-1 overflow-y-auto ${section === 'history' ? 'p-0' : 'px-8 py-5 pr-12'}`}>
        {section === 'general' && (
          <div className="max-w-2xl space-y-3">
            <div>
              <h2 className="text-base font-semibold">General settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage basic CurlDesk workspace behavior.</p>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5">
              <span><span className="block text-sm">Auto-save</span><span className="mt-0.5 block text-xs text-muted-foreground">Automatically save curl content to the local workspace.</span></span>
              <Button variant="outline" size="icon" className={`size-5 shrink-0 rounded-sm p-0 ${settings.autoSave ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`} aria-label="Toggle auto-save" aria-pressed={settings.autoSave} onClick={() => onSettingsChange((current) => ({ ...current, autoSave: !current.autoSave }))}>{settings.autoSave && <Check className="size-3.5" />}</Button>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5"><span><span className="block text-sm">Accent</span><span className="mt-0.5 block text-xs text-muted-foreground">Choose the primary color for CurlDesk.</span></span><div className="flex items-center gap-2 text-sm"><span className={`size-3 rounded-full ${themeSwatch}`} />{themeLabel}</div></div>
            <div className="space-y-1.5 py-0.5"><div><span className="block text-sm">curl path</span><span className="mt-0.5 block text-xs text-muted-foreground">Leave empty to use curl from the system PATH.</span></div><Input value={settings.curlPath} placeholder="curl" aria-label="curl executable path" onChange={(event) => onSettingsChange((current) => ({ ...current, curlPath: event.target.value }))} /></div>
            <div className="space-y-1.5 py-0.5"><div><span className="block text-sm">Timeout</span><span className="mt-0.5 block text-xs text-muted-foreground">Set milliseconds, or 0 for no application timeout.</span></div><Input type="number" min={0} step={1000} value={settings.requestTimeoutMs} aria-label="Request timeout in milliseconds" onChange={(event) => onSettingsChange((current) => ({ ...current, requestTimeoutMs: Math.max(0, Number(event.target.value) || 0) }))} /></div>
            <div className="space-y-1.5 py-0.5"><div><span className="block text-sm">History limit</span><span className="mt-0.5 block text-xs text-muted-foreground">Maximum number of recent requests to keep available.</span></div><Input type="number" min={10} max={1000} step={10} value={settings.historyLimit} aria-label="History limit" onChange={(event) => onSettingsChange((current) => ({ ...current, historyLimit: Math.min(1000, Math.max(10, Number(event.target.value) || current.historyLimit)) }))} /></div>
          </div>
        )}
        {section === 'editor' && (
          <div className="max-w-2xl space-y-3">
            <div><h2 className="text-base font-semibold">Editor settings</h2><p className="mt-1 text-sm text-muted-foreground">Adjust how request and response content is displayed.</p></div>
            <div className="flex items-center justify-between gap-4 py-0.5"><span><span className="block text-sm">Font size</span><span className="mt-0.5 block text-xs text-muted-foreground">Applied to both request and output editors.</span></span><div className="flex items-center gap-1">{[12, 13, 14, 15, 16, 18].map((size) => <Button key={size} variant={settings.editorFontSize === size ? 'secondary' : 'ghost'} size="sm" className="h-8 min-w-9 px-2" aria-pressed={settings.editorFontSize === size} onClick={() => onSettingsChange((current) => ({ ...current, editorFontSize: size }))}>{size}</Button>)}</div></div>
            <div className="flex items-center justify-between gap-4 py-0.5"><span><span className="block text-sm">Wrap response</span><span className="mt-0.5 block text-xs text-muted-foreground">Wrap long response content to fit the current panel.</span></span><Button variant="outline" size="icon" className={`size-5 shrink-0 rounded-sm p-0 ${settings.wrapOutput ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`} aria-label="Toggle output wrapping" aria-pressed={settings.wrapOutput} onClick={() => onSettingsChange((current) => ({ ...current, wrapOutput: !current.wrapOutput }))}>{settings.wrapOutput && <Check className="size-3.5" />}</Button></div>
          </div>
        )}
        {section === 'history' && <HistoryPage entries={historyEntries} onSearch={onHistorySearch} onClear={onClearHistory} />}
      </main>
    </div>
  )
}
