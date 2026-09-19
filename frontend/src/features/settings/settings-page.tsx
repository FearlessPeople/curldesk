import { Check, Code2, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { EnvironmentEditor } from '@/features/environment/environment-editor'

type AppSettings = {
  autoSave: boolean
  editorFontSize: number
  wrapOutput: boolean
  curlPath: string
  requestTimeoutMs: number
  themeColor: string
  appearance: string
}

type SettingsSection = 'general' | 'editor' | 'environment'
type Environments = Record<string, Record<string, string>>

type SettingsPageProps = {
  settings: AppSettings
  onSettingsChange: (update: (current: AppSettings) => AppSettings) => void
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  themeLabel: string
  themeSwatch: string
  environments: Environments
  globalEnvironments: Environments
  activeEnvironment: string
  onSelectEnvironment: (name: string) => void
  onWorkspaceChange: (environments: Environments) => void
  onGlobalChange: (environments: Environments) => void
  onLoadDotEnv: () => void
  onSaveDotEnv: () => void
}

export function SettingsPage({
  settings,
  onSettingsChange,
  section,
  onSectionChange,
  themeLabel,
  themeSwatch,
  environments,
  globalEnvironments,
  activeEnvironment,
  onSelectEnvironment,
  onWorkspaceChange,
  onGlobalChange,
  onLoadDotEnv,
  onSaveDotEnv,
}: SettingsPageProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-52 shrink-0 border-r bg-muted/20 p-3 md:block">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Settings</div>
        <nav className="space-y-1">
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 px-3 text-sm data-[active=true]:bg-muted" data-active={section === 'general'} onClick={() => onSectionChange('general')}>
            <SlidersHorizontal className="size-4" /> General
          </Button>
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 px-3 text-sm data-[active=true]:bg-muted" data-active={section === 'editor'} onClick={() => onSectionChange('editor')}>
            <Code2 className="size-4" /> Editor
          </Button>
          <Button variant="ghost" className="h-9 w-full justify-start gap-2 px-3 text-sm data-[active=true]:bg-muted" data-active={section === 'environment'} onClick={() => onSectionChange('environment')}>
            <SlidersHorizontal className="size-4" /> Environment
          </Button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7 pr-12">
        {section === 'general' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold">General settings</h2>
              <p className="mt-2 text-sm text-muted-foreground">Manage basic CurlDesk workspace behavior.</p>
            </div>
            <div className="flex items-center justify-between gap-4 py-1">
              <span><span className="block text-sm">Enable auto-save</span><span className="mt-1 block text-xs text-muted-foreground">Automatically save curl content to the local workspace.</span></span>
              <Button variant="outline" size="icon" className={`size-5 shrink-0 rounded-sm p-0 ${settings.autoSave ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`} aria-label="Toggle auto-save" aria-pressed={settings.autoSave} onClick={() => onSettingsChange((current) => ({ ...current, autoSave: !current.autoSave }))}>{settings.autoSave && <Check className="size-3.5" />}</Button>
            </div>
            <div className="flex items-center justify-between gap-4 py-1"><span><span className="block text-sm">Accent color</span><span className="mt-1 block text-xs text-muted-foreground">Choose the primary color for CurlDesk.</span></span><div className="flex items-center gap-2 text-sm"><span className={`size-3 rounded-full ${themeSwatch}`} />{themeLabel}</div></div>
            <div className="space-y-2 py-1"><div><span className="block text-sm">curl executable</span><span className="mt-1 block text-xs text-muted-foreground">Leave empty to use curl from the system PATH.</span></div><Input value={settings.curlPath} placeholder="curl" aria-label="curl executable path" onChange={(event) => onSettingsChange((current) => ({ ...current, curlPath: event.target.value }))} /></div>
            <div className="space-y-2 py-1"><div><span className="block text-sm">Request timeout</span><span className="mt-1 block text-xs text-muted-foreground">Set milliseconds, or 0 for no application timeout.</span></div><Input type="number" min={0} step={1000} value={settings.requestTimeoutMs} aria-label="Request timeout in milliseconds" onChange={(event) => onSettingsChange((current) => ({ ...current, requestTimeoutMs: Math.max(0, Number(event.target.value) || 0) }))} /></div>
          </div>
        )}
        {section === 'editor' && (
          <div className="max-w-2xl space-y-6">
            <div><h2 className="text-base font-semibold">Editor settings</h2><p className="mt-2 text-sm text-muted-foreground">Adjust how request and response content is displayed.</p></div>
            <div className="flex items-center justify-between gap-4 py-1"><span><span className="block text-sm">Editor font size</span><span className="mt-1 block text-xs text-muted-foreground">Applied to both request and output editors.</span></span><div className="flex items-center gap-1">{[12, 13, 14, 15, 16, 18].map((size) => <Button key={size} variant={settings.editorFontSize === size ? 'secondary' : 'ghost'} size="sm" className="h-8 min-w-9 px-2" aria-pressed={settings.editorFontSize === size} onClick={() => onSettingsChange((current) => ({ ...current, editorFontSize: size }))}>{size}</Button>)}</div></div>
            <div className="flex items-center justify-between gap-4 py-1"><span><span className="block text-sm">Wrap output</span><span className="mt-1 block text-xs text-muted-foreground">Wrap long response content to fit the current panel.</span></span><Button variant="outline" size="icon" className={`size-5 shrink-0 rounded-sm p-0 ${settings.wrapOutput ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`} aria-label="Toggle output wrapping" aria-pressed={settings.wrapOutput} onClick={() => onSettingsChange((current) => ({ ...current, wrapOutput: !current.wrapOutput }))}>{settings.wrapOutput && <Check className="size-3.5" />}</Button></div>
          </div>
        )}
        {section === 'environment' && <EnvironmentEditor workspaceEnvironments={environments} globalEnvironments={globalEnvironments} activeEnvironment={activeEnvironment} onSelectEnvironment={onSelectEnvironment} onWorkspaceChange={onWorkspaceChange} onGlobalChange={onGlobalChange} onLoadDotEnv={onLoadDotEnv} onSaveDotEnv={onSaveDotEnv} />}
      </main>
    </div>
  )
}
