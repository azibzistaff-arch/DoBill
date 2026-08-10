import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-y-auto overflow-x-hidden min-h-0 w-full", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

export { ScrollArea, ScrollBar }

