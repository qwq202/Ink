import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 transition-colors outline-none',
        'focus:border-gray-900 focus:ring-0',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
