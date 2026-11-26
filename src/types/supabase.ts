export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
  [key: string]: any;
  Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: any[];
      menu_items: {
        Row: {
          id: string; name: string; price: number; category: string;
          subcategory: string | null; description: string | null;
          ingredients: string[]; available: boolean; order: number;
          image_url?: string | null; prep_time?: number | null; active?: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["menu_items"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string; business_name: string; address: string; phone: string;
          email: string; logo_url: string; timezone: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          customer_name: string;
          reservation_time: string;
          party_size: number;
          phone: string;
          inserted_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          reservation_time: string;
          party_size: number;
          phone: string;
        };
        Update: {
          customer_name?: string;
          reservation_time?: string;
          party_size?: number;
          phone?: string;
        };
      };
      // ... inne tabele
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
