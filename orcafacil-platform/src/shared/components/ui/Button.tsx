import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@shared/lib/cn'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline-gray-400',
      outline:
        'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-blue-600',
      ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:outline-gray-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
    }

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
