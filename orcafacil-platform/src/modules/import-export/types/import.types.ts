export type ImportModule = 'customers' | 'suppliers' | 'inventory' | 'sales' | 'budgets'

export interface ImportErrorDetail {
  rowNumber: number
  recordIdentifier: string
  field: string
  receivedValue: any
  reason: string
}

export interface ImportOptions {
  onDuplicate: 'upsert' | 'reject'
  autoCreateSupplierIfMissing?: boolean
  atomic?: boolean
}

export interface ImportSummary {
  totalRows: number
  successCount: number
  errorCount: number
  autoCreatedDependenciesCount: number
  errors: ImportErrorDetail[]
  rejectedRowsData: Record<string, any>[]
}

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, any>[]
}
