import { lazy } from 'react'

export const LoginPage = lazy(() =>
  import('@modules/auth/pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)
export const RegisterPage = lazy(() =>
  import('@modules/auth/pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
)
export const ForgotPasswordPage = lazy(() =>
  import('@modules/auth/pages/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
)
export const ProfilePage = lazy(() =>
  import('@modules/auth/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
)
export const DashboardPage = lazy(() =>
  import('@modules/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
export const ModulesPage = lazy(() =>
  import('@modules/access-control/pages/ModulesPage').then((module) => ({
    default: module.ModulesPage,
  })),
)
export const OrganizationSettingsPage = lazy(() =>
  import('@modules/organizations/pages/OrganizationSettingsPage').then((module) => ({
    default: module.OrganizationSettingsPage,
  })),
)
export const QuotesListPage = lazy(() =>
  import('@modules/orcafacil/pages/QuotesListPage').then((module) => ({
    default: module.QuotesListPage,
  })),
)
export const QuoteFormPage = lazy(() =>
  import('@modules/orcafacil/pages/QuoteFormPage').then((module) => ({
    default: module.QuoteFormPage,
  })),
)
export const CustomersHomePage = lazy(() =>
  import('@modules/customers/pages/CustomersHomePage').then((module) => ({
    default: module.CustomersHomePage,
  })),
)
export const CustomersListPage = lazy(() =>
  import('@modules/customers/pages/CustomersListPage').then((module) => ({
    default: module.CustomersListPage,
  })),
)
export const CustomerFormPage = lazy(() =>
  import('@modules/customers/pages/CustomerFormPage').then((module) => ({
    default: module.CustomerFormPage,
  })),
)
export const SuppliersHomePage = lazy(() =>
  import('@modules/suppliers/pages/SuppliersHomePage').then((module) => ({
    default: module.SuppliersHomePage,
  })),
)
export const SuppliersListPage = lazy(() =>
  import('@modules/suppliers/pages/SuppliersListPage').then((module) => ({
    default: module.SuppliersListPage,
  })),
)
export const SupplierFormPage = lazy(() =>
  import('@modules/suppliers/pages/SupplierFormPage').then((module) => ({
    default: module.SupplierFormPage,
  })),
)
export const InventoryHomePage = lazy(() =>
  import('@modules/inventory/pages/InventoryHomePage').then((module) => ({
    default: module.InventoryHomePage,
  })),
)
export const InventoryListPage = lazy(() =>
  import('@modules/inventory/pages/InventoryListPage').then((module) => ({
    default: module.InventoryListPage,
  })),
)
export const InventoryFormPage = lazy(() =>
  import('@modules/inventory/pages/InventoryFormPage').then((module) => ({
    default: module.InventoryFormPage,
  })),
)
export const InventoryMovementsPage = lazy(() =>
  import('@modules/inventory/pages/InventoryMovementsPage').then((module) => ({
    default: module.InventoryMovementsPage,
  })),
)
