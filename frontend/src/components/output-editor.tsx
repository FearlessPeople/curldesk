import { useEffect, useRef } from 'react'
import { json } from '@codemirror/lang-json'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'

type OutputEditorProps = {
  value: string
  mode?: 'response' | 'headers'
}

export function OutputEditor({ value, mode = 'response' }: OutputEditorProps) {
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
            width: 0,
            flex: '1 1 0',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'auto !important',
            scrollbarWidth: 'thin',
            scrollbarColor: 'transparent transparent',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          '.cm-scroller::-webkit-scrollbar': { width: '8px', height: '8px' },
          '.cm-scroller::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '.cm-scroller::-webkit-scrollbar-thumb': { backgroundColor: 'transparent', borderRadius: '999px' },
          '.cm-scroller:hover::-webkit-scrollbar-thumb': { backgroundColor: 'hsl(215 16% 75%)' },
          '.cm-scroller:hover': { scrollbarColor: 'hsl(215 16% 75%) transparent' },
          '.cm-content': { boxSizing: 'border-box', padding: '1rem' },
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

  return <div ref={editorRef} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden" aria-label="Request output" />
}
