import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-16 w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 transition-colors outline-none',
        'focus:border-gray-900 focus:ring-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
