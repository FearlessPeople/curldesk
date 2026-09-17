import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Events } from '@wailsio/runtime'
import {
  ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, FilePlus2, Folder,
  FolderPlus, MoreHorizontal, Pencil, Trash2, Upload,
} from 'lucide-react'

import { WorkspaceService } from '../../bindings/curldesk'
import type { WorkspaceEntry } from '../../bindings/curldesk'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/collapsible'
import { Button } from '@/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/dialog'
import { Input } from '@/components/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuAction, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarRail,
} from '@/components/sidebar'

type AppSidebarProps = { onOpenFile?: (entry: WorkspaceEntry) => void }
type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
const COLLECTIONS_CHANGED_EVENT = 'curldesk:collections-changed'

function parentPath(path: string) {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '.' : path.slice(0, slash)
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

export function AppSidebar({ onOpenFile }: AppSidebarProps) {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([])
  const [methods, setMethods] = useState<Record<string, RequestMethod>>({})
  const [createMode, setCreateMode] = useState<'file' | 'folder' | null>(null)
  const [createParent, setCreateParent] = useState('.')
  const [createName, setCreateName] = useState('')
  const [renameTarget, setRenameTarget] = useState<WorkspaceEntry | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceEntry | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const importInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const workspaceEntries = (await WorkspaceService.ListWorkspace()) ?? []
      setEntries(workspaceEntries)

      const fileMethods = await Promise.all(workspaceEntries.filter((entry) => !entry.isDir).map(async (entry) => {
        try {
          return [entry.path, detectMethod(await WorkspaceService.ReadFile(entry.path))] as const
        } catch {
          return [entry.path, 'GET' as RequestMethod] as const
        }
      }))
      setMethods(Object.fromEntries(fileMethods))
    } catch (error) {
      console.error('Unable to load workspace', error)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const unsubscribe = Events.On(COLLECTIONS_CHANGED_EVENT, () => { void refresh() })
    return unsubscribe
  }, [refresh])

  const folders = useMemo(() => entries.filter((entry) => entry.isDir), [entries])
  const files = useMemo(() => entries.filter((entry) => !entry.isDir), [entries])

  const exportWorkspace = async () => {
    try {
      const exportedFiles = await Promise.all(files.map(async (file) => ({
        path: file.path,
        content: await WorkspaceService.ReadFile(file.path),
      })))
      const blob = new Blob([JSON.stringify({ version: 1, files: exportedFiles }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'curldesk-collections.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { console.error('Unable to export workspace', error) }
  }

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => file.name.toLowerCase().endsWith('.curl'))
    for (const file of selectedFiles) {
      try {
        const created = await WorkspaceService.CreateFile('', file.name)
        await WorkspaceService.SaveFile(created.path, await file.text())
      } catch (error) { console.error(`Unable to import ${file.name}`, error) }
    }
    event.target.value = ''
    await Events.Emit(COLLECTIONS_CHANGED_EVENT)
  }

  const beginCreate = (mode: 'file' | 'folder', parent = '.') => {
    setCreateMode(mode)
    setCreateParent(parent)
    setCreateName(mode === 'file' ? 'request' : '')
  }

  const cancelCreate = () => {
    setCreateMode(null)
    setCreateName('')
  }

  const submitCreate = async () => {
    const name = createName.trim()
    if (!createMode || !name) return
    try {
      if (createMode === 'folder') {
        await WorkspaceService.CreateFolder(createParent === '.' ? '' : createParent, name)
      } else {
        const created = await WorkspaceService.CreateFile(createParent === '.' ? '' : createParent, name)
        onOpenFile?.(created)
      }
      await Events.Emit(COLLECTIONS_CHANGED_EVENT)
      cancelCreate()
    } catch (error) {
      console.error('Unable to create collection item', error)
    }
  }

  const beginRename = (entry: WorkspaceEntry) => {
    setRenameTarget(entry)
    setRenameName(entry.isDir ? entry.name : entry.name.replace(/\.curl$/i, ''))
  }

  const cancelRename = () => {
    setRenameTarget(null)
    setRenameName('')
  }

  const submitRename = async () => {
    const name = renameName.trim()
    if (!renameTarget || !name) return
    if (name === renameTarget.name) {
      cancelRename()
      return
    }
    try { await WorkspaceService.RenameEntry(renameTarget.path, name); await Events.Emit(COLLECTIONS_CHANGED_EVENT) }
    catch (error) { console.error('Unable to rename entry', error) }
    cancelRename()
  }

  const beginDelete = (entry: WorkspaceEntry) => setDeleteTarget(entry)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try { await WorkspaceService.DeleteEntry(deleteTarget.path); await Events.Emit(COLLECTIONS_CHANGED_EVENT) }
    catch (error) { console.error('Unable to delete entry', error) }
    setDeleteTarget(null)
  }

  const toggleFolder = (path: string, open: boolean) => {
    setCollapsedFolders((current) => {
      const next = new Set(current)
      if (open) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const expandAll = () => setCollapsedFolders(new Set())
  const collapseAll = () => setCollapsedFolders(new Set(folders.map((folder) => folder.path)))
  const allFoldersExpanded = folders.length > 0 && collapsedFolders.size === 0

  const renderFolder = (folder: WorkspaceEntry, depth = 0) => {
    const children = entries.filter((entry) => parentPath(entry.path) === folder.path)
    return (
      <Collapsible key={folder.path} open={!collapsedFolders.has(folder.path)} onOpenChange={(open) => toggleFolder(folder.path, open)} className="group/collapsible">
        <SidebarMenuItem>
          <div className="group/folder-item relative">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className={`w-full ${depth > 0 ? 'pl-8' : ''}`}>
                <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                <span>{folder.name}</span>
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                      className="opacity-0 group-focus-within/folder-item:opacity-100 group-hover/folder-item:opacity-100 data-[state=open]:opacity-100"
                      aria-label={`${folder.name} actions`}
                    >
                      <MoreHorizontal />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">文件夹操作</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem onSelect={() => beginCreate('file', folder.path)}><FilePlus2 /> New curl file</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => beginCreate('folder', folder.path)}><FolderPlus /> New folder</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => beginRename(folder)}><Pencil /> Rename</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => beginDelete(folder)}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CollapsibleContent>
            <SidebarMenuSub>
              {children.filter((entry) => entry.isDir).map((child) => renderFolder(child, depth + 1))}
              {children.filter((entry) => !entry.isDir).map((file) => renderFile(file, depth + 1))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  const renderFile = (file: WorkspaceEntry, depth = 0) => (
    <SidebarMenuSubItem key={file.path} className="group/file-item relative w-full">
      <SidebarMenuSubButton asChild className={`w-full justify-start gap-0 ${depth > 0 ? 'pl-8' : ''}`}>
        <button type="button" onClick={() => onOpenFile?.(file)}>
          <span className={`w-8 shrink-0 font-mono text-[11px] font-semibold ${methodColor(methods[file.path] ?? 'GET')}`}>
            {methods[file.path] ?? 'GET'}
          </span>
          <span>{file.name.replace(/\.curl$/i, '')}</span>
        </button>
      </SidebarMenuSubButton>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction
                className="opacity-0 group-focus-within/file-item:opacity-100 group-hover/file-item:opacity-100 data-[state=open]:opacity-100"
                aria-label={`${file.name} actions`}
              >
                <MoreHorizontal />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">文件操作</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuItem onSelect={() => beginRename(file)}><Pencil /> Rename</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => beginDelete(file)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuSubItem>
  )

  return (
    <Sidebar collapsible="icon" className="!absolute !inset-y-0 !h-full">
      <SidebarContent>
        <SidebarGroup>
          <div className="-mx-2 -mt-2 h-12 border-b px-2">
            <div className="flex h-full items-center justify-between">
            <SidebarGroupLabel>Collections</SidebarGroupLabel>
            <div className="-mr-1.5 flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="size-8 rounded-sm [&>svg]:size-3.5" variant="ghost" size="icon" aria-label="New curl file" onClick={() => beginCreate('file')}><FilePlus2 /></Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">新建 curl 文件</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="size-8 rounded-sm [&>svg]:size-3.5" variant="ghost" size="icon" aria-label="New folder" onClick={() => beginCreate('folder')}><FolderPlus /></Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">新建文件夹</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="size-8 rounded-sm [&>svg]:size-3.5"
                    variant="ghost"
                    size="icon"
                    aria-label={allFoldersExpanded ? 'Collapse all folders' : 'Expand all folders'}
                    onClick={allFoldersExpanded ? collapseAll : expandAll}
                  >
                    {allFoldersExpanded ? <ChevronsUpDown /> : <ChevronsDownUp />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{allFoldersExpanded ? '折叠所有文件夹' : '展开所有文件夹'}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button className="size-8 rounded-sm [&>svg]:size-3.5" variant="ghost" size="icon" aria-label="Collection actions"><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">集合操作</TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuItem onSelect={() => importInputRef.current?.click()}><Upload /> Import curl files</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportWorkspace()}><Download /> Export collections</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
          </div>
          <input ref={importInputRef} type="file" accept=".curl" multiple className="hidden" onChange={(event) => void importWorkspace(event)} />
          <SidebarMenu>
            {folders.filter((folder) => parentPath(folder.path) === '.').map((folder) => renderFolder(folder))}
            {files.filter((file) => parentPath(file.path) === '.').map((file) => renderFile(file))}
          </SidebarMenu>
          {entries.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No curl files yet.</p>}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu><SidebarMenuItem><SidebarMenuButton><Folder /><span>ENV</span><span className="ml-auto text-xs text-muted-foreground">Dev</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <Dialog open={createMode !== null} onOpenChange={(open) => { if (!open) cancelCreate() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createMode === 'folder' ? 'New folder' : 'New curl file'}</DialogTitle>
            <DialogDescription>
              {createParent === '.' ? 'Add an item to the workspace.' : 'Add an item to this folder.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void submitCreate() }}>
            <Input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createMode === 'folder' ? 'Folder name' : 'Curl file name'}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={cancelCreate}>Cancel</Button>
              <Button type="submit" disabled={!createName.trim()}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) cancelRename() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.isDir ? 'folder' : 'curl file'}</DialogTitle>
            <DialogDescription>Choose a new name for “{renameTarget?.name}”.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void submitRename() }}>
            <Input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={cancelRename}>Cancel</Button>
              <Button type="submit" disabled={!renameName.trim()}>Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.isDir ? 'folder' : 'curl file'}?</DialogTitle>
            <DialogDescription>
              This will permanently delete “{deleteTarget?.name}” and its contents. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
