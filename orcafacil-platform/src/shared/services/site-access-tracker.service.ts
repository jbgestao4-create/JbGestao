import { supabase } from '@app/config/supabase'
import { logger } from '@shared/lib/logger'

export interface SiteAccessLog {
  id: string
  ip_address: string
  path: string
  user_agent?: string | null
  referrer?: string | null
  is_mobile?: boolean
  created_at: string
}

export interface SiteAccessStats {
  totalVisits: number
  totalUniqueIps: number
  todayVisits: number
  todayUniqueIps: number
  monthVisits: number
  monthUniqueIps: number
  recentVisits: SiteAccessLog[]
  dailyBreakdown: { date: string; visits: number; uniqueIps: number }[]
  topIps: { ip: string; count: number; lastSeen: string }[]
  topPages: { path: string; count: number }[]
}

const LOCAL_STORAGE_LAST_TRACK = 'cs_last_site_visit_track'
const LOCAL_STORAGE_CACHE = 'cs_cached_site_access_logs'

async function resolvePublicIp(): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const json = (await res.json()) as { ip?: string }
      if (json?.ip) return json.ip
    }
  } catch {
    // Fallback secundário
    try {
      const res = await fetch('https://ipapi.co/json/')
      if (res.ok) {
        const json = (await res.json()) as { ip?: string }
        if (json?.ip) return json.ip
      }
    } catch {
      // Ignora erro
    }
  }
  return 'Visitante Online'
}

export const siteAccessTrackerService = {
  /**
   * Registra a visita atual caso ainda não tenha sido registrada nos últimos 30 segundos
   */
  async trackCurrentVisit(path: string = window.location.pathname): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const now = Date.now()
      const lastTrackStr = sessionStorage.getItem(LOCAL_STORAGE_LAST_TRACK)
      if (lastTrackStr) {
        const lastTrack = parseInt(lastTrackStr, 10)
        // Evita flood se recarregar a mesma página em menos de 20s
        if (now - lastTrack < 20000) {
          return
        }
      }
      sessionStorage.setItem(LOCAL_STORAGE_LAST_TRACK, String(now))

      const ip = await resolvePublicIp()
      const userAgent = navigator.userAgent || ''
      const referrer = document.referrer || ''
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)

      const logItem: SiteAccessLog = {
        id: `local_${now}_${Math.random().toString(36).substring(2, 7)}`,
        ip_address: ip,
        path: path || '/',
        user_agent: userAgent,
        referrer,
        is_mobile: isMobile,
        created_at: new Date(now).toISOString(),
      }

      // Salva localmente em cache para garantia e redundância imediata
      this.saveLocalLog(logItem)

      // 1. Tenta RPC
      try {
        const { error: rpcError } = await supabase.rpc('record_site_visit', {
          p_ip: ip,
          p_path: path || '/',
          p_user_agent: userAgent,
          p_referrer: referrer,
          p_is_mobile: isMobile,
        })
        if (!rpcError) return
      } catch {
        // Ignora e segue para fallback
      }

      // 2. Fallback direto no insert da tabela
      try {
        await supabase.from('site_access_logs').insert([
          {
            ip_address: ip,
            path: path || '/',
            user_agent: userAgent,
            referrer,
            is_mobile: isMobile,
          },
        ])
      } catch (insertErr) {
        logger.warn('Aviso: insert em site_access_logs indisponível no momento.', {
          error: insertErr instanceof Error ? insertErr.message : String(insertErr),
        })
      }
    } catch (e) {
      // Falha silenciosa para não atrapalhar a experiência do usuário
      logger.warn('Erro ao registrar visita ao site', {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  },

  /**
   * Salva no storage local (mantém até 500 registros)
   */
  saveLocalLog(item: SiteAccessLog): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CACHE)
      const list: SiteAccessLog[] = raw ? JSON.parse(raw) : []
      list.unshift(item)
      if (list.length > 500) list.length = 500
      localStorage.setItem(LOCAL_STORAGE_CACHE, JSON.stringify(list))
    } catch {
      // Ignora erro de localStorage cheio
    }
  },

  getLocalLogs(): SiteAccessLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CACHE)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  /**
   * Obtém as estatísticas completas de acessos (diário, mensal, IPs únicos e histórico)
   */
  async getAccessStats(): Promise<SiteAccessStats> {
    let logs: SiteAccessLog[] = []

    try {
      // Busca apenas as colunas utilizadas nas estatísticas, limitando a 1000 registros para economizar Egress
      const { data, error } = await supabase
        .from('site_access_logs')
        .select('id, ip_address, path, referrer, is_mobile, created_at')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (!error && data && data.length > 0) {
        logs = data as SiteAccessLog[]
      }
    } catch (err) {
      logger.warn('Falha ao carregar logs remotos de site_access_logs', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Mescla com logs locais para dados em tempo real
    const localLogs = this.getLocalLogs()
    const mergedMap = new Map<string, SiteAccessLog>()
    localLogs.forEach((l) => mergedMap.set(l.id, l))
    logs.forEach((l) => mergedMap.set(l.id, l))

    const allLogs = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const todayIps = new Set<string>()
    let todayVisits = 0

    const monthIps = new Set<string>()
    let monthVisits = 0

    const totalIps = new Set<string>()

    const dailyMap = new Map<string, { visits: number; ips: Set<string> }>()
    const ipCounts = new Map<string, { count: number; lastSeen: string }>()
    const pageCounts = new Map<string, number>()

    allLogs.forEach((log) => {
      const ip = log.ip_address || 'Desconhecido'
      const dateObj = new Date(log.created_at)
      const dateStr = log.created_at.slice(0, 10)
      const path = log.path || '/'

      totalIps.add(ip)

      // Hoje
      if (dateStr === todayStr) {
        todayVisits++
        todayIps.add(ip)
      }

      // Este mês
      if (dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
        monthVisits++
        monthIps.add(ip)
      }

      // Agrupamento diário
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { visits: 0, ips: new Set<string>() })
      }
      const dayData = dailyMap.get(dateStr)!
      dayData.visits++
      dayData.ips.add(ip)

      // Top IPs
      const currentIp = ipCounts.get(ip) || { count: 0, lastSeen: log.created_at }
      currentIp.count++
      if (new Date(log.created_at) > new Date(currentIp.lastSeen)) {
        currentIp.lastSeen = log.created_at
      }
      ipCounts.set(ip, currentIp)

      // Top Páginas
      pageCounts.set(path, (pageCounts.get(path) || 0) + 1)
    })

    // Monta breakdown diário (ordenado pela data mais recente)
    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        visits: data.visits,
        uniqueIps: data.ips.size,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    // Top IPs mais ativos
    const topIps = Array.from(ipCounts.entries())
      .map(([ip, data]) => ({
        ip,
        count: data.count,
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Top Páginas mais acessadas
    const topPages = Array.from(pageCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalVisits: allLogs.length,
      totalUniqueIps: totalIps.size,
      todayVisits,
      todayUniqueIps: todayIps.size,
      monthVisits,
      monthUniqueIps: monthIps.size,
      recentVisits: allLogs.slice(0, 50),
      dailyBreakdown,
      topIps,
      topPages,
    }
  },
}
