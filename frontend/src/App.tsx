import { Github, LayoutPanelLeft, LayoutPanelTop, PanelBottom, Play, Terminal } from 'lucide-react'
import { Browser } from '@wailsio/runtime'
import { Window } from '@wailsio/runtime'
import { useState, type CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/resizable'

const requests = [
  { value: 'chat', label: 'chat.curl', command: `curl -N "https://api.example.com/v1/chat/completions" \\
  -H "Content-Type: application/json"` },
  { value: 'health', label: 'health.curl', command: 'curl "https://api.example.com/health"' },
]

export default function App() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')

  return (
    <div className="flex h-screen flex-col">
      <header
        className="flex h-9 shrink-0 items-center justify-center border-b"
        style={{ '--wails-draggable': 'drag' } as CSSProperties}
        onDoubleClick={() => void Window.ToggleMaximise()}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <img src="/appicon.svg" alt="" className="size-5 rounded-md" />
          CurlDesk
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <SidebarProvider className="!min-h-0 h-full">
          <AppSidebar />
          <SidebarInset>
            <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <TabsList>
                {requests.map((request) => <TabsTrigger key={request.value} value={request.value}>{request.label}</TabsTrigger>)}
                <Button variant="ghost" size="icon" aria-label="New curl">+</Button>
              </TabsList>
              <Button size="sm" className="ml-auto"><Play /> Run</Button>
            </div>

            {requests.map((request) => (
              <TabsContent key={request.value} value={request.value} className="mt-0 flex min-h-0 flex-1 flex-col">
                <ResizablePanelGroup orientation={layout} className="min-h-0 flex-1">
                  <ResizablePanel defaultSize="68%" minSize="24%" className="resizable-panel">
                    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
                      <div className="w-12 shrink-0 select-none border-r px-2 py-4 text-right font-mono text-xs leading-6 text-muted-foreground">
                        {request.command.split('\n').map((_, index) => <div key={index}>{String(index + 1).padStart(2, '0')}</div>)}
                      </div>
                      <textarea aria-label={`${request.label} command editor`} className="min-h-full min-w-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none" defaultValue={request.command} spellCheck={false} />
                    </section>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize="32%" minSize="18%" className="resizable-panel">
                    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
                        <div className="flex items-center gap-2 text-sm font-medium"><PanelBottom /> Output</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={layout === 'vertical' ? 'secondary' : 'ghost'}
                            size="icon"
                            aria-label="上下布局"
                            aria-pressed={layout === 'vertical'}
                            onClick={() => setLayout('vertical')}
                          >
                            <LayoutPanelTop />
                          </Button>
                          <Button
                            variant={layout === 'horizontal' ? 'secondary' : 'ghost'}
                            size="icon"
                            aria-label="左右布局"
                            aria-pressed={layout === 'horizontal'}
                            onClick={() => setLayout('horizontal')}
                          >
                            <LayoutPanelLeft />
                          </Button>
                          <span className="text-xs text-muted-foreground">Ready</span>
                        </div>
                      </div>
                      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-sm text-muted-foreground">Run a curl command to see output here.</pre>
                    </section>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>
            ))}
            </Tabs>
          </SidebarInset>
        </SidebarProvider>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t px-4 text-xs text-muted-foreground">
        <span>Workspace ready</span>
        <a
          href="https://github.com/FearlessPeople/curldesk"
          onClick={(event) => {
            event.preventDefault()
            void Browser.OpenURL('https://github.com/FearlessPeople/curldesk')
          }}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Github className="size-3.5" /> GitHub
        </a>
        <span className="ml-auto">UTF-8</span>
      </footer>
    </div>
  )
}
