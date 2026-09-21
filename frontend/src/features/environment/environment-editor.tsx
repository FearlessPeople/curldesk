import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from 'lucide-react'

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
  const [variableSearch, setVariableSearch] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [draftVariables, setDraftVariables] = useState<Record<string, string>>({})
  const [pendingVariables, setPendingVariables] = useState([{ name: '', value: '' }])
  const [renamingEnvironment, setRenamingEnvironment] = useState(false)
  const [environmentNameDraft, setEnvironmentNameDraft] = useState('')
  const source = scope === 'workspace' ? workspaceEnvironments : globalEnvironments
  const environmentNames = useMemo(() => Object.keys(source), [source])
  const visibleNames = useMemo(
    () => environmentNames.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [environmentNames, search],
  )
  const selectedName = source[activeEnvironment] ? activeEnvironment : environmentNames[0] || 'Dev'
  const currentVariables = source[selectedName] || {}
  const currentVariablesKey = JSON.stringify(currentVariables)
  const visibleVariables = useMemo(() => {
    const query = variableSearch.trim().toLowerCase()
    return Object.entries(draftVariables).filter(([key, value]) => !query || `${key} ${value}`.toLowerCase().includes(query))
  }, [draftVariables, variableSearch])

  useEffect(() => {
    setDraftVariables({ ...currentVariables })
    setRevealed({})
    setPendingVariables([{ name: '', value: '' }])
    setRenamingEnvironment(false)
    setEnvironmentNameDraft(selectedName)
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

  const startRenameEnvironment = () => {
    setEnvironmentNameDraft(selectedName)
    setRenamingEnvironment(true)
  }

  const cancelRenameEnvironment = () => {
    setEnvironmentNameDraft(selectedName)
    setRenamingEnvironment(false)
  }

  const saveEnvironmentName = () => {
    const nextName = environmentNameDraft.trim()
    if (!nextName || nextName === selectedName || source[nextName]) {
      if (nextName === selectedName) setRenamingEnvironment(false)
      return
    }
    const next: Environments = {}
    for (const [name, variables] of Object.entries(source)) next[name === selectedName ? nextName : name] = variables
    updateSource(next)
    onSelectEnvironment(nextName)
    setRenamingEnvironment(false)
  }

  const deleteEnvironment = () => {
    if (environmentNames.length <= 1) return
    const next = { ...source }
    delete next[selectedName]
    updateSource(next)
    onSelectEnvironment(Object.keys(next)[0] || 'Dev')
  }

  const saveVariables = () => {
    const nextVariables = { ...draftVariables }
    for (const pending of pendingVariables) {
      const pendingName = pending.name.trim()
      if (pendingName && nextVariables[pendingName] === undefined) nextVariables[pendingName] = pending.value
    }
    updateSource({ ...source, [selectedName]: nextVariables })
    setDraftVariables(nextVariables)
    setPendingVariables([{ name: '', value: '' }])
  }
  const resetVariables = () => {
    setDraftVariables({ ...currentVariables })
    setPendingVariables([{ name: '', value: '' }])
  }

  const updatePendingVariable = (index: number, field: 'name' | 'value', value: string) => {
    setPendingVariables((current) => {
      const next = current.map((variable, variableIndex) => variableIndex === index ? { ...variable, [field]: value } : variable)
      if (index === current.length - 1 && value.trim()) next.push({ name: '', value: '' })
      return next
    })
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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-52 shrink-0 flex-col border-r bg-background p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Environments</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Create environment" title="Create environment" onClick={createEnvironment}><Plus className="size-3.5" /></Button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 rounded-md bg-muted p-0.5">
          <button type="button" className={`rounded-sm px-2 py-1.5 text-[11px] transition-colors ${scope === 'workspace' ? 'bg-primary/10 font-medium text-primary shadow-sm' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`} onClick={() => setScope('workspace')}>Workspace</button>
          <button type="button" className={`rounded-sm px-2 py-1.5 text-[11px] transition-colors ${scope === 'global' ? 'bg-primary/10 font-medium text-primary shadow-sm' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`} onClick={() => setScope('global')}>Global</button>
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search environments..." aria-label="Search environments" className="mb-3 h-8 bg-background text-xs" />
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {visibleNames.map((name) => (
            <div key={name} className={`group/environment flex w-full items-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${selectedName === name ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}>
              {renamingEnvironment && selectedName === name ? (
                <Input autoFocus value={environmentNameDraft} onChange={(event) => setEnvironmentNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEnvironmentName(); if (event.key === 'Escape') cancelRenameEnvironment() }} aria-label="Environment name" className="h-7 min-w-0 flex-1 px-2 text-sm" />
              ) : (
                <button type="button" className="min-w-0 flex-1 truncate py-1 text-left" onClick={() => onSelectEnvironment(name)}>{name}</button>
              )}
              {selectedName === name && !renamingEnvironment && <>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 transition-opacity group-hover/environment:opacity-100 group-focus-within/environment:opacity-100" aria-label="Rename environment" title="Rename environment" onClick={startRenameEnvironment}><Pencil className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/environment:opacity-100 group-focus-within/environment:opacity-100" aria-label="Delete environment" title="Delete environment" onClick={deleteEnvironment} disabled={environmentNames.length <= 1}><Trash2 className="size-3.5" /></Button>
                <Check className="ml-1 size-3.5 shrink-0 text-primary" />
              </>}
              {selectedName === name && renamingEnvironment && <div className="ml-1 flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon" className="size-7 text-primary" aria-label="Save environment name" onClick={saveEnvironmentName}><Check className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Cancel renaming environment" onClick={cancelRenameEnvironment}><X className="size-3.5" /></Button>
              </div>}
            </div>
          ))}
          {visibleNames.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No environments found.</p>}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex items-center justify-between border-b px-7 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{selectedName}</h3>
          </div>
        </header>
        <div className="flex items-center border-b px-7"><div className="border-b-2 border-primary py-3 text-xs font-medium text-foreground">Variables <span className="text-muted-foreground">{Object.keys(draftVariables).length}</span></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <Input value={variableSearch} onChange={(event) => setVariableSearch(event.target.value)} placeholder="Search variables..." aria-label="Search variables" className="mb-3 h-8 text-xs" />
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"><span>Name</span><span>Value</span><span>Type</span><span /></div>
            {visibleVariables.map(([key, value], index) => {
              const sensitive = isSensitiveVariable(key)
              const visible = revealed[key] || !sensitive
              return (
                <div key={`${selectedName}-${index}`} className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center gap-2 border-b px-3 py-2 last:border-b-0">
                  <Input defaultValue={key} className="h-8 border-transparent bg-transparent px-1.5 text-xs shadow-none focus-visible:border-input focus-visible:bg-background" aria-label={`Variable name ${key}`} onBlur={(event) => renameVariable(key, event.target.value)} />
                  <div className="relative"><Input type={visible ? 'text' : 'password'} value={value} className="h-8 border-transparent bg-transparent px-1.5 pr-8 font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background" aria-label={`Value for ${key}`} onChange={(event) => setDraftVariables((current) => ({ ...current, [key]: event.target.value }))} />{sensitive && <button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={visible ? `Hide ${key}` : `Show ${key}`} onClick={() => setRevealed((current) => ({ ...current, [key]: !visible }))}>{visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>}</div>
                  <div className="flex items-center gap-1 px-1.5 text-xs text-muted-foreground">string <ChevronDown className="size-3" /></div>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Remove ${key}`} onClick={() => removeVariable(key)}><Trash2 className="size-3.5" /></Button>
                </div>
              )
            })}
            {visibleVariables.length === 0 && pendingVariables.every((variable) => !variable.name.trim() && !variable.value.trim()) && <div className="px-3 py-5 text-center text-xs text-muted-foreground">No variables found.</div>}
            {pendingVariables.map((variable, index) => (
              <div key={`pending-${index}`} className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center gap-2 border-t px-3 py-2">
                <Input value={variable.name} placeholder="Name" aria-label="New variable name" className="h-8 border-transparent bg-transparent px-1.5 text-xs shadow-none focus-visible:border-input focus-visible:bg-background" onChange={(event) => updatePendingVariable(index, 'name', event.target.value)} />
                <Input value={variable.value} placeholder="Value" aria-label="New variable value" className="h-8 border-transparent bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background" onChange={(event) => updatePendingVariable(index, 'value', event.target.value)} />
                <span className="px-1.5 text-xs text-muted-foreground">string</span>
                <span />
              </div>
            ))}
            <div className="grid grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_minmax(100px,0.6fr)_32px] items-center gap-2 px-3 py-2"><span className="px-1.5 text-xs text-muted-foreground">Name</span><span className="px-1.5 text-xs text-muted-foreground">Value</span><span className="px-1.5 text-xs text-muted-foreground">Description</span><span /></div>
          </div>
          <div className="mt-4 flex items-center gap-3"><Button variant="default" size="sm" onClick={saveVariables}><Save className="size-3.5" />Save</Button><Button variant="link" size="sm" className="px-0 text-primary" onClick={resetVariables}>Reset</Button>{scope === 'workspace' && <div className="ml-auto flex items-center gap-2"><Button variant="outline" size="sm" onClick={onLoadDotEnv}>Load .env</Button><Button variant="outline" size="sm" onClick={onSaveDotEnv}>Save .env</Button></div>}</div>
        </div>
      </section>
    </div>
  )
}
