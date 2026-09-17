import { useEffect, useRef } from 'react'
import { json } from '@codemirror/lang-json'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { LoaderCircle } from 'lucide-react'

type OutputEditorProps = {
  value: string
  mode?: 'response' | 'headers'
  loading?: boolean
}

export function OutputEditor({ value, mode = 'response', loading = false }: OutputEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        ...(mode === 'response' ? [json()] : []),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.theme({
          '&': { height: '100%', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden', fontSize: '0.875rem', backgroundColor: 'transparent' },
          '.cm-scroller': {
            width: '100%',
            flex: '1 1 0',
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'hidden !important',
            overflowY: 'auto !important',
            scrollbarWidth: 'thin',
            scrollbarColor: 'transparent transparent',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          '.cm-scroller::-webkit-scrollbar': { width: '8px', height: '8px' },
          '.cm-scroller::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '.cm-scroller::-webkit-scrollbar-thumb': { backgroundColor: 'transparent', borderRadius: '999px' },
          '.cm-scroller:hover::-webkit-scrollbar-thumb': { backgroundColor: 'hsl(215 16% 75%)' },
          '.cm-scroller:hover': { scrollbarColor: 'hsl(215 16% 75%) transparent' },
          '.cm-scroller::-webkit-scrollbar:horizontal': { display: 'none', height: 0 },
          '.cm-content': {
            boxSizing: 'border-box',
            minWidth: 0,
            maxWidth: '100%',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          },
          '.cm-line': {
            minWidth: 0,
            maxWidth: '100%',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          },
          '.cm-gutters': { border: 'none', backgroundColor: 'transparent' },
          '.cm-foldGutter .cm-gutterElement': { minWidth: '1rem', padding: '0', color: 'hsl(215 12% 55%)', cursor: 'pointer' },
          '.cm-foldGutter .cm-gutterElement:hover': { color: 'hsl(221 83% 53%)' },
          '.cm-lineNumbers .cm-gutterElement': { minWidth: '2rem', padding: '0 0.5rem 0 0' },
        }),
      ],
    })
    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden" aria-label="Request output">
      <div ref={editorRef} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-md border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            <span>Sending request…</span>
          </div>
        </div>
      )}
    </div>
  )
}
