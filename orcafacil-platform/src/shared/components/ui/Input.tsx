import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@shared/lib/cn'
import { MoneyInput } from './MoneyInput'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  /** Campo de dinheiro (R$): duas casas decimais fixas, dígitos entram pela direita. */
  currency?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, currency = false, ...props }, ref) => {
    const inputId = id ?? props.name
    const inputClassName = cn(
      'flex h-10 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
      error && 'border-red-500 focus:ring-red-500',
      className,
    )

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {label}
          </label>
        )}
        {currency ? (
          <MoneyInput
            id={inputId}
            ref={ref}
            className={inputClassName}
            {...{
              ...props,
              type: undefined,
              min: undefined,
              max: undefined,
              step: undefined,
              placeholder: undefined,
            }}
            value={props.value as string | number | undefined}
          />
        ) : (
          <input id={inputId} ref={ref} className={inputClassName} {...props} />
        )}
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-500 dark:text-slate-400">{helperText}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
