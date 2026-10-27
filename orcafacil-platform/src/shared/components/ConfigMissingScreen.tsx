import { KeyRound, ExternalLink, RefreshCw } from 'lucide-react'

export function ConfigMissingScreen({ missing }: { missing: string[] }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-5">
          <KeyRound className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Configuração do Supabase Necessária
        </h1>

        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          A aplicação iniciou, mas as seguintes chaves ainda não estão preenchidas no seu arquivo{' '}
          <code className="text-xs font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded border border-gray-200">
            .env.local
          </code>
          :
        </p>

        <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-6">
          <ul className="text-xs font-mono text-red-700 space-y-1">
            {missing.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                • <strong>{key}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Como resolver em 30 segundos:
          </h2>

          <div className="space-y-3 text-xs text-gray-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <span>
                Abra a página de chaves do seu projeto Supabase:{' '}
                <a
                  href="https://supabase.com/dashboard/project/odnjkpwfocevlfxeleef/settings/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  Abrir API Keys <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <span>
                Copie o valor da chave <strong>anon</strong> / <strong>public</strong>.
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <div className="flex-1">
                <span>Cole no arquivo </span>
                <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-800">
                  orcafacil-platform/.env.local
                </code>
                :
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
                  VITE_SUPABASE_URL=https://odnjkpwfocevlfxeleef.supabase.co{'\n'}
                  VITE_SUPABASE_ANON_KEY=coloque_sua_chave_anon_aqui
                </pre>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-500/20"
        >
          <RefreshCw className="w-4 h-4" /> Recarregar Aplicação
        </button>
      </div>
    </div>
  )
}

