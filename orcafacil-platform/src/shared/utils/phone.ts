export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`

  const areaCode = digits.slice(0, 2)
  const subscriber = digits.slice(2)

  if (subscriber.length <= 5) return `(${areaCode}) ${subscriber}`
  return `(${areaCode}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
}
