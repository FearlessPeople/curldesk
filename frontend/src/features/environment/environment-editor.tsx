import { useState } from 'react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { isSensitiveVariable } from './environment-utils'

type EnvironmentEditorProps = {
  environments: Record<string, Record<string, string>>
  activeEnvironment: string
  onSelectEnvironment: (name: string) => void
  onChange: (environments: Record<string, Record<string, string>>) => void
  onLoadDotEnv: () => void
  onSaveDotEnv: () => void
}

export function EnvironmentEditor({
  environments,
  activeEnvironment,
  onSelectEnvironment,
  onChange,
  onLoadDotEnv,
  onSaveDotEnv,
}: EnvironmentEditorProps) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const variables = environments[activeEnvironment] || {}

  const updateVariables = (next: Record<string, string>) => onChange({ ...environments, [activeEnvironment]: next })

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Environment</h3>
        <p className="mt-1 text-sm text-muted-foreground">Variables are kept in the local workspace. Sensitive-looking values are masked in the editor.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(environments).map((name) => (
          <Button key={name} variant={activeEnvironment === name ? 'secondary' : 'outline'} size="sm" onClick={() => onSelectEnvironment(name)}>
            {name}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ ...environments, [`Environment-${Object.keys(environments).length + 1}`]: {} })}>Add environment</Button>
      </div>
      <div className="space-y-2 rounded-md border p-4">
        {Object.entries(variables).map(([key, value]) => {
          const sensitive = isSensitiveVariable(key)
          const visible = revealed[key] || !sensitive
          return (
            <div key={key} className="flex items-center gap-2">
              <Input value={key} readOnly className="h-8 w-40 font-mono text-xs" aria-label={`Variable name ${key}`} />
              <Input
                type={visible ? 'text' : 'password'}
                value={value}
                className="h-8 flex-1 font-mono text-xs"
                aria-label={`Value for ${key}`}
                onChange={(event) => updateVariables({ ...variables, [key]: event.target.value })}
              />
              {sensitive && (
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setRevealed((current) => ({ ...current, [key]: !visible }))}>
                  {visible ? 'Hide' : 'Show'}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" aria-label={`Remove ${key}`} onClick={() => {
                const next = { ...variables }
                delete next[key]
                updateVariables(next)
              }}>Remove</Button>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => {
            const key = `VARIABLE_${Object.keys(variables).length + 1}`
            updateVariables({ ...variables, [key]: '' })
          }}>Add variable</Button>
          <Button variant="outline" size="sm" onClick={onLoadDotEnv}>Load .env</Button>
          <Button variant="outline" size="sm" onClick={onSaveDotEnv}>Save .env</Button>
        </div>
      </div>
    </div>
  )
}
