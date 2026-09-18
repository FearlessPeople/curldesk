const variablePattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\}\}/g

export function isSensitiveVariable(key: string) {
  return /(token|secret|password|passwd|api[-_]?key|private[-_]?key|authorization|credential)/i.test(key)
}

export function referencedVariables(command: string) {
  const keys = new Set<string>()
  for (const match of command.matchAll(variablePattern)) keys.add(match[1])
  return [...keys]
}

export function missingVariables(command: string, values: Record<string, string>) {
  return referencedVariables(command).filter((key) => !(key in values))
}
