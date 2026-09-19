import { useEffect, useRef } from 'react'
import { json } from '@codemirror/lang-json'
import { foldAll, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search, SearchQuery, setSearchQuery } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { LoaderCircle } from 'lucide-react'
import { tags } from '@lezer/highlight'

const outputHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.propertyName, color: 'hsl(262 70% 55%)' },
  { tag: tags.string, color: 'hsl(158 64% 36%)' },
  { tag: tags.number, color: 'hsl(200 70% 42%)' },
  { tag: tags.bool, color: 'hsl(221 83% 53%)' },
  { tag: tags.null, color: 'hsl(32 80% 42%)' },
]))

type OutputEditorProps = {
  value: string
  mode?: 'response' | 'headers' | 'request'
  fontSize?: number
  wrap?: boolean
  loading?: boolean
  searchTerm?: string
  collapseSignal?: number
}

export function OutputEditor({ value, mode = 'response', fontSize = 14, wrap = true, loading = false, searchTerm = '', collapseSignal = 0 }: OutputEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        search(),
        ...(mode === 'response' ? [json(), outputHighlighting] : []),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.theme({
          '&': { height: '100%', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden', fontSize: `${fontSize}px`, color: 'hsl(var(--foreground))', backgroundColor: 'transparent' },
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
            padding: '1rem 1rem 1rem 0',
            whiteSpace: wrap ? 'pre-wrap' : 'pre',
            overflowWrap: wrap ? 'anywhere' : 'normal',
            wordBreak: wrap ? 'break-word' : 'normal',
          },
          '.cm-line': {
            display: 'block',
            boxSizing: 'border-box',
            minWidth: 0,
            maxWidth: '100%',
            overflowWrap: wrap ? 'anywhere' : 'normal',
            wordBreak: wrap ? 'break-word' : 'normal',
          },
          '.cm-gutters': { border: 'none', backgroundColor: 'transparent', color: 'hsl(var(--muted-foreground))' },
          '.cm-foldGutter .cm-gutterElement': { minWidth: '1rem', padding: '0', color: 'hsl(215 12% 55%)', cursor: 'pointer' },
          '.cm-foldGutter .cm-gutterElement:hover': { color: 'hsl(221 83% 53%)' },
          '.cm-lineNumbers .cm-gutterElement': { minWidth: '2rem', padding: '0 0.5rem 0 0' },
          '.cm-activeLine': { backgroundColor: 'hsl(var(--active-line) / 0.08)' },
          '.cm-activeLineGutter': { backgroundColor: 'hsl(var(--active-line) / 0.08)' },
          '.cm-selectionBackground': { backgroundColor: 'hsl(var(--selection) / 0.24) !important' },
        }),
      ],
    })
    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [fontSize, mode, wrap])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: searchTerm, caseSensitive: false })) })
  }, [searchTerm])

  useEffect(() => {
    if (collapseSignal === 0) return
    const view = viewRef.current
    if (view) foldAll(view)
  }, [collapseSignal])

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
