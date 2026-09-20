import { Clipboard } from '@wailsio/runtime'

export async function copyText(text: string) {
  try {
    await Clipboard.SetText(text)
    return
  } catch (nativeError) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      throw nativeError
    }
  }
}
