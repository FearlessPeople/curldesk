import { useEffect, useState } from 'react'
import { ChevronDown, Download, FolderOpen, FolderPlus, Settings2 } from 'lucide-react'

import { Events } from '@wailsio/runtime'
import { Button } from '@/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/dropdown-menu'
import { Input } from '@/components/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip'
import { WorkspaceService } from '../../../bindings/curldesk'
import type { WorkspaceInfo } from '../../../bindings/curldesk/models'

type WorkspaceSwitcherProps = {
  current: WorkspaceInfo
  onChanged: (workspace: WorkspaceInfo) => void
}

type DialogMode = 'create' | 'open' | 'import' | 'manage' | null

export function WorkspaceSwitcher({ current, onChanged }: WorkspaceSwitcherProps) {
  const [recent, setRecent] = useState<WorkspaceInfo[]>([])
  const [mode, setMode] = useState<DialogMode>(null)
  const [path, setPath] = useState('')
  const [error, setError] = useState('')

  const loadRecent = async () => {
    try { setRecent((await WorkspaceService.ListRecentWorkspaces()) ?? []) } catch { setRecent([]) }
  }

  useEffect(() => { void loadRecent() }, [current.path])

  const openMode = (next: Exclude<DialogMode, null>) => {
    setError('')
    setPath(next === 'create' ? `${current.path}/NewWorkspace` : '')
    setMode(next)
  }

  const switchWorkspace = async (workspacePath: string) => {
    try {
      const workspace = await WorkspaceService.OpenWorkspace(workspacePath)
      onChanged(workspace)
      await Events.Emit('curldesk:workspace-changed')
      await Events.Emit('curldesk:collections-changed')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open workspace.')
    }
  }

  const submit = async () => {
    if (!path.trim() || mode === 'manage') return
    try {
      if (mode === 'create') {
        onChanged(await WorkspaceService.CreateWorkspace(path))
      } else if (mode === 'open') {
        onChanged(await WorkspaceService.OpenWorkspace(path))
      } else if (mode === 'import') {
        await WorkspaceService.ImportWorkspace(path)
        await Events.Emit('curldesk:collections-changed')
      }
      await Events.Emit('curldesk:workspace-changed')
      await Events.Emit('curldesk:collections-changed')
      setMode(null)
      setPath('')
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update workspace.')
    }
  }

  return (
    <>
      <div className="h-10 shrink-0 border-b px-2 py-1">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-full justify-between px-2.5 text-xs font-medium hover:bg-muted">
                  <span className="min-w-0 truncate">{current.name || 'Workspace'}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Switch workspace</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="bottom" className="w-64">
            <DropdownMenuLabel>Recent workspaces</DropdownMenuLabel>
            {recent.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No recent workspaces</div>}
            {recent.map((workspace) => (
              <DropdownMenuItem key={workspace.path} onSelect={() => void switchWorkspace(workspace.path)}>
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.path === current.path && <span className="text-[10px] text-muted-foreground">Current</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openMode('create')}><FolderPlus /> Create workspace</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openMode('open')}><FolderOpen /> Open workspace</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openMode('import')}><Download /> Import workspace</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openMode('manage')}><Settings2 /> Manage workspaces</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Create workspace' : mode === 'open' ? 'Open workspace' : mode === 'import' ? 'Import workspace' : 'Manage workspaces'}</DialogTitle>
            <DialogDescription>
              {mode === 'create' ? 'Choose a folder for a new local workspace.' : mode === 'open' ? 'Enter the path of an existing workspace folder.' : mode === 'import' ? 'Import .curl files from another folder into the current workspace.' : 'Choose a recent workspace to switch to.'}
            </DialogDescription>
          </DialogHeader>
          {mode === 'manage' ? (
            <div className="space-y-1">
              {recent.map((workspace) => (
                <Button key={workspace.path} variant="ghost" className="h-auto w-full justify-start px-2 py-2 text-left" onClick={() => { void switchWorkspace(workspace.path); setMode(null) }}>
                  <span className="min-w-0 flex-1"><span className="block text-sm">{workspace.name}</span><span className="block truncate text-xs text-muted-foreground">{workspace.path}</span></span>
                </Button>
              ))}
              {recent.length === 0 && <p className="py-4 text-sm text-muted-foreground">No recent workspaces.</p>}
            </div>
          ) : (
            <Input autoFocus value={path} onChange={(event) => setPath(event.target.value)} placeholder="/Users/you/CurlDeskWorkspace" aria-label="Workspace path" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {mode !== 'manage' && <DialogFooter><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button><Button onClick={() => void submit()} disabled={!path.trim()}>{mode === 'create' ? 'Create' : mode === 'import' ? 'Import' : 'Open'}</Button></DialogFooter>}
        </DialogContent>
      </Dialog>
    </>
  )
}
