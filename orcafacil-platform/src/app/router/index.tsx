import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RequireModule } from './RequireModule'

import { LoginPage } from '@modules/auth/pages/LoginPage'
import { RegisterPage } from '@modules/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@modules/auth/pages/ForgotPasswordPage'
import { ProfilePage } from '@modules/auth/pages/ProfilePage'

import { DashboardPage } from '@modules/dashboard/pages/DashboardPage'
import { ModulesPage } from '@modules/access-control/pages/ModulesPage'
import { OrganizationSettingsPage } from '@modules/organizations/pages/OrganizationSettingsPage'

import { QuotesListPage } from '@modules/orcafacil/pages/QuotesListPage'
import { QuoteFormPage } from '@modules/orcafacil/pages/QuoteFormPage'
import { CustomersHomePage } from '@modules/customers/pages/CustomersHomePage'
import { CustomersListPage } from '@modules/customers/pages/CustomersListPage'
import { CustomerFormPage } from '@modules/customers/pages/CustomerFormPage'

export const router = createBrowserRouter([
  // Rotas públicas de autenticação
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },

  // Rotas autenticadas protegidas
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/modules',
    element: (
      <ProtectedRoute>
        <ModulesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/organization',
    element: (
      <ProtectedRoute>
        <OrganizationSettingsPage />
      </ProtectedRoute>
    ),
  },

  // Rotas do módulo JB Software (protegidas por autenticação e concessão de módulo)
  {
    path: '/orcafacil/quotes',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <QuotesListPage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/quotes/new',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <QuoteFormPage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <CustomersHomePage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/search',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <CustomersListPage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/new',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <CustomerFormPage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/:customerId/edit',
    element: (
      <ProtectedRoute>
        <RequireModule moduleCode="orcafacil">
          <CustomerFormPage />
        </RequireModule>
      </ProtectedRoute>
    ),
  },

  // Redirecionamento padrão para rotas não encontradas
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
