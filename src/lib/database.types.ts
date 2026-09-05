export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["agency_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["agency_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["agency_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          branch_id: string | null
          created_at: string
          id: string
          invited_at: string | null
          joined_at: string | null
          profile_id: string
          role_id: string
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          profile_id: string
          role_id: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          profile_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: []
      }
      agency_settings: {
        Row: {
          agency_id: string
          branding: Json
          cancellation_policy: string | null
          default_deposit: number
          deposit_required: boolean
          extra: Json
          fuel_policy: string | null
          late_return_policy: string | null
          mileage_policy: string | null
          tax_rate: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          branding?: Json
          cancellation_policy?: string | null
          default_deposit?: number
          deposit_required?: boolean
          extra?: Json
          fuel_policy?: string | null
          late_return_policy?: string | null
          mileage_policy?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          branding?: Json
          cancellation_policy?: string | null
          default_deposit?: number
          deposit_required?: boolean
          extra?: Json
          fuel_policy?: string | null
          late_return_policy?: string | null
          mileage_policy?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          agency_id: string
          contract_number: string
          created_at: string
          created_by: string | null
          customer_id: string
          daily_rate: number
          deposit_amount: number
          end_date: string
          end_mileage: number | null
          fuel_level_end: number | null
          fuel_level_start: number | null
          id: string
          reservation_id: string | null
          signed_at: string | null
          start_date: string
          start_mileage: number | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          total_amount: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          contract_number: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          daily_rate?: number
          deposit_amount?: number
          end_date: string
          end_mileage?: number | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          reservation_id?: string | null
          signed_at?: string | null
          start_date: string
          start_mileage?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          total_amount?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          contract_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          daily_rate?: number
          deposit_amount?: number
          end_date?: string
          end_mileage?: number | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          reservation_id?: string | null
          signed_at?: string | null
          start_date?: string
          start_mileage?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          total_amount?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          agency_id: string
          city: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          driver_license_expiry: string | null
          driver_license_number: string | null
          email: string | null
          first_name: string
          id: string
          id_number: string | null
          id_type: Database["public"]["Enums"]["id_document_type"]
          last_name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          driver_license_expiry?: string | null
          driver_license_number?: string | null
          email?: string | null
          first_name: string
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_document_type"]
          last_name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          driver_license_expiry?: string | null
          driver_license_number?: string | null
          email?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_document_type"]
          last_name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          agency_id: string
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          garage_name: string | null
          id: string
          mileage_at_service: number | null
          next_service_date: string | null
          service_date: string
          status: Database["public"]["Enums"]["maintenance_status"]
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          garage_name?: string | null
          id?: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          service_date?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          garage_name?: string | null
          id?: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          service_date?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          agency_id: string
          amount: number
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          reference: string | null
          reservation_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          agency_id: string
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          reference?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          agency_id?: string
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          reference?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: []
      }
      permissions: {
        Row: { action: string; description: string | null; id: string; key: string; resource: string }
        Insert: { action: string; description?: string | null; id?: string; key: string; resource: string }
        Update: { action?: string; description?: string | null; id?: string; key?: string; resource?: string }
        Relationships: []
      }
      plans: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          key: string
          max_branches: number | null
          max_storage_mb: number | null
          max_users: number | null
          max_vehicles: number | null
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          key: string
          max_branches?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          key?: string
          max_branches?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          daily_rate: number
          discount: number
          end_date: string
          id: string
          notes: string | null
          pickup_location: string | null
          reference: string
          return_location: string | null
          start_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          total_days: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          daily_rate?: number
          discount?: number
          end_date: string
          id?: string
          notes?: string | null
          pickup_location?: string | null
          reference: string
          return_location?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          total_days?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          daily_rate?: number
          discount?: number
          end_date?: string
          id?: string
          notes?: string | null
          pickup_location?: string | null
          reference?: string
          return_location?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          total_days?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: { permission_id: string; role_id: string }
        Insert: { permission_id: string; role_id: string }
        Update: { permission_id?: string; role_id?: string }
        Relationships: []
      }
      roles: {
        Row: { created_at: string; description: string | null; id: string; is_system: boolean; key: string; name: string }
        Insert: { created_at?: string; description?: string | null; id?: string; is_system?: boolean; key: string; name: string }
        Update: { created_at?: string; description?: string | null; id?: string; is_system?: boolean; key?: string; name?: string }
        Relationships: []
      }
      subscriptions: {
        Row: {
          agency_id: string
          amount: number
          created_at: string
          ends_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          agency_id: string
          brand: string
          category: string
          color: string | null
          created_at: string
          daily_rate: number
          deleted_at: string | null
          doors: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          image_url: string | null
          insurance_expiry: string | null
          license_plate: string
          mileage: number
          model: string
          notes: string | null
          registration_date: string | null
          seats: number
          status: Database["public"]["Enums"]["vehicle_status"]
          technical_inspection_expiry: string | null
          transmission: Database["public"]["Enums"]["transmission_type"]
          updated_at: string
          vin: string | null
          year: number
        }
        Insert: {
          agency_id: string
          brand: string
          category?: string
          color?: string | null
          created_at?: string
          daily_rate?: number
          deleted_at?: string | null
          doors?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          license_plate: string
          mileage?: number
          model: string
          notes?: string | null
          registration_date?: string | null
          seats?: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          technical_inspection_expiry?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          vin?: string | null
          year: number
        }
        Update: {
          agency_id?: string
          brand?: string
          category?: string
          color?: string | null
          created_at?: string
          daily_rate?: number
          deleted_at?: string | null
          doors?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          license_plate?: string
          mileage?: number
          model?: string
          notes?: string | null
          registration_date?: string | null
          seats?: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          technical_inspection_expiry?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_agency_with_owner: {
        Args: {
          p_address?: string
          p_city?: string
          p_country?: string
          p_currency?: string
          p_email?: string
          p_ends_at?: string
          p_logo_url?: string
          p_name: string
          p_notes?: string
          p_owner_profile_id: string
          p_phone?: string
          p_plan_id: string
          p_slug: string
          p_starts_at?: string
          p_status?: Database["public"]["Enums"]["agency_status"]
          p_timezone?: string
          p_trial?: boolean
        }
        Returns: string
      }
      current_agency_id: { Args: Record<string, never>; Returns: string }
      get_user_agency_ids: { Args: Record<string, never>; Returns: string[] }
      is_agency_member: { Args: { p_agency_id: string }; Returns: boolean }
      is_agency_operational: { Args: { p_agency_id: string }; Returns: boolean }
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
      shares_agency_with: { Args: { p_profile_id: string }; Returns: boolean }
      user_has_permission: { Args: { p_agency_id: string; p_permission: string }; Returns: boolean }
    }
    Enums: {
      agency_status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TRIAL" | "EXPIRED"
      billing_cycle: "MONTHLY" | "YEARLY"
      contract_status: "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED"
      fuel_type: "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID" | "LPG"
      id_document_type: "CIN" | "PASSPORT" | "DRIVER_LICENSE" | "RESIDENCE_CARD"
      maintenance_status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      maintenance_type: "OIL_CHANGE" | "TIRES" | "INSPECTION" | "REPAIR" | "CLEANING" | "OTHER"
      member_status: "active" | "disabled" | "invited"
      payment_method: "CASH" | "CARD" | "TRANSFER" | "CHECK"
      payment_status: "PENDING" | "COMPLETED" | "REFUNDED" | "FAILED"
      payment_type: "DEPOSIT" | "RENTAL" | "REFUND" | "PENALTY" | "EXTRA"
      reservation_status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED"
      subscription_status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELLED" | "SUSPENDED"
      transmission_type: "MANUAL" | "AUTOMATIC"
      vehicle_status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "OUT_OF_SERVICE" | "RESERVED"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
