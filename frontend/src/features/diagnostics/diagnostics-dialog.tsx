import { useEffect, useState } from 'react'
import { Copy, Download, RefreshCw } from 'lucide-react'

import { Button } from '@/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog'
import type { DiagnosticInfo } from '../../../bindings/curldesk/models'

type DiagnosticsDialogProps = {
  open: boolean
  info: DiagnosticInfo | null
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
}

export function DiagnosticsDialog({ open, info, onOpenChange, onRefresh }: DiagnosticsDialogProps) {
  const [copied, setCopied] = useState(false)
  const content = info ? JSON.stringify(info, null, 2) : 'Loading diagnostics…'

  useEffect(() => {
    if (open) onRefresh()
  }, [open])

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'curldesk-diagnostics.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Diagnostics</DialogTitle>
          <DialogDescription>Environment information for troubleshooting. Secrets are not included.</DialogDescription>
        </DialogHeader>
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs">{content}</pre>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="size-4" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => void copy()}><Copy className="size-4" />{copied ? 'Copied' : 'Copy'}</Button>
          <Button size="sm" onClick={download}><Download className="size-4" />Export</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
