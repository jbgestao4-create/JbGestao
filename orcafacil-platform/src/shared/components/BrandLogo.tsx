import { cn } from '@shared/lib/cn'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  dark?: boolean
  className?: string
}

const markSizes = {
  sm: 'h-8 w-8 rounded-md text-xs',
  md: 'h-11 w-11 rounded-lg text-base',
  lg: 'h-12 w-12 rounded-lg text-base',
}

export function BrandLogo({
  size = 'md',
  showName = true,
  dark = false,
  className,
}: BrandLogoProps) {
  return (
    <div className={cn('inline-flex min-w-0 max-w-full items-center', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-0.5 shadow-xs ring-1 ring-slate-200/70',
          markSizes[size],
        )}
      >
        <img src="/controlesoft-mark.png" alt="ControleSoft" className="h-full w-full object-contain" />
      </span>
      <span
        aria-hidden={!showName}
        className={cn(
          'min-w-0 truncate font-semibold transition-all duration-300 ease-out',
          dark ? 'text-white' : 'text-gray-900 dark:text-white',
          showName ? 'ml-3 max-w-[160px] opacity-100' : 'ml-0 max-w-0 opacity-0',
        )}
      >
        ControleSoft
      </span>
    </div>
  )
}
