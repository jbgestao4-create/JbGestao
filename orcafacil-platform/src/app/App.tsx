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
          <RouterProvider router={router} />
        </ModuleAccessProvider>
      </OrganizationProvider>
    </AuthProvider>
  )
}

