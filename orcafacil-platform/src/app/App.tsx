import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '@modules/auth/context/AuthContext'
import { OrganizationProvider } from '@modules/organizations/context/OrganizationContext'
import { ModuleAccessProvider } from '@modules/access-control/context/ModuleAccessContext'

export function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <ModuleAccessProvider>
          <Suspense
            fallback={
              <div
                className="flex min-h-screen items-center justify-center text-sm text-gray-500"
                role="status"
              >
                Carregando página...
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </ModuleAccessProvider>
      </OrganizationProvider>
    </AuthProvider>
  )
}
