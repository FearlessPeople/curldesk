import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorState, Prec, RangeSetBuilder } from '@codemirror/state'
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'

type CurlEditorProps = {
  value: string
  onChange: (value: string) => void
  onRun: (value: string, lineNumber: number) => void
  onStop: () => void
  runningLine: number | null
}

const curlLanguage = StreamLanguage.define({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.sol() && stream.match(/#.*/)) return 'comment'
    if (stream.match(/curl\b/i)) return 'keyword'
    if (stream.match(/--?[A-Za-z][\w-]*/)) return 'propertyName'
    if (stream.match(/https?:\/\/[^\s"']+/i)) return 'string'
    if (stream.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/)) return 'string'
    if (stream.match(/\$\{?[A-Za-z_][\w-]*\}?/)) return 'variableName'
    if (stream.match(/\\$/)) return 'operator'
    if (stream.match(/\b\d+(?:\.\d+)?\b/)) return 'number'
    stream.next()
    return null
  },
})

const curlHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: 'hsl(221 83% 53%)', fontWeight: '600' },
  { tag: tags.propertyName, color: 'hsl(262 70% 55%)' },
  { tag: tags.string, color: 'hsl(158 64% 36%)' },
  { tag: tags.variableName, color: 'hsl(32 80% 42%)' },
  { tag: tags.number, color: 'hsl(200 70% 42%)' },
  { tag: tags.operator, color: 'hsl(215 16% 47%)' },
  { tag: tags.comment, color: 'hsl(215 12% 55%)', fontStyle: 'italic' },
]))

class RunMarker extends GutterMarker {
  constructor(
    private readonly lineNumber: number,
    private readonly onRun: (lineNumber: number) => void,
    private readonly onStop: () => void,
    private readonly isRunning: () => boolean,
  ) {
    super()
  }

  toDOM() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-run-button'
    button.dataset.runLine = 'true'
    button.dataset.lineNumber = String(this.lineNumber)
    button.setAttribute('aria-label', 'Run request')
    button.textContent = this.isRunning() ? '■' : '▶'
    button.dataset.running = String(this.isRunning())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (this.isRunning()) this.onStop()
      else this.onRun(this.lineNumber)
    })
    return button
  }
}

function requestStartLines(
  view: EditorView,
  onRun: (lineNumber: number) => void,
  onStop: () => void,
  isRunning: (lineNumber: number) => boolean,
) {
  const builder = new RangeSetBuilder<GutterMarker>()
  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber)
    if (/^\s*curl\b/i.test(line.text)) {
      builder.add(line.from, line.from, new RunMarker(lineNumber, onRun, onStop, () => isRunning(lineNumber)))
    }
  }
  return builder.finish()
}

export function CurlEditor({ value, onChange, onRun, onStop, runningLine }: CurlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const onStopRef = useRef(onStop)
  const runningLineRef = useRef(runningLine)

  onChangeRef.current = onChange
  onRunRef.current = onRun
  onStopRef.current = onStop
  runningLineRef.current = runningLine

  useEffect(() => {
    if (!editorRef.current) return
    const runGutter = gutter({
      class: 'cm-run-gutter',
      markers: (view) => requestStartLines(
        view,
        (lineNumber) => onRunRef.current(view.state.doc.toString(), lineNumber),
        () => onStopRef.current(),
        (lineNumber) => runningLineRef.current === lineNumber,
      ),
    })
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        Prec.high(runGutter),
        curlLanguage,
        curlHighlighting,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden', fontSize: '0.875rem' },
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
          '.cm-content': { boxSizing: 'border-box', padding: '1rem 1rem 1rem 0' },
          '.cm-gutters': { border: 'none', backgroundColor: 'transparent' },
          '.cm-line': { display: 'block', boxSizing: 'border-box' },
          '.cm-activeLine': { backgroundColor: 'hsl(221 83% 53% / 0.08)' },
          '.cm-activeLineGutter': { backgroundColor: 'hsl(221 83% 53% / 0.08)' },
          '.cm-lineNumbers .cm-gutterElement': { minWidth: '2rem', padding: '0 0.5rem 0 0' },
        }),
      ],
    })
    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view
    return () => view.destroy()
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.querySelectorAll<HTMLButtonElement>('[data-run-line]').forEach((button) => {
      const isRunning = Number(button.dataset.lineNumber) === runningLine
      button.textContent = isRunning ? '■' : '▶'
      button.dataset.running = String(isRunning)
      button.setAttribute('aria-label', isRunning ? 'Stop request' : 'Run request')
    })
  }, [runningLine])

  return <div ref={editorRef} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden" />
}
