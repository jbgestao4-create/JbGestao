import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '@modules/auth/context/AuthContext'
import { OrganizationProvider } from '@modules/organizations/context/OrganizationContext'
import { ModuleAccessProvider } from '@modules/access-control/context/ModuleAccessContext'
import { ThemeProvider } from '@shared/context/ThemeContext'
import { ThemeColorProvider } from '@shared/context/ThemeColorContext'
import { BrandLoadingScreen } from '@shared/components/BrandLoadingScreen'

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemeColorProvider>
          <OrganizationProvider>
            <ModuleAccessProvider>
              <Suspense fallback={<BrandLoadingScreen message="Carregando aplicação..." />}>
                <RouterProvider router={router} />
              </Suspense>
            </ModuleAccessProvider>
          </OrganizationProvider>
        </ThemeColorProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
