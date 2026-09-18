import { useEffect, useMemo, useRef, useState } from 'react'
import { Command, Search } from 'lucide-react'

import { Button } from '@/components/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/dialog'
import { Input } from '@/components/input'

export type PaletteCommand = {
  id: string
  label: string
  description: string
  shortcut?: string
  onSelect: () => void
}

type CommandPaletteProps = {
  open: boolean
  commands: PaletteCommand[]
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, commands, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? commands.filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(needle)) : commands
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  const execute = (command?: PaletteCommand) => {
    if (!command) return
    onOpenChange(false)
    command.onSelect()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Search and run CurlDesk commands.</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((current) => Math.min(current + 1, filtered.length - 1)) }
              if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((current) => Math.max(current - 1, 0)) }
              if (event.key === 'Enter') { event.preventDefault(); execute(filtered[selected]) }
            }}
            placeholder="Search commands"
            aria-label="Search commands"
            className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matching commands.</div>
          ) : filtered.map((command, index) => (
            <Button
              key={command.id}
              variant="ghost"
              className={`h-auto w-full justify-start gap-3 px-3 py-2 text-left ${index === selected ? 'bg-muted' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => execute(command)}
            >
              <Command className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block text-sm">{command.label}</span><span className="block truncate text-xs text-muted-foreground">{command.description}</span></span>
              {command.shortcut && <kbd className="text-[10px] text-muted-foreground">{command.shortcut}</kbd>}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
