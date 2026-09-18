const isAndroid = /Android/i.test(navigator.userAgent)

export const isMacOS = /Macintosh|Mac OS X/i.test(navigator.userAgent)
export const isWindows = /Windows/i.test(navigator.userAgent)
export const isLinux = /Linux/i.test(navigator.userAgent) && !isAndroid
