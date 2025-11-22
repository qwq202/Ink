'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon, MinusIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-md border-2 border-gray-300 bg-white transition-all outline-none',
        'hover:border-gray-500 hover:bg-gray-50',
        'focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-200 focus-visible:ring-offset-1',
        'data-[state=checked]:border-gray-900 data-[state=checked]:bg-gray-900 data-[state=checked]:text-white',
        'data-[state=indeterminate]:border-gray-900 data-[state=indeterminate]:bg-gray-900 data-[state=indeterminate]:text-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {props.checked === 'indeterminate' ? (
          <MinusIcon className="size-3.5 stroke-[3]" />
        ) : (
          <CheckIcon className="size-3.5 stroke-[3]" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
