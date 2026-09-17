import * as React from "react"

import { cn } from "@/lib/utils"

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn("relative w-full rounded-md border px-4 py-3 text-sm", className)} {...props} />
  )
)
Alert.displayName = "Alert"

export { Alert }
