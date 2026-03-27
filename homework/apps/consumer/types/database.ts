export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contractor_magic_links: {
        Row: {
          contractor_id: string
          created_at: string | null
          expires_at: string
          id: string
          order_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          order_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          order_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_magic_links_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_magic_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_internal: boolean | null
          logo_url: string | null
          name: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_internal?: boolean | null
          logo_url?: string | null
          name: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_internal?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          brand: string | null
          capacity: string | null
          condition: string | null
          created_at: string
          data_plate_photo_url: string | null
          deleted_at: string | null
          efficiency_rating: string | null
          equipment_type: string
          estimated_age_years: number | null
          fuel_type: string | null
          home_id: string
          hvac_system_id: string | null
          id: string
          installation_date: string | null
          last_service_date: string | null
          model_number: string | null
          next_service_due: string | null
          photo_url: string | null
          scanned_at: string | null
          serial_number: string | null
          updated_at: string
          warranty_compressor_expiration: string | null
          warranty_labor_expiration: string | null
          warranty_parts_expiration: string | null
          warranty_status: string | null
          warranty_verified_at: string | null
        }
        Insert: {
          brand?: string | null
          capacity?: string | null
          condition?: string | null
          created_at?: string
          data_plate_photo_url?: string | null
          deleted_at?: string | null
          efficiency_rating?: string | null
          equipment_type: string
          estimated_age_years?: number | null
          fuel_type?: string | null
          home_id: string
          hvac_system_id?: string | null
          id?: string
          installation_date?: string | null
          last_service_date?: string | null
          model_number?: string | null
          next_service_due?: string | null
          photo_url?: string | null
          scanned_at?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_compressor_expiration?: string | null
          warranty_labor_expiration?: string | null
          warranty_parts_expiration?: string | null
          warranty_status?: string | null
          warranty_verified_at?: string | null
        }
        Update: {
          brand?: string | null
          capacity?: string | null
          condition?: string | null
          created_at?: string
          data_plate_photo_url?: string | null
          deleted_at?: string | null
          efficiency_rating?: string | null
          equipment_type?: string
          estimated_age_years?: number | null
          fuel_type?: string | null
          home_id?: string
          hvac_system_id?: string | null
          id?: string
          installation_date?: string | null
          last_service_date?: string | null
          model_number?: string | null
          next_service_due?: string | null
          photo_url?: string | null
          scanned_at?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_compressor_expiration?: string | null
          warranty_labor_expiration?: string | null
          warranty_parts_expiration?: string | null
          warranty_status?: string | null
          warranty_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_hvac_system_id_fkey"
            columns: ["hvac_system_id"]
            isOneToOne: false
            referencedRelation: "hvac_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      home_tags: {
        Row: {
          added_by: string | null
          created_at: string
          home_id: string
          id: string
          tag: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          home_id: string
          id?: string
          tag: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          home_id?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_tags_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      homeowner_preferences: {
        Row: {
          allow_marketing_emails: boolean | null
          annual_maintenance_reminder: boolean | null
          created_at: string
          currency: string | null
          email_notifications: boolean | null
          filter_change_reminder: boolean | null
          id: string
          phone: string | null
          preferred_contact_method: string | null
          preferred_payment_method: string | null
          preferred_service_days: string[] | null
          preferred_time_of_day: string | null
          require_homeowner_present: boolean | null
          share_home_data_with_pros: boolean | null
          sms_notifications: boolean | null
          temperature_unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_marketing_emails?: boolean | null
          annual_maintenance_reminder?: boolean | null
          created_at?: string
          currency?: string | null
          email_notifications?: boolean | null
          filter_change_reminder?: boolean | null
          id?: string
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_payment_method?: string | null
          preferred_service_days?: string[] | null
          preferred_time_of_day?: string | null
          require_homeowner_present?: boolean | null
          share_home_data_with_pros?: boolean | null
          sms_notifications?: boolean | null
          temperature_unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_marketing_emails?: boolean | null
          annual_maintenance_reminder?: boolean | null
          created_at?: string
          currency?: string | null
          email_notifications?: boolean | null
          filter_change_reminder?: boolean | null
          id?: string
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_payment_method?: string | null
          preferred_service_days?: string[] | null
          preferred_time_of_day?: string | null
          require_homeowner_present?: boolean | null
          share_home_data_with_pros?: boolean | null
          sms_notifications?: boolean | null
          temperature_unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      homes: {
        Row: {
          apn: string | null
          assessor_id: string | null
          attic: boolean | null
          basement: boolean | null
          basement_sqft: number | null
          baths: number | null
          beds: number | null
          building_style: string | null
          city: string
          construction_type: string | null
          cooling_type: string | null
          county: string | null
          created_at: string
          deleted_at: string | null
          estimated_rent: number | null
          estimated_rent_date: string | null
          estimated_value: number | null
          estimated_value_date: string | null
          features: Json | null
          fireplace: boolean | null
          formatted_address: string | null
          foundation_type: string | null
          garage_spaces: number | null
          garage_type: string | null
          heating_fuel: string | null
          heating_type: string | null
          id: string
          last_sale_date: string | null
          last_sale_price: number | null
          lat: number | null
          legal_description: string | null
          lng: number | null
          lot_size_sqft: number | null
          owner_mailing_address: string | null
          owner_mailing_city: string | null
          owner_mailing_state: string | null
          owner_mailing_zip: string | null
          owner_name: string | null
          owner_occupied: boolean | null
          owner_type: string | null
          parcel_number: string | null
          pool: boolean | null
          prior_sale_date: string | null
          prior_sale_price: number | null
          property_type: string | null
          rentcast_data_source: string | null
          rentcast_id: string | null
          rentcast_last_updated: string | null
          roof_age_years: number | null
          roof_type: string | null
          siding_type: string | null
          sqft: number | null
          state: string
          stories: number | null
          street_address: string
          subdivision: string | null
          tax_annual_amount: number | null
          tax_assessed_value: number | null
          tax_assessed_year: number | null
          tax_rate_area: string | null
          updated_at: string
          user_id: string
          window_type: string | null
          year_built: number | null
          zip_code: string
          zoning: string | null
        }
        Insert: {
          apn?: string | null
          assessor_id?: string | null
          attic?: boolean | null
          basement?: boolean | null
          basement_sqft?: number | null
          baths?: number | null
          beds?: number | null
          building_style?: string | null
          city: string
          construction_type?: string | null
          cooling_type?: string | null
          county?: string | null
          created_at?: string
          deleted_at?: string | null
          estimated_rent?: number | null
          estimated_rent_date?: string | null
          estimated_value?: number | null
          estimated_value_date?: string | null
          features?: Json | null
          fireplace?: boolean | null
          formatted_address?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          garage_type?: string | null
          heating_fuel?: string | null
          heating_type?: string | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          lat?: number | null
          legal_description?: string | null
          lng?: number | null
          lot_size_sqft?: number | null
          owner_mailing_address?: string | null
          owner_mailing_city?: string | null
          owner_mailing_state?: string | null
          owner_mailing_zip?: string | null
          owner_name?: string | null
          owner_occupied?: boolean | null
          owner_type?: string | null
          parcel_number?: string | null
          pool?: boolean | null
          prior_sale_date?: string | null
          prior_sale_price?: number | null
          property_type?: string | null
          rentcast_data_source?: string | null
          rentcast_id?: string | null
          rentcast_last_updated?: string | null
          roof_age_years?: number | null
          roof_type?: string | null
          siding_type?: string | null
          sqft?: number | null
          state: string
          stories?: number | null
          street_address: string
          subdivision?: string | null
          tax_annual_amount?: number | null
          tax_assessed_value?: number | null
          tax_assessed_year?: number | null
          tax_rate_area?: string | null
          updated_at?: string
          user_id: string
          window_type?: string | null
          year_built?: number | null
          zip_code: string
          zoning?: string | null
        }
        Update: {
          apn?: string | null
          assessor_id?: string | null
          attic?: boolean | null
          basement?: boolean | null
          basement_sqft?: number | null
          baths?: number | null
          beds?: number | null
          building_style?: string | null
          city?: string
          construction_type?: string | null
          cooling_type?: string | null
          county?: string | null
          created_at?: string
          deleted_at?: string | null
          estimated_rent?: number | null
          estimated_rent_date?: string | null
          estimated_value?: number | null
          estimated_value_date?: string | null
          features?: Json | null
          fireplace?: boolean | null
          formatted_address?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          garage_type?: string | null
          heating_fuel?: string | null
          heating_type?: string | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          lat?: number | null
          legal_description?: string | null
          lng?: number | null
          lot_size_sqft?: number | null
          owner_mailing_address?: string | null
          owner_mailing_city?: string | null
          owner_mailing_state?: string | null
          owner_mailing_zip?: string | null
          owner_name?: string | null
          owner_occupied?: boolean | null
          owner_type?: string | null
          parcel_number?: string | null
          pool?: boolean | null
          prior_sale_date?: string | null
          prior_sale_price?: number | null
          property_type?: string | null
          rentcast_data_source?: string | null
          rentcast_id?: string | null
          rentcast_last_updated?: string | null
          roof_age_years?: number | null
          roof_type?: string | null
          siding_type?: string | null
          sqft?: number | null
          state?: string
          stories?: number | null
          street_address?: string
          subdivision?: string | null
          tax_annual_amount?: number | null
          tax_assessed_value?: number | null
          tax_assessed_year?: number | null
          tax_rate_area?: string | null
          updated_at?: string
          user_id?: string
          window_type?: string | null
          year_built?: number | null
          zip_code?: string
          zoning?: string | null
        }
        Relationships: []
      }
      hvac_systems: {
        Row: {
          created_at: string
          deleted_at: string | null
          estimated_age_years: number | null
          heat_source: string | null
          home_id: string
          id: string
          name: string
          overall_condition: string | null
          system_type: string | null
          tonnage: number | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          estimated_age_years?: number | null
          heat_source?: string | null
          home_id: string
          id?: string
          name?: string
          overall_condition?: string | null
          system_type?: string | null
          tonnage?: number | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          estimated_age_years?: number | null
          heat_source?: string | null
          home_id?: string
          id?: string
          name?: string
          overall_condition?: string | null
          system_type?: string | null
          tonnage?: number | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hvac_systems_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stages: {
        Row: {
          completed_at: string | null
          contractor_note: string | null
          description: string | null
          educational_content: Json | null
          icon: string | null
          id: string
          name: string
          order_id: string
          position: number
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          contractor_note?: string | null
          description?: string | null
          educational_content?: Json | null
          icon?: string | null
          id?: string
          name: string
          order_id: string
          position: number
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          contractor_note?: string | null
          description?: string | null
          educational_content?: Json | null
          icon?: string | null
          id?: string
          name?: string
          order_id?: string
          position?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          addons_total: number | null
          base_price: number | null
          completed_at: string | null
          contractor_id: string | null
          created_at: string | null
          current_stage_position: number | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_amount: number | null
          home_id: string | null
          homeowner_id: string
          id: string
          order_number: string
          product_brand: string | null
          product_model: string | null
          product_tier: string | null
          scheduled_date: string | null
          scheduled_time_slot: string | null
          service_type_id: string
          stage_template_id: string | null
          status: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          addons_total?: number | null
          base_price?: number | null
          completed_at?: string | null
          contractor_id?: string | null
          created_at?: string | null
          current_stage_position?: number | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_amount?: number | null
          home_id?: string | null
          homeowner_id: string
          id?: string
          order_number: string
          product_brand?: string | null
          product_model?: string | null
          product_tier?: string | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          service_type_id: string
          stage_template_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          addons_total?: number | null
          base_price?: number | null
          completed_at?: string | null
          contractor_id?: string | null
          created_at?: string | null
          current_stage_position?: number | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_amount?: number | null
          home_id?: string | null
          homeowner_id?: string
          id?: string
          order_number?: string
          product_brand?: string | null
          product_model?: string | null
          product_tier?: string | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          service_type_id?: string
          stage_template_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "stage_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      stage_template_items: {
        Row: {
          description: string | null
          educational_content: Json | null
          icon: string | null
          id: string
          name: string
          position: number
          template_id: string
          typical_duration_hours: number | null
        }
        Insert: {
          description?: string | null
          educational_content?: Json | null
          icon?: string | null
          id?: string
          name: string
          position: number
          template_id: string
          typical_duration_hours?: number | null
        }
        Update: {
          description?: string | null
          educational_content?: Json | null
          icon?: string | null
          id?: string
          name?: string
          position?: number
          template_id?: string
          typical_duration_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "stage_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_templates: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          service_type_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          service_type_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          service_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_templates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          category: string | null
          cost_labor: number | null
          cost_parts: number | null
          cost_total: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          equipment_id: string | null
          event_date: string
          event_type: string
          home_id: string
          hvac_system_id: string | null
          id: string
          invoice_url: string | null
          notes: string | null
          paid_by: string | null
          provider_email: string | null
          provider_name: string | null
          provider_phone: string | null
          receipt_url: string | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_labor?: number | null
          cost_parts?: number | null
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment_id?: string | null
          event_date: string
          event_type: string
          home_id: string
          hvac_system_id?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_by?: string | null
          provider_email?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          receipt_url?: string | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_labor?: number | null
          cost_parts?: number | null
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment_id?: string | null
          event_date?: string
          event_type?: string
          home_id?: string
          hvac_system_id?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_by?: string | null
          provider_email?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          receipt_url?: string | null
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_hvac_system_id_fkey"
            columns: ["hvac_system_id"]
            isOneToOne: false
            referencedRelation: "hvac_systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_order_stage: {
        Args: { p_contractor_note?: string; p_order_id: string }
        Returns: Json
      }
      copy_stages_to_order: {
        Args: { p_order_id: string; p_template_id: string }
        Returns: undefined
      }
      generate_order_number: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
