/**
 * Utilitário genérico para persistência automática de rascunhos de formulários
 * em sessionStorage, mantendo os dados preenchidos quando o usuário navega
 * entre abas/páginas do sistema e retorna ao cadastro.
 */

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

interface FormDraftEnvelope<T> {
  version: number
  savedAt: number
  data: T
}

export function getFormDraftKey(
  moduleName: string,
  organizationId?: string | null,
  recordId?: string | null,
): string {
  return `jb:form-draft:v1:${moduleName}:${organizationId || 'org'}:${recordId || 'new'}`
}

export function readFormDraft<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FormDraftEnvelope<T>>
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > DRAFT_TTL_MS ||
      parsed.data === undefined
    ) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function writeFormDraft<T>(key: string, data: T): boolean {
  try {
    const serialized = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      data,
    } satisfies FormDraftEnvelope<T>)
    window.sessionStorage.setItem(key, serialized)
    return true
  } catch {
    return false
  }
}

export function clearFormDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

