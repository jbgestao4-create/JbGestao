import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RequireModule } from './RequireModule'
import { RequireDashboardModule } from './RequireDashboardModule'
import {
  CustomerFormPage,
  CustomersHomePage,
  CustomersListPage,
  DashboardPage,
  ForgotPasswordPage,
  LoginPage,
  ModulesPage,
  OrganizationSettingsPage,
  ProfilePage,
  QuoteFormPage,
  QuotesListPage,
  RegisterPage,
  SupplierFormPage,
  SuppliersHomePage,
  SuppliersListPage,
} from './lazy-pages'

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
        <RequireDashboardModule moduleCode="MOD-07">
          <OrganizationSettingsPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },

  // Rotas do módulo JB Software (protegidas por autenticação e concessão de módulo)
  {
    path: '/orcafacil/suppliers',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-06">
          <RequireModule moduleCode="orcafacil">
            <SuppliersHomePage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/suppliers/search',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-06">
          <RequireModule moduleCode="orcafacil">
            <SuppliersListPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/suppliers/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-06">
          <RequireModule moduleCode="orcafacil">
            <SupplierFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/suppliers/:supplierId/edit',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-06">
          <RequireModule moduleCode="orcafacil">
            <SupplierFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/quotes',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-04">
          <RequireModule moduleCode="orcafacil">
            <QuotesListPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/quotes/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-04">
          <RequireModule moduleCode="orcafacil">
            <QuoteFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-03">
          <RequireModule moduleCode="orcafacil">
            <CustomersHomePage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/search',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-03">
          <RequireModule moduleCode="orcafacil">
            <CustomersListPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-03">
          <RequireModule moduleCode="orcafacil">
            <CustomerFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/customers/:customerId/edit',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-03">
          <RequireModule moduleCode="orcafacil">
            <CustomerFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },

  // Redirecionamento padrão para rotas não encontradas
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
