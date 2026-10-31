import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@shared/lib/cn'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface ListBoxOption {
  value: string
  label: string
  description?: string
}

export interface ListBoxProps {
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  searchPlaceholder?: string
  options: ListBoxOption[]
  value?: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  searchable?: boolean
  disabled?: boolean
  className?: string
  id?: string
  actionButton?: ReactNode
}

export function ListBox({
  label,
  error,
  helperText,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  options,
  value,
  onChange,
  multiple = false,
  searchable = true,
  disabled = false,
  className,
  id,
  actionButton,
}: ListBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    placement: 'bottom' | 'top'
  }>({
    top: 0,
    left: 0,
    width: 0,
    placement: 'bottom',
  })

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const fitsBelow = spaceBelow >= 220 || spaceBelow > rect.top
    const width = Math.max(rect.width, 220)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }

    setCoords({
      top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 4),
      left,
      width,
      placement: fitsBelow ? 'bottom' : 'top',
    })
  }, [])

  const selectedValues: string[] = Array.isArray(value)
    ? value
    : value
      ? [value]
      : []

  useEffect(() => {
    if (!isOpen) return
    updateCoords()

    const handleScrollOrResize = () => {
      updateCoords()
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, updateCoords])

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [isOpen, searchable])

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(search.toLowerCase())),
  )

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]
      onChange(next)
    } else {
      onChange(optionValue)
      setIsOpen(false)
      setSearch('')
    }
  }

  const handleRemove = (optionValue: string, e: MouseEvent) => {
    e.stopPropagation()
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== optionValue))
    } else {
      onChange('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Enter' && search && filteredOptions.length > 0) {
      e.preventDefault()
      handleSelect(filteredOptions[0].value)
    }
  }

  const selectedOptions = options.filter((opt) => selectedValues.includes(opt.value))

  return (
    <div className={cn('w-full space-y-1.5 text-left', className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <button
            ref={buttonRef}
            type="button"
            id={id}
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev)
            }}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={cn(
              'flex min-h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus:ring-red-500',
              isOpen && 'ring-2 ring-blue-500 border-transparent',
            )}
          >
            <div className="flex flex-1 flex-wrap gap-1.5 text-left">
              {selectedValues.length === 0 ? (
                <span className="text-gray-400">{placeholder}</span>
              ) : multiple ? (
                selectedOptions.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200"
                  >
                    {opt.label}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        handleRemove(opt.value, e)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleRemove(opt.value, e as unknown as MouseEvent)
                        }
                      }}
                      className="hover:text-blue-900 focus:outline-none"
                      aria-label={`Remover ${opt.label}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </span>
                ))
              ) : (
                <span className="truncate">{selectedOptions[0]?.label ?? selectedValues[0]}</span>
              )}
            </div>

            <ChevronDown
              className={cn(
                'ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
                isOpen && 'rotate-180 text-blue-600',
              )}
              aria-hidden="true"
            />
          </button>

          {isOpen &&
            createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: 'fixed',
                  top: coords.placement === 'bottom' ? coords.top : undefined,
                  bottom: coords.placement === 'top' ? window.innerHeight - coords.top : undefined,
                  left: coords.left,
                  width: coords.width,
                  zIndex: 9999,
                }}
                className="max-h-60 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl animate-in fade-in-50 duration-100"
              >
                {searchable && (
                  <div className="border-b border-gray-100 p-2">
                    <div className="relative flex items-center">
                      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={searchPlaceholder}
                        value={search}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                          setSearch(e.target.value)
                        }}
                        className="h-8 w-full rounded-md border border-gray-200 py-1 pl-8 pr-3 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div
                  role="listbox"
                  aria-multiselectable={multiple}
                  className="max-h-48 overflow-y-auto p-1 text-sm"
                >
                  {filteredOptions.length === 0 ? (
                    <p className="p-3 text-center text-xs text-gray-500">
                      Nenhuma opção encontrada
                    </p>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isSelected = selectedValues.includes(opt.value)
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            handleSelect(opt.value)
                          }}
                          className={cn(
                            'flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors text-sm',
                            isSelected
                              ? 'bg-blue-50 font-medium text-blue-900'
                              : 'text-gray-700 hover:bg-gray-100',
                          )}
                        >
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            {opt.description && (
                              <span className="text-xs text-gray-500">{opt.description}</span>
                            )}
                          </div>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>

        {actionButton}
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {helperText && !error && <p className="text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}
