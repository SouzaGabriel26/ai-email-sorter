"use client"

import { Toaster } from "@/components/ui/sonner"

export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--background)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        },
      }}
      closeButton
      richColors
    />
  )
} 