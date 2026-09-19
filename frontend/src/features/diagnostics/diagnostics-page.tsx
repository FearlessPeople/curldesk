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
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><header className="border-b px-8 py-6"><h2 className="text-base font-semibold">Diagnostics</h2><p className="mt-2 text-sm text-muted-foreground">Environment information for troubleshooting. Secrets are not included.</p></header><div className="max-w-3xl space-y-4 p-8"><pre className="max-h-[55vh] overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs">{content}</pre><div className="flex gap-2"><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="size-4" />Refresh</Button><Button variant="outline" size="sm" onClick={() => void copy()}><Copy className="size-4" />{copied ? 'Copied' : 'Copy'}</Button><Button size="sm" onClick={download}><Download className="size-4" />Export</Button></div></div></div>
}
