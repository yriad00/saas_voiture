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
          extra_mileage_rate: number
          fuel_policy: string | null
          fuel_shortfall_rate: number
          cleaning_fee: number
          late_return_policy: string | null
          mileage_allowance: number | null
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
          extra_mileage_rate?: number
          fuel_policy?: string | null
          fuel_shortfall_rate?: number
          cleaning_fee?: number
          late_return_policy?: string | null
          mileage_allowance?: number | null
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
          extra_mileage_rate?: number
          fuel_policy?: string | null
          fuel_shortfall_rate?: number
          cleaning_fee?: number
          late_return_policy?: string | null
          mileage_allowance?: number | null
          mileage_policy?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          id: string
          agency_id: string
          name: string
          code: string
          city: string | null
          address: string | null
          phone: string | null
          whatsapp: string | null
          email: string | null
          opening_hours: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          name: string
          code: string
          city?: string | null
          address?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          opening_hours?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          name?: string
          code?: string
          city?: string | null
          address?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          opening_hours?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          agency_id: string
          base_total_amount: number
          branch_id: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          customer_id: string
          daily_rate: number
          deposit_amount: number
          end_date: string
          end_at: string | null
          end_mileage: number | null
          fuel_level_end: number | null
          fuel_level_start: number | null
          id: string
          extras_total: number
          reservation_id: string | null
          signed_at: string | null
          start_date: string
          start_at: string | null
          start_mileage: number | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          terms_ar: string | null
          contract_language: string
          terms_version: number
          terms_snapshot_at: string
          return_charges_total: number
          final_total_amount: number | null
          mileage_policy: string
          mileage_allowance: number | null
          extra_mileage_rate: number | null
          fuel_shortfall_rate: number | null
          cleaning_fee: number | null
          early_return_adjustment: number
          total_amount: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          base_total_amount?: number
          branch_id?: string | null
          contract_number: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          daily_rate?: number
          deposit_amount?: number
          end_date: string
          end_at?: string | null
          end_mileage?: number | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          extras_total?: number
          reservation_id?: string | null
          signed_at?: string | null
          start_date: string
          start_at?: string | null
          start_mileage?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          terms_ar?: string | null
          contract_language?: string
          terms_version?: number
          terms_snapshot_at?: string
          return_charges_total?: number
          final_total_amount?: number | null
          mileage_policy?: string
          mileage_allowance?: number | null
          extra_mileage_rate?: number | null
          fuel_shortfall_rate?: number | null
          cleaning_fee?: number | null
          early_return_adjustment?: number
          total_amount?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          base_total_amount?: number
          branch_id?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          daily_rate?: number
          deposit_amount?: number
          end_date?: string
          end_at?: string | null
          end_mileage?: number | null
          fuel_level_end?: number | null
          fuel_level_start?: number | null
          id?: string
          extras_total?: number
          reservation_id?: string | null
          signed_at?: string | null
          start_date?: string
          start_at?: string | null
          start_mileage?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          terms_ar?: string | null
          contract_language?: string
          terms_version?: number
          terms_snapshot_at?: string
          return_charges_total?: number
          final_total_amount?: number | null
          mileage_policy?: string
          mileage_allowance?: number | null
          extra_mileage_rate?: number | null
          fuel_shortfall_rate?: number | null
          cleaning_fee?: number | null
          early_return_adjustment?: number
          total_amount?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          agency_id: string
          branch_id: string | null
          buyer_address: string | null
          buyer_ice: string | null
          buyer_name: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          document_key: string | null
          currency: string
          id: string
          invoice_number: string
          issued_at: string
          kind: string
          notes: string | null
          payment_method: string | null
          payment_reference: string | null
          seller_address: string | null
          seller_ice: string | null
          seller_if: string | null
          seller_name: string
          seller_tp: string | null
          seller_rc: string | null
          snapshot: Json
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          buyer_address?: string | null
          buyer_ice?: string | null
          buyer_name: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_key?: string | null
          currency?: string
          id?: string
          invoice_number: string
          issued_at?: string
          kind?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          seller_address?: string | null
          seller_ice?: string | null
          seller_if?: string | null
          seller_name: string
          seller_tp?: string | null
          seller_rc?: string | null
          snapshot?: Json
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          buyer_address?: string | null
          buyer_ice?: string | null
          buyer_name?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_key?: string | null
          currency?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          kind?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          seller_address?: string | null
          seller_ice?: string | null
          seller_if?: string | null
          seller_name?: string
          seller_tp?: string | null
          seller_rc?: string | null
          snapshot?: Json
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          agency_id: string
          budget: number | null
          converted_customer_id: string | null
          converted_reservation_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          end_date: string | null
          first_name: string
          follow_up_date: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          requested_category: string | null
          source: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          budget?: number | null
          converted_customer_id?: string | null
          converted_reservation_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          end_date?: string | null
          first_name: string
          follow_up_date?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          requested_category?: string | null
          source?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          budget?: number | null
          converted_customer_id?: string | null
          converted_reservation_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          end_date?: string | null
          first_name?: string
          follow_up_date?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          requested_category?: string | null
          source?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_inspections: {
        Row: {
          agency_id: string
          branch_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          damage_notes: string | null
          fuel_level: number | null
          id: string
          inspected_at: string
          inspection_type: string
          mileage: number | null
          notes: string | null
          signature_name: string
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          damage_notes?: string | null
          fuel_level?: number | null
          id?: string
          inspected_at?: string
          inspection_type: string
          mileage?: number | null
          notes?: string | null
          signature_name: string
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          damage_notes?: string | null
          fuel_level?: number | null
          id?: string
          inspected_at?: string
          inspection_type?: string
          mileage?: number | null
          notes?: string | null
          signature_name?: string
        }
        Relationships: []
      }
      active_rental_updates: {
        Row: {
          agency_id: string
          branch_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          event_type: string
          fuel_level: number | null
          id: string
          location: string | null
          mileage: number | null
          notes: string
          occurred_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          fuel_level?: number | null
          id?: string
          location?: string | null
          mileage?: number | null
          notes: string
          occurred_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          fuel_level?: number | null
          id?: string
          location?: string | null
          mileage?: number | null
          notes?: string
          occurred_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string | null
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      contract_inspection_photos: {
        Row: {
          agency_id: string
          branch_id: string | null
          content_type: string
          contract_id: string
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          inspection_type: string
          size_bytes: number
          storage_path: string
          photo_type: string
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          content_type: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          inspection_type: string
          size_bytes: number
          storage_path: string
          photo_type?: string
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          content_type?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          inspection_type?: string
          size_bytes?: number
          storage_path?: string
          photo_type?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          id: string
          agency_id: string
          branch_id: string | null
          contract_id: string
          signer_type: string
          signer_id: string | null
          signer_name: string
          signature_data: string
          signed_at: string
          contract_version: number
          created_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          branch_id?: string | null
          contract_id: string
          signer_type: string
          signer_id?: string | null
          signer_name: string
          signature_data: string
          signed_at?: string
          contract_version?: number
          created_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          branch_id?: string | null
          contract_id?: string
          signer_type?: string
          signer_id?: string | null
          signer_name?: string
          signature_data?: string
          signed_at?: string
          contract_version?: number
          created_at?: string
        }
        Relationships: []
      }
      contract_checkouts: {
        Row: {
          accessories: Json
          agency_id: string
          branch_id: string | null
          checkout_at: string
          contract_id: string
          created_at: string
          created_by: string | null
          cleanliness: string
          fuel_level: number
          id: string
          keys_count: number
          mileage: number
          notes: string | null
          reservation_id: string | null
          signature_data: string | null
          signature_name: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          accessories?: Json
          agency_id: string
          branch_id?: string | null
          checkout_at?: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          cleanliness: string
          fuel_level: number
          id?: string
          keys_count?: number
          mileage: number
          notes?: string | null
          reservation_id?: string | null
          signature_data?: string | null
          signature_name: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          accessories?: Json
          agency_id?: string
          branch_id?: string | null
          checkout_at?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          cleanliness?: string
          fuel_level?: number
          id?: string
          keys_count?: number
          mileage?: number
          notes?: string | null
          reservation_id?: string | null
          signature_data?: string | null
          signature_name?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      contract_extras: {
        Row: {
          agency_id: string
          branch_id: string | null
          code: string
          contract_id: string
          created_at: string
          created_by: string | null
          extra_id: string | null
          id: string
          name: string
          notes: string | null
          pricing_type: string
          quantity: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          code: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          extra_id?: string | null
          id?: string
          name: string
          notes?: string | null
          pricing_type: string
          quantity: number
          total_amount: number
          unit_price: number
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          code?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          extra_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          pricing_type?: string
          quantity?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: []
      }
      extras_catalog: {
        Row: {
          active: boolean
          agency_id: string
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_quantity: number | null
          min_quantity: number
          name: string
          price: number
          pricing_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          name: string
          price: number
          pricing_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          name?: string
          price?: number
          pricing_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          agency_id: string
          branch_id: string | null
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          idempotency_key: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          vehicle_id: string | null
          vendor: string | null
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          idempotency_key?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          vehicle_id?: string | null
          vendor?: string | null
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          idempotency_key?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          vehicle_id?: string | null
          vendor?: string | null
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
          whatsapp: string | null
          id_expiry: string | null
          driver_license_issued_at: string | null
          passport_expiry: string | null
          international_permit_number: string | null
          customer_type: string
          company_name: string | null
          ice: string | null
          if_number: string | null
          rc_number: string | null
          contact_person: string | null
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
          whatsapp?: string | null
          id_expiry?: string | null
          driver_license_issued_at?: string | null
          passport_expiry?: string | null
          international_permit_number?: string | null
          customer_type?: string
          company_name?: string | null
          ice?: string | null
          if_number?: string | null
          rc_number?: string | null
          contact_person?: string | null
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
          whatsapp?: string | null
          id_expiry?: string | null
          driver_license_issued_at?: string | null
          passport_expiry?: string | null
          international_permit_number?: string | null
          customer_type?: string
          company_name?: string | null
          ice?: string | null
          if_number?: string | null
          rc_number?: string | null
          contact_person?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_risk_flags: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      customer_documents: {
        Row: {
          agency_id: string
          content_type: string
          created_at: string
          created_by: string | null
          customer_id: string
          document_type: string
          expires_at: string | null
          file_name: string
          id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          agency_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          document_type: string
          expires_at?: string | null
          file_name: string
          id?: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          agency_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          agency_id: string
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
          branch_id: string | null
          amount: number
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          idempotency_key: string | null
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
          branch_id?: string | null
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          idempotency_key?: string | null
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
          branch_id?: string | null
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          idempotency_key?: string | null
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
      reservation_extras: {
        Row: {
          agency_id: string
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          extra_id: string
          id: string
          name: string
          notes: string | null
          pricing_type: string
          quantity: number
          reservation_id: string
          total_amount: number
          unit_price: number
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          extra_id: string
          id?: string
          name: string
          notes?: string | null
          pricing_type: string
          quantity: number
          reservation_id: string
          total_amount: number
          unit_price: number
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          extra_id?: string
          id?: string
          name?: string
          notes?: string | null
          pricing_type?: string
          quantity?: number
          reservation_id?: string
          total_amount?: number
          unit_price?: number
        }
        Relationships: []
      }
      rental_extensions: {
        Row: {
          added_days: number
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          daily_rate: number
          extra_amount: number
          id: string
          new_end_date: string
          new_end_at: string | null
          previous_end_date: string
          previous_end_at: string | null
          reason: string
          status: string
        }
        Insert: {
          added_days: number
          agency_id: string
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          daily_rate: number
          extra_amount: number
          id?: string
          new_end_date: string
          new_end_at?: string | null
          previous_end_date: string
          previous_end_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          added_days?: number
          agency_id?: string
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          extra_amount?: number
          id?: string
          new_end_date?: string
          new_end_at?: string | null
          previous_end_date?: string
          previous_end_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          agency_id: string
          base_total_amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          daily_rate: number
          discount: number
          end_date: string
          pickup_at: string | null
          id: string
          extras_total: number
          notes: string | null
          pickup_location: string | null
          reference: string
          return_location: string | null
          start_date: string
          return_at: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          total_days: number
          updated_at: string
          vehicle_id: string
          source: string
          deposit_amount: number
          advance_amount: number
          remaining_amount: number
        }
        Insert: {
          agency_id: string
          base_total_amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          daily_rate?: number
          discount?: number
          end_date: string
          pickup_at?: string | null
          id?: string
          extras_total?: number
          notes?: string | null
          pickup_location?: string | null
          reference: string
          return_location?: string | null
          start_date: string
          return_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          total_days?: number
          updated_at?: string
          vehicle_id: string
          source?: string
          deposit_amount?: number
          advance_amount?: number
          remaining_amount?: number
        }
        Update: {
          agency_id?: string
          base_total_amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          daily_rate?: number
          discount?: number
          end_date?: string
          pickup_at?: string | null
          id?: string
          extras_total?: number
          notes?: string | null
          pickup_location?: string | null
          reference?: string
          return_location?: string | null
          start_date?: string
          return_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          total_days?: number
          updated_at?: string
          vehicle_id?: string
          source?: string
          deposit_amount?: number
          advance_amount?: number
          remaining_amount?: number
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
      pricing_override_history: {
        Row: {
          actor_id: string
          agency_id: string
          approved: boolean
          branch_id: string | null
          contract_id: string | null
          created_at: string
          discount_amount: number
          id: string
          minimum_daily_rate: number
          original_daily_rate: number
          reason: string
          requested_daily_rate: number
          reservation_id: string | null
        }
        Insert: {
          actor_id: string
          agency_id: string
          approved?: boolean
          branch_id?: string | null
          contract_id?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          minimum_daily_rate: number
          original_daily_rate: number
          reason: string
          requested_daily_rate: number
          reservation_id?: string | null
        }
        Update: {
          actor_id?: string
          agency_id?: string
          approved?: boolean
          branch_id?: string | null
          contract_id?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          minimum_daily_rate?: number
          original_daily_rate?: number
          reason?: string
          requested_daily_rate?: number
          reservation_id?: string | null
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          active: boolean
          agency_id: string
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          daily_rate: number
          id: string
          monthly_rate: number
          minimum_daily_rate: number
          name: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          vehicle_id: string | null
          weekly_rate: number
        }
        Insert: {
          active?: boolean
          agency_id: string
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          id?: string
          monthly_rate?: number
          minimum_daily_rate?: number
          name: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          vehicle_id?: string | null
          weekly_rate?: number
        }
        Update: {
          active?: boolean
          agency_id?: string
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          id?: string
          monthly_rate?: number
          minimum_daily_rate?: number
          name?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          vehicle_id?: string | null
          weekly_rate?: number
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          agency_id: string
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          id: string
          minimum_days: number
          name: string
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          id?: string
          minimum_days?: number
          name: string
          updated_at?: string
          valid_from: string
          valid_to: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          minimum_days?: number
          name?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      vehicle_preparations: {
        Row: {
          accessories_checked: boolean
          agency_id: string
          branch_id: string | null
          contract_id: string | null
          created_at: string
          documents_checked: boolean
          fuel_level_checked: boolean
          id: string
          keys_count: number
          notes: string | null
          photos_checked: boolean
          prepared_at: string | null
          prepared_by: string | null
          reservation_id: string | null
          status: string
          tires_checked: boolean
          updated_at: string
          vehicle_clean: boolean
          vehicle_id: string
        }
        Insert: {
          accessories_checked?: boolean
          agency_id: string
          branch_id?: string | null
          contract_id?: string | null
          created_at?: string
          documents_checked?: boolean
          fuel_level_checked?: boolean
          id?: string
          keys_count?: number
          notes?: string | null
          photos_checked?: boolean
          prepared_at?: string | null
          prepared_by?: string | null
          reservation_id?: string | null
          status?: string
          tires_checked?: boolean
          updated_at?: string
          vehicle_clean?: boolean
          vehicle_id: string
        }
        Update: {
          accessories_checked?: boolean
          agency_id?: string
          branch_id?: string | null
          contract_id?: string | null
          created_at?: string
          documents_checked?: boolean
          fuel_level_checked?: boolean
          id?: string
          keys_count?: number
          notes?: string | null
          photos_checked?: boolean
          prepared_at?: string | null
          prepared_by?: string | null
          reservation_id?: string | null
          status?: string
          tires_checked?: boolean
          updated_at?: string
          vehicle_clean?: boolean
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_swaps: {
        Row: {
          agency_id: string
          branch_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          fuel_level: number | null
          id: string
          new_mileage: number | null
          new_vehicle_id: string
          old_mileage: number | null
          old_vehicle_id: string
          reason: string
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          fuel_level?: number | null
          id?: string
          new_mileage?: number | null
          new_vehicle_id: string
          old_mileage?: number | null
          old_vehicle_id: string
          reason: string
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          fuel_level?: number | null
          id?: string
          new_mileage?: number | null
          new_vehicle_id?: string
          old_mileage?: number | null
          old_vehicle_id?: string
          reason?: string
        }
        Relationships: []
      }
      vehicle_blocks: {
        Row: {
          agency_id: string
          block_type: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          reason: string
          start_date: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          block_type: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          reason: string
          start_date: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          block_type?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          agency_id: string
          content_type: string
          created_at: string
          created_by: string | null
          document_number: string | null
          document_type: string
          expires_at: string | null
          file_name: string
          id: string
          issued_at: string | null
          size_bytes: number
          storage_path: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agency_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          document_type: string
          expires_at?: string | null
          file_name: string
          id?: string
          issued_at?: string | null
          size_bytes: number
          storage_path: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agency_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          document_type?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          issued_at?: string | null
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          agency_id: string
          branch_id: string | null
          brand: string
          category: string
          color: string | null
          created_at: string
          daily_rate: number
          deleted_at: string | null
          doors: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          gps_device_id: string | null
          gps_enabled: boolean
          gps_last_latitude: number | null
          gps_last_longitude: number | null
          gps_last_seen_at: string | null
          gps_provider: string | null
          gps_tracking_url: string | null
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
          weekly_rate: number
          monthly_rate: number
          deposit_amount: number
          ownership_type: string
          photo_urls: Json
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          brand: string
          category?: string
          color?: string | null
          created_at?: string
          daily_rate?: number
          deleted_at?: string | null
          doors?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          gps_device_id?: string | null
          gps_enabled?: boolean
          gps_last_latitude?: number | null
          gps_last_longitude?: number | null
          gps_last_seen_at?: string | null
          gps_provider?: string | null
          gps_tracking_url?: string | null
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
          weekly_rate?: number
          monthly_rate?: number
          deposit_amount?: number
          ownership_type?: string
          photo_urls?: Json
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          brand?: string
          category?: string
          color?: string | null
          created_at?: string
          daily_rate?: number
          deleted_at?: string | null
          doors?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          gps_device_id?: string | null
          gps_enabled?: boolean
          gps_last_latitude?: number | null
          gps_last_longitude?: number | null
          gps_last_seen_at?: string | null
          gps_provider?: string | null
          gps_tracking_url?: string | null
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
          weekly_rate?: number
          monthly_rate?: number
          deposit_amount?: number
          ownership_type?: string
          photo_urls?: Json
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
      consume_rate_limit: {
        Args: { p_scope: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      consume_login_rate_limit: {
        Args: { p_ip_hash: string; p_email_hash: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      record_payment_with_cash: {
        Args: {
          p_agency_id: string
          p_branch_id?: string | null
          p_contract_id?: string | null
          p_customer_id?: string | null
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_type: Database["public"]["Enums"]["payment_type"]
          p_status: Database["public"]["Enums"]["payment_status"]
          p_reference?: string | null
          p_paid_at?: string | null
          p_notes?: string | null
          p_idempotency_key?: string | null
        }
        Returns: string
      }
      record_expense_with_cash: {
        Args: {
          p_agency_id: string
          p_branch_id?: string | null
          p_vehicle_id?: string | null
          p_category: string
          p_amount: number
          p_expense_date?: string | null
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_vendor?: string | null
          p_description?: string | null
          p_idempotency_key?: string | null
        }
        Returns: string
      }
      finalize_contract_checkin: {
        Args: {
          p_agency_id: string
          p_contract_id: string
          p_branch_id: string
          p_actual_return_at: string
          p_return_mileage: number
          p_fuel_level: number
          p_cleanliness: string
          p_exterior_condition?: string | null
          p_interior_condition?: string | null
          p_missing_items?: Json
          p_notes?: string | null
          p_signature_name?: string | null
          p_signature_data?: string | null
        }
        Returns: Json
      }
      set_reservation_status_financial: {
        Args: {
          p_agency_id: string
          p_reservation_id: string
          p_status: Database["public"]["Enums"]["reservation_status"]
          p_reason?: string | null
          p_refund_amount?: number
          p_refund_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      close_contract_atomic: {
        Args: {
          p_agency_id: string
          p_contract_id: string
          p_end_mileage?: number | null
          p_fuel_level_end?: number | null
        }
        Returns: Json
      }
      save_vehicle_owner_settlement: {
        Args: {
          p_agency_id: string
          p_contract_id: string
          p_owner_amount: number
          p_paid_amount: number
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string | null
        }
        Returns: Json
      }
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
      payment_type: "DEPOSIT" | "DEPOSIT_REFUND" | "RENTAL" | "REFUND" | "PENALTY" | "EXTRA"
      reservation_status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
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
