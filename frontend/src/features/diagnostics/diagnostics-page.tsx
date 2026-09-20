import { useEffect, useState } from 'react'
import { Copy, Download, RefreshCw } from 'lucide-react'

import { Button } from '@/components/button'
import type { DiagnosticInfo } from '../../../bindings/curldesk/models'

type DiagnosticsPageProps = { info: DiagnosticInfo | null; onRefresh: () => void }

export function DiagnosticsPage({ info, onRefresh }: DiagnosticsPageProps) {
  const [copied, setCopied] = useState(false)
  const content = info ? JSON.stringify(info, null, 2) : 'Loading diagnostics…'
  useEffect(() => { onRefresh() }, [onRefresh])
  const copy = async () => { await navigator.clipboard.writeText(content); setCopied(true); window.setTimeout(() => setCopied(false), 1200) }
  const download = () => { const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'curldesk-diagnostics.json'; link.click(); URL.revokeObjectURL(url) }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b px-8 py-4">
        <h2 className="text-base font-semibold">Diagnostics</h2>
        <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">Inspect the local system and curl configuration when troubleshooting request execution. Secrets are not included.</p>
      </header>
      <div className="min-h-0 flex-1 p-8 pt-5">
        <div className="w-full">
          {info ? (
            <dl className="grid grid-cols-[minmax(150px,0.25fr)_minmax(0,1fr)] gap-x-8 gap-y-3 py-1 text-sm">
              <div><dt className="text-xs text-muted-foreground">Operating system</dt><dd className="mt-1 font-mono text-foreground">{info.os}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Architecture</dt><dd className="mt-1 font-mono text-foreground">{info.architecture}</dd></div>
              <div><dt className="text-xs text-muted-foreground">curl executable</dt><dd className="mt-1 break-all font-mono text-foreground">{info.curlPath}</dd></div>
              <div><dt className="text-xs text-muted-foreground">curl version</dt><dd className="mt-1 break-all font-mono text-foreground">{info.curlVersion}</dd></div>
            </dl>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">{content}</p>
          )}
          <div className="mt-4 flex items-center gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="size-4" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => void copy()}><Copy className="size-4" />{copied ? 'Copied' : 'Copy'}</Button>
            <Button size="sm" onClick={download}><Download className="size-4" />Export</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
