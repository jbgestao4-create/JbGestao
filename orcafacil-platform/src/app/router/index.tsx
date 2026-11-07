import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RequireModule } from './RequireModule'
import { RequireDashboardModule } from './RequireDashboardModule'
import { RequireOwner } from './RequireOwner'
import { RequireFeedbackOwner } from './RequireFeedbackOwner'
import {
  CustomerFormPage,
  CustomersHomePage,
  CustomersListPage,
  DashboardPage,
  ForgotPasswordPage,
  InventoryFormPage,
  InventoryHomePage,
  InventoryListPage,
  InventoryMovementsPage,
  LoginPage,
  ModulesPage,
  OrganizationSettingsPage,
  ProfilePage,
  QuoteFormPage,
  QuotesListPage,

  SaleFormPage,
  SalesHomePage,
  PdvTerminalPage,
  ReportsPage,
  SalesInvoicesPage,
  SalesListPage,
  SupplierFormPage,
  SuppliersHomePage,
  SuppliersListPage,
  ServicesListPage,
  ServiceFormPage,
  ServiceOrdersListPage,
  ServiceOrderFormPage,
  CustomerQuotesPortalPage,
  CashManagementPage,
  CompanyManagementPage,
  SuggestionsAdminPage,
} from './lazy-pages'

export const router = createBrowserRouter([
  // Rotas públicas de autenticação
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },

  // Portal Seguro de Orçamentos do Cliente (Acesso por Token único e validação de CPF)
  {
    path: '/portal/orcamentos/:token',
    element: <CustomerQuotesPortalPage />,
  },

  // Gestão de Empresas Cadastradas (Exclusivo para Proprietário)
  {
    path: '/admin/companies',
    element: (
      <ProtectedRoute>
        <RequireOwner>
          <CompanyManagementPage />
        </RequireOwner>
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/companies',
    element: <Navigate to="/admin/companies" replace />,
  },
  {
    path: '/suggestions',
    element: (
      <ProtectedRoute>
        <RequireFeedbackOwner>
          <SuggestionsAdminPage />
        </RequireFeedbackOwner>
      </ProtectedRoute>
    ),
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
  {
    path: '/settings/customization',
    element: <Navigate to="/settings/organization?tab=customization" replace />,
  },
  {
    path: '/settings/theme',
    element: <Navigate to="/settings/organization?tab=customization" replace />,
  },

  // Rotas do módulo JB Software (protegidas por autenticação e concessão de módulo)
  {
    path: '/orcafacil/sales/pdv',
    element: (
      <ProtectedRoute hideLayout>
        <RequireDashboardModule moduleCode="MOD-01" subFeatureCode="MOD-01_PDV">
          <RequireModule moduleCode="orcafacil">
            <PdvTerminalPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/sales',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-01">
          <RequireModule moduleCode="orcafacil">
            <SalesHomePage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/sales/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-01" subFeatureCode="MOD-01_QUICK_SALE">
          <RequireModule moduleCode="orcafacil">
            <SaleFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/sales/search',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-01" subFeatureCode="MOD-01_SEARCH">
          <RequireModule moduleCode="orcafacil">
            <SalesListPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/sales/invoices',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-01" subFeatureCode="MOD-01_INVOICES">
          <RequireModule moduleCode="orcafacil">
            <SalesInvoicesPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/reports',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-08">
          <RequireModule moduleCode="orcafacil">
            <ReportsPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
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
        <RequireDashboardModule moduleCode="MOD-06" subFeatureCode="MOD-06_SEARCH">
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
        <RequireDashboardModule moduleCode="MOD-06" subFeatureCode="MOD-06_CREATE">
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
    path: '/orcafacil/inventory',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02">
          <RequireModule moduleCode="orcafacil">
            <InventoryHomePage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/inventory/search',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02" subFeatureCode="MOD-02_SEARCH">
          <RequireModule moduleCode="orcafacil">
            <InventoryListPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/inventory/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02" subFeatureCode="MOD-02_CREATE">
          <RequireModule moduleCode="orcafacil">
            <InventoryFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/inventory/:inventoryItemId/edit',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02">
          <RequireModule moduleCode="orcafacil">
            <InventoryFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/inventory/movements',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02" subFeatureCode="MOD-02_MOVEMENTS">
          <RequireModule moduleCode="orcafacil">
            <InventoryMovementsPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/inventory/:inventoryItemId/movements',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-02" subFeatureCode="MOD-02_MOVEMENTS">
          <RequireModule moduleCode="orcafacil">
            <InventoryMovementsPage />
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
        <RequireDashboardModule moduleCode="MOD-04" subFeatureCode="MOD-04_CREATE">
          <RequireModule moduleCode="orcafacil">
            <QuoteFormPage />
          </RequireModule>
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/quotes/:quoteId/edit',
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
        <RequireDashboardModule moduleCode="MOD-03" subFeatureCode="MOD-03_SEARCH">
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
        <RequireDashboardModule moduleCode="MOD-03" subFeatureCode="MOD-03_CREATE">
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

  // Módulo de Cadastro e Gestão de Serviços (MOD-09)
  {
    path: '/services',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-09">
          <ServicesListPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/services',
    element: <Navigate to="/services" replace />,
  },
  {
    path: '/services/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-09" subFeatureCode="MOD-09_CREATE">
          <ServiceFormPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/services/:id/edit',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-09">
          <ServiceFormPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },

  // Módulo de Ordem de Serviço (MOD-10)
  {
    path: '/service-orders',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-10">
          <ServiceOrdersListPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/service-orders',
    element: <Navigate to="/service-orders" replace />,
  },
  {
    path: '/service-orders/new',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-10" subFeatureCode="MOD-10_CREATE">
          <ServiceOrderFormPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/service-orders/:id/edit',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-10">
          <ServiceOrderFormPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },

  // Módulo de Gerenciamento de Caixa (MOD-05)
  {
    path: '/cash',
    element: (
      <ProtectedRoute>
        <RequireDashboardModule moduleCode="MOD-05">
          <CashManagementPage />
        </RequireDashboardModule>
      </ProtectedRoute>
    ),
  },
  {
    path: '/orcafacil/cash',
    element: <Navigate to="/cash" replace />,
  },

  // Redirecionamento padrão para rotas não encontradas
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
