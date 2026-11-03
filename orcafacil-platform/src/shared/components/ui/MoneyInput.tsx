import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { decimalToMoneyDisplay, moneyDigitsToDecimal } from '@shared/utils/money-mask'

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step' | 'inputMode'
> {
  /** Valor decimal com ponto (ex.: "12.34") ou string vazia. */
  value: string | number | null | undefined
}

/**
 * Campo de dinheiro (R$) com duas casas decimais fixas. Os dígitos digitados entram pela
 * direita. `onChange` recebe o evento com `event.target.value` já no formato decimal "12.34"
 * (ou '' quando zerado), compatível com os estados de formulário existentes.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = '0,00', ...props }, ref) => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = moneyDigitsToDecimal(event.target.value)
      onChange?.(event)
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={decimalToMoneyDisplay(value)}
        onChange={handleChange}
      />
    )
  },
)

MoneyInput.displayName = 'MoneyInput'

