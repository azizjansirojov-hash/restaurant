export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string;
          name: string;
          role: 'guest' | 'staff' | 'owner';
          loyalty_balance: number;
          push_token: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          phone: string;
          name: string;
          role?: 'guest' | 'staff' | 'owner';
          loyalty_balance?: number;
          push_token?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      menu_categories: {
        Row: { id: string; name: string; sort_order: number };
        Insert: { id: string; name: string; sort_order: number };
        Update: Partial<Database['public']['Tables']['menu_categories']['Insert']>;
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string;
          price_som: number;
          image_url: string;
          allergens: Json;
          modifiers: Json;
          upsell_tags: string[];
          is_available: boolean;
          sort_order: number;
        };
        Insert: Database['public']['Tables']['menu_items']['Row'];
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
        Relationships: [];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          type: 'percent' | 'fixed';
          value: number;
          active: boolean;
          max_redemptions: number | null;
          redemption_count: number;
        };
        Insert: Database['public']['Tables']['promo_codes']['Row'];
        Update: Partial<Database['public']['Tables']['promo_codes']['Insert']>;
        Relationships: [];
      };
      restaurant_settings: {
        Row: {
          id: string;
          display_name: string;
          address: string;
          hours: Json;
          timezone: string;
          pickup_eta_minutes: number;
          delivery_enabled: boolean;
          tax_rate_percent: number;
          tip_presets: number[];
          default_tip_percent: number;
          loyalty_earn_per_som: number;
          loyalty_redeem_block: number;
          loyalty_redeem_value_som: number;
          peak_deposit_enabled: boolean;
          peak_deposit_som: number;
          slot_capacity: number;
        };
        Insert: Database['public']['Tables']['restaurant_settings']['Row'];
        Update: Partial<Database['public']['Tables']['restaurant_settings']['Insert']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          status:
            | 'pending_payment'
            | 'received'
            | 'preparing'
            | 'ready'
            | 'completed'
            | 'cancelled';
          fulfillment_type: 'pickup' | 'delivery';
          subtotal_som: number;
          tax_som: number;
          tip_som: number;
          discount_som: number;
          total_som: number;
          promo_code_id: string | null;
          loyalty_redeemed_points: number | null;
          payment_intent_id: string | null;
          cancel_reason: string | null;
          created_at: string;
          ready_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: Database['public']['Tables']['orders']['Row']['status'];
          fulfillment_type: 'pickup' | 'delivery';
          subtotal_som: number;
          tax_som: number;
          tip_som: number;
          discount_som?: number;
          total_som: number;
          promo_code_id?: string | null;
          loyalty_redeemed_points?: number | null;
          payment_intent_id?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
          ready_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          name_snapshot: string;
          unit_price_som: number;
          modifiers_snapshot: Json;
          quantity: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id: string;
          name_snapshot: string;
          unit_price_som: number;
          modifiers_snapshot?: Json;
          quantity: number;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          user_id: string;
          party_size: number;
          slot_start: string;
          status: 'booked' | 'reminded' | 'seated' | 'no_show' | 'cancelled';
          deposit_hold_som: number | null;
          deposit_stripe_payment_intent_id: string | null;
          deposit_forfeited: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          party_size: number;
          slot_start: string;
          status?: Database['public']['Tables']['reservations']['Row']['status'];
          deposit_hold_som?: number | null;
          deposit_stripe_payment_intent_id?: string | null;
          deposit_forfeited?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>;
        Relationships: [];
      };
      loyalty_ledger: {
        Row: {
          id: string;
          user_id: string;
          order_id: string | null;
          delta_points: number;
          reason: 'earn' | 'redeem' | 'adjust';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id?: string | null;
          delta_points: number;
          reason: 'earn' | 'redeem' | 'adjust';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['loyalty_ledger']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      bump_order_status: { Args: { p_order_id: string }; Returns: Json };
      cancel_order: { Args: { p_order_id: string; p_reason: string }; Returns: Json };
      create_order: { Args: { p_payload: Json }; Returns: Json };
      create_reservation: {
        Args: { p_party_size: number; p_slot_start: string };
        Returns: Json;
      };
      update_reservation_status: {
        Args: { p_reservation_id: string; p_status: string };
        Returns: Json;
      };
      cancel_guest_reservation: { Args: { p_reservation_id: string }; Returns: Json };
      toggle_item_available: { Args: { p_item_id: string }; Returns: Json };
      update_restaurant_settings: { Args: { p_patch: Json }; Returns: Json };
      upsert_menu_item: { Args: { p_item: Json }; Returns: Json };
      delete_menu_item: { Args: { p_item_id: string }; Returns: Json };
      confirm_order_payment: {
        Args: { p_order_id: string; p_payment_intent_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
