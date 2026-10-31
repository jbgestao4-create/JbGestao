/**
 * Tipos gerados manualmente para o banco de dados Supabase.
 *
 * Em produção, estes tipos devem ser gerados automaticamente via:
 *   npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/shared/types/database.ts
 *
 * As definições abaixo devem ser mantidas em sincronismo com as migrações SQL.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

/** Papéis disponíveis dentro de uma organização */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/** Códigos de módulos disponíveis na plataforma */
export type ModuleCode = 'orcafacil' | 'agendapro' | 'estoqueleve'

/** Códigos dos módulos exibidos na página inicial */
export type DashboardModuleCode =
  'MOD-01' | 'MOD-02' | 'MOD-03' | 'MOD-04' | 'MOD-05' | 'MOD-06' | 'MOD-07'

/** Estado de uma concessão de módulo a uma organização */
export type ModuleGrantStatus = 'active' | 'inactive' | 'suspended'

/** Estado de uma assinatura */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

/** Estados possíveis de um orçamento */
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'completed' | 'rejected' | 'expired'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_path?: string | null
          updated_at?: string
        }
      }
      organization_member_dashboard_modules: {
        Row: {
          organization_id: string
          user_id: string
          module_code: DashboardModuleCode
          created_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          module_code: DashboardModuleCode
          created_at?: string
        }
        Update: never
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: OrganizationRole
          job_title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          role: OrganizationRole
          job_title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          role?: OrganizationRole
          job_title?: string | null
          updated_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          code: ModuleCode
          name: string
          is_globally_available: boolean
        }
        Insert: {
          id?: string
          code: ModuleCode
          name: string
          is_globally_available?: boolean
        }
        Update: {
          name?: string
          is_globally_available?: boolean
        }
      }
      organization_modules: {
        Row: {
          organization_id: string
          module_id: string
          status: ModuleGrantStatus
          activated_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          module_id: string
          status?: ModuleGrantStatus
          activated_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: ModuleGrantStatus
          expires_at?: string | null
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan_id: string
          status: SubscriptionStatus
          external_customer_id: string | null
          external_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan_id: string
          status: SubscriptionStatus
          external_customer_id?: string | null
          external_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan_id?: string
          status?: SubscriptionStatus
          external_customer_id?: string | null
          external_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          name: string
          person_type: 'individual' | 'company'
          document: string | null
          phone: string | null
          email: string | null
          address: string | null
          postal_code: string | null
          address_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          person_type?: 'individual' | 'company'
          document?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          postal_code?: string | null
          address_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          person_type?: 'individual' | 'company'
          document?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          postal_code?: string | null
          address_number?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          organization_id: string
          name: string
          document: string | null
          contact_name: string | null
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          document?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          document?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      inventory_items: {
        Row: {
          id: string
          organization_id: string
          supplier_id: string | null
          name: string
          unit: string
          quantity_on_hand: string
          minimum_quantity: string
          unit_price: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          supplier_id?: string | null
          name: string
          unit: string
          quantity_on_hand?: string
          minimum_quantity?: string
          unit_price?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          supplier_id?: string | null
          name?: string
          unit?: string
          quantity_on_hand?: string
          minimum_quantity?: string
          unit_price?: string
          updated_at?: string
        }
      }
      supplier_invoices: {
        Row: {
          id: string
          organization_id: string
          supplier_id: string
          invoice_number: string | null
          received_at: string
          file_path: string
          file_name: string
          content_type: string
          file_size: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          supplier_id: string
          invoice_number?: string | null
          received_at?: string
          file_path: string
          file_name: string
          content_type: string
          file_size: number
          created_at?: string
        }
        Update: {
          invoice_number?: string | null
          received_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          created_by: string | null
          creator_name: string | null
          quote_number: string
          status: QuoteStatus
          subtotal: string
          discount: string
          total: string
          valid_until: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          created_by?: string | null
          creator_name?: string | null
          quote_number?: string
          status?: QuoteStatus
          subtotal?: string
          discount?: string
          total?: string
          valid_until?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          status?: QuoteStatus
          subtotal?: string
          discount?: string
          total?: string
          valid_until?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          organization_id: string
          description: string
          quantity: string
          unit_price: string
          total: string
          sort_order: number
          inventory_item_id: string | null
          unit: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          organization_id: string
          description: string
          quantity: string
          unit_price: string
          total: string
          sort_order?: number
          inventory_item_id?: string | null
          unit?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string
          quantity?: string
          unit_price?: string
          total?: string
          sort_order?: number
          inventory_item_id?: string | null
          unit?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization_with_owner: {
        Args: {
          org_name: string
          org_slug: string
          owner_user_id: string
        }
        Returns: string
      }
      get_user_organization_role: {
        Args: {
          org_id: string
          uid: string
        }
        Returns: OrganizationRole | null
      }
      add_organization_member: {
        Args: {
          p_org_id: string
          p_email: string
          p_name: string
          p_password: string | null
          p_role: OrganizationRole
          p_modules: ModuleCode[]
          p_job_title: string | null
          p_dashboard_modules: DashboardModuleCode[]
        }
        Returns: Json
      }
      update_organization_member: {
        Args: {
          p_org_id: string
          p_user_id: string
          p_name: string
          p_email: string
          p_job_title: string | null
          p_role: OrganizationRole
        }
        Returns: boolean
      }
      update_member_dashboard_modules: {
        Args: {
          p_org_id: string
          p_user_id: string
          p_modules: DashboardModuleCode[]
        }
        Returns: boolean
      }
      update_quote_with_items: {
        Args: {
          p_organization_id: string
          p_quote_id: string
          p_customer_id: string
          p_valid_until: string | null
          p_notes: string | null
          p_discount: string
          p_subtotal: string
          p_total: string
          p_items: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      organization_role: OrganizationRole
      module_code: ModuleCode
      dashboard_module_code: DashboardModuleCode
      module_grant_status: ModuleGrantStatus
      subscription_status: SubscriptionStatus
      quote_status: QuoteStatus
    }
    CompositeTypes: Record<string, never>
  }
}
