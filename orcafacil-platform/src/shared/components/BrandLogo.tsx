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
    <div className={cn('inline-flex items-center gap-3', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden',
          markSizes[size],
        )}
      >
        <img src="/jb-software-mark.svg" alt="" className="h-full w-full" />
      </span>
      {showName && (
        <span className={cn('font-semibold', dark ? 'text-white' : 'text-gray-900')}>
          JB Software
        </span>
      )}
    </div>
  )
}
