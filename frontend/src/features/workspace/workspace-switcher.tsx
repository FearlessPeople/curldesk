import { useEffect, useState } from 'react'
import { Check, ChevronDown, ExternalLink, FolderOpen, FolderPlus, Plus, Settings2, Trash2 } from 'lucide-react'

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

type DialogMode = 'create' | 'open' | 'manage' | null

export function WorkspaceSwitcher({ current, onChanged }: WorkspaceSwitcherProps) {
  const [recent, setRecent] = useState<WorkspaceInfo[]>([])
  const [mode, setMode] = useState<DialogMode>(null)
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadRecent = async () => {
    try { setRecent((await WorkspaceService.ListRecentWorkspaces()) ?? []) } catch { setRecent([]) }
  }

  useEffect(() => { void loadRecent() }, [current.path])

  const openMode = (next: Exclude<DialogMode, null>) => {
    setError('')
    setPath('')
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

  const openWorkspaceDirectory = async (workspacePath: string) => {
    try {
      await WorkspaceService.OpenWorkspaceInFileManager(workspacePath)
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open workspace directory.')
    }
  }

  const confirmDeleteWorkspace = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await WorkspaceService.DeleteWorkspace(deleteTarget.path)
      setRecent((current) => current.filter((workspace) => workspace.path !== deleteTarget.path))
      setDeleteTarget(null)
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to delete workspace.')
    } finally {
      setDeleting(false)
    }
  }

  const submit = async () => {
    if (!path.trim() || mode === 'manage') return
    try {
      if (mode === 'create') {
        onChanged(await WorkspaceService.CreateWorkspaceByName(path))
      } else if (mode === 'open') {
        onChanged(await WorkspaceService.OpenWorkspace(path))
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
            <DropdownMenuItem onSelect={() => openMode('manage')}><Settings2 /> Manage workspaces</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null) }}>
        <DialogContent className={mode === 'manage' ? 'max-w-3xl gap-0 overflow-hidden p-0' : 'max-w-md'}>
          {mode === 'manage' ? (
            <div>
              <header className="flex items-center justify-between border-b px-6 py-4 pr-12">
                <div>
                  <DialogTitle className="text-base">Manage Workspaces</DialogTitle>
                  <DialogDescription className="mt-1">Switch between isolated local workspaces.</DialogDescription>
                </div>
                <Button size="sm" onClick={() => openMode('create')}><Plus className="size-3.5" />Create workspace</Button>
              </header>
              {error && <p className="border-b px-6 py-2 text-xs text-destructive">{error}</p>}
              <div className="p-2">
                {recent.map((workspace) => (
                  <div key={workspace.path} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{workspace.name}</span>
                        {workspace.default && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Default</span>}
                        {workspace.path === current.path && <Check className="size-3.5 text-primary" />}
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">{workspace.path}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7" aria-label={`Open ${workspace.name} in file manager`} onClick={() => void openWorkspaceDirectory(workspace.path)}><ExternalLink className="size-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Open in file manager</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={workspace.default || workspace.path === current.path ? 0 : undefined}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${workspace.name}`}
                              disabled={workspace.default || workspace.path === current.path}
                              onClick={() => setDeleteTarget(workspace)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{workspace.default ? 'Default workspace cannot be deleted' : workspace.path === current.path ? 'Switch workspace before deleting' : 'Delete workspace'}</TooltipContent>
                      </Tooltip>
                      <Button variant="ghost" size="sm" onClick={() => { void switchWorkspace(workspace.path); setMode(null) }}>Open</Button>
                    </div>
                  </div>
                ))}
                {recent.length === 0 && <p className="px-4 py-8 text-sm text-muted-foreground">No recent workspaces.</p>}
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{mode === 'create' ? 'Create workspace' : 'Open workspace'}</DialogTitle>
                <DialogDescription>
                  {mode === 'create' ? 'Choose a name for a new local workspace.' : 'Enter the path of an existing workspace folder.'}
                </DialogDescription>
              </DialogHeader>
              <Input autoFocus value={path} onChange={(event) => setPath(event.target.value)} placeholder={mode === 'create' ? 'Workspace name' : '/Users/you/CurlDeskWorkspace'} aria-label={mode === 'create' ? 'Workspace name' : 'Workspace path'} onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button><Button onClick={() => void submit()} disabled={!path.trim()}>{mode === 'create' ? 'Create' : 'Open'}</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-medium text-foreground">{deleteTarget?.name}</span> and its local files from disk.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{deleteTarget?.path}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDeleteWorkspace()} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete workspace'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
