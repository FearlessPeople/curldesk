import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { isSensitiveVariable } from './environment-utils'

type Environments = Record<string, Record<string, string>>
type EnvironmentScope = 'workspace' | 'global'

type EnvironmentEditorProps = {
  workspaceEnvironments: Environments
  globalEnvironments: Environments
  activeEnvironment: string
  onSelectEnvironment: (name: string) => void
  onWorkspaceChange: (environments: Environments) => void
  onGlobalChange: (environments: Environments) => void
  onLoadDotEnv: () => void
  onSaveDotEnv: () => void
}

function nextEnvironmentName(environments: Environments) {
  let index = Object.keys(environments).length + 1
  let name = `Environment-${index}`
  while (environments[name]) {
    index += 1
    name = `Environment-${index}`
  }
  return name
}

export function EnvironmentEditor({
  workspaceEnvironments,
  globalEnvironments,
  activeEnvironment,
  onSelectEnvironment,
  onWorkspaceChange,
  onGlobalChange,
  onLoadDotEnv,
  onSaveDotEnv,
}: EnvironmentEditorProps) {
  const [scope, setScope] = useState<EnvironmentScope>('workspace')
  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [draftVariables, setDraftVariables] = useState<Record<string, string>>({})
  const source = scope === 'workspace' ? workspaceEnvironments : globalEnvironments
  const environmentNames = useMemo(() => Object.keys(source), [source])
  const visibleNames = useMemo(
    () => environmentNames.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [environmentNames, search],
  )
  const selectedName = source[activeEnvironment] ? activeEnvironment : environmentNames[0] || 'Dev'
  const currentVariables = source[selectedName] || {}
  const currentVariablesKey = JSON.stringify(currentVariables)

  useEffect(() => {
    setDraftVariables({ ...currentVariables })
    setRevealed({})
  }, [scope, selectedName, currentVariablesKey])

  useEffect(() => {
    if (selectedName !== activeEnvironment) onSelectEnvironment(selectedName)
  }, [activeEnvironment, onSelectEnvironment, selectedName])

  const updateSource = (next: Environments) => {
    if (scope === 'workspace') onWorkspaceChange(next)
    else onGlobalChange(next)
  }

  const createEnvironment = () => {
    const name = nextEnvironmentName(source)
    updateSource({ ...source, [name]: {} })
    onSelectEnvironment(name)
  }

  const deleteEnvironment = () => {
    if (environmentNames.length <= 1) return
    const next = { ...source }
    delete next[selectedName]
    updateSource(next)
    onSelectEnvironment(Object.keys(next)[0] || 'Dev')
  }

  const saveVariables = () => updateSource({ ...source, [selectedName]: draftVariables })
  const resetVariables = () => setDraftVariables({ ...currentVariables })

  const addVariable = () => {
    let index = Object.keys(draftVariables).length + 1
    let key = `VARIABLE_${index}`
    while (draftVariables[key] !== undefined) {
      index += 1
      key = `VARIABLE_${index}`
    }
    setDraftVariables((current) => ({ ...current, [key]: '' }))
  }

  const renameVariable = (oldKey: string, newKey: string) => {
    const trimmed = newKey.trim()
    if (!trimmed || trimmed === oldKey || draftVariables[trimmed] !== undefined) return
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(draftVariables)) next[key === oldKey ? trimmed : key] = value
    setDraftVariables(next)
  }

  const removeVariable = (key: string) => {
    const next = { ...draftVariables }
    delete next[key]
    setDraftVariables(next)
  }

  return (
    <div className="-mx-8 -my-7 flex min-h-[566px] overflow-hidden">
      <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/20 p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Environments</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Create environment" onClick={createEnvironment}><Plus className="size-3.5" /></Button>
        </div>
        <div className="mb-3 grid grid-cols-2 rounded-md bg-muted p-0.5">
          <button type="button" className={`rounded-sm px-2 py-1.5 text-[11px] transition-colors ${scope === 'workspace' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setScope('workspace')}>Workspace</button>
          <button type="button" className={`rounded-sm px-2 py-1.5 text-[11px] transition-colors ${scope === 'global' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setScope('global')}>Global</button>
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search environments..." aria-label="Search environments" className="mb-3 h-8 bg-background text-xs" />
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {visibleNames.map((name) => (
            <button key={name} type="button" className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${selectedName === name ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`} onClick={() => onSelectEnvironment(name)}>
              <span className="min-w-0 truncate">{name}</span>
              {selectedName === name && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {visibleNames.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No environments found.</p>}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex items-center justify-between border-b px-7 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h3 className="truncate text-base font-semibold">{selectedName}</h3><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{scope}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{scope === 'global' ? 'Available across all workspaces.' : 'Stored in the current workspace.'}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Delete environment" onClick={deleteEnvironment} disabled={environmentNames.length <= 1}><Trash2 className="size-3.5" /></Button>
        </header>
        <div className="flex items-center gap-5 border-b px-7"><div className="border-b-2 border-primary py-3 text-xs font-medium text-foreground">Variables <span className="text-muted-foreground">{Object.keys(draftVariables).length}</span></div><div className="py-3 text-xs text-muted-foreground">Secrets</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"><span>Name</span><span>Value</span><span>Type</span><span /></div>
            {Object.entries(draftVariables).map(([key, value], index) => {
              const sensitive = isSensitiveVariable(key)
              const visible = revealed[key] || !sensitive
              return (
                <div key={`${selectedName}-${index}`} className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center gap-2 border-b px-3 py-2 last:border-b-0">
                  <Input value={key} className="h-8 border-transparent bg-transparent px-1.5 text-xs shadow-none focus-visible:border-input focus-visible:bg-background" aria-label={`Variable name ${key}`} onChange={(event) => renameVariable(key, event.target.value)} onBlur={(event) => renameVariable(key, event.target.value)} />
                  <div className="relative"><Input type={visible ? 'text' : 'password'} value={value} className="h-8 border-transparent bg-transparent px-1.5 pr-8 font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background" aria-label={`Value for ${key}`} onChange={(event) => setDraftVariables((current) => ({ ...current, [key]: event.target.value }))} />{sensitive && <button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={visible ? `Hide ${key}` : `Show ${key}`} onClick={() => setRevealed((current) => ({ ...current, [key]: !visible }))}>{visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>}</div>
                  <div className="flex items-center gap-1 px-1.5 text-xs text-muted-foreground">string <ChevronDown className="size-3" /></div>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Remove ${key}`} onClick={() => removeVariable(key)}><Trash2 className="size-3.5" /></Button>
                </div>
              )
            })}
            <div className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center gap-2 px-3 py-2"><span className="px-1.5 text-xs text-muted-foreground">Name</span><span className="px-1.5 text-xs text-muted-foreground">Value</span><span className="px-1.5 text-xs text-muted-foreground">Description</span><span /></div>
          </div>
          <div className="mt-4 flex items-center gap-3"><Button variant="default" size="sm" onClick={saveVariables}><Save className="size-3.5" />Save</Button><Button variant="link" size="sm" className="px-0 text-primary" onClick={resetVariables}>Reset</Button><Button variant="outline" size="sm" className="ml-auto" onClick={addVariable}><Plus className="size-3.5" />Add variable</Button>{scope === 'workspace' && <><Button variant="outline" size="sm" onClick={onLoadDotEnv}>Load .env</Button><Button variant="outline" size="sm" onClick={onSaveDotEnv}>Save .env</Button></>}</div>
        </div>
      </section>
    </div>
  )
}
