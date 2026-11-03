import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@shared/lib/cn'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  activeColorClass?: string
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      activeColorClass = 'bg-blue-600',
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled) {
            onCheckedChange?.(!checked)
          }
        }}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? activeColorClass : 'bg-gray-200',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    )
  },
)

Switch.displayName = 'Switch'

