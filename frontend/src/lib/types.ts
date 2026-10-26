export type Role = "customer" | "dealer" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: string;
  created_at: string;
}

export interface Manufacturer {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  country?: string | null;
  active: boolean;
  model_count?: number | null;
}

export interface VehicleCard {
  id: number;
  manufacturer_id: number;
  manufacturer_name: string;
  model_name: string;
  slug: string;
  body_type: string;
  image_url?: string | null;
  status: string;
  min_price?: string | null;
  max_price?: string | null;
  fuel_types: string[];
  transmissions: string[];
  seating_capacities: number[];
  variant_count: number;
}

export interface Variant {
  id: number;
  vehicle_model_id: number;
  variant_name: string;
  fuel_type: string;
  transmission: string;
  ex_showroom_price?: string | null;
  engine_displacement?: number | null;
  power?: string | null;
  torque?: string | null;
  mileage?: string | null;
  electric_range?: number | null;
  battery_capacity?: string | null;
  seating_capacity?: number | null;
  boot_space?: number | null;
  ground_clearance?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  fuel_tank_capacity?: number | null;
  safety_features: string[];
  comfort_features: string[];
  infotainment_features: string[];
  specification_source?: string | null;
  last_verified_at?: string | null;
}

export interface VehicleDetail extends VehicleCard {
  model_year?: number | null;
  description?: string | null;
  gallery_urls: string[];
  variants: Variant[];
  last_updated_at?: string | null;
  disclaimer: string;
}

export interface Dealer {
  id: number;
  dealer_name: string;
  address?: string | null;
  city: string;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  verification_status: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  manufacturer_names: string[];
  distance_km?: number | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface FilterOptions {
  manufacturers: Manufacturer[];
  body_types: string[];
  fuel_types: string[];
  transmissions: string[];
  seating_capacities: number[];
  price_min?: string | null;
  price_max?: string | null;
  total_models: number;
  total_manufacturers: number;
}

export interface Quotation {
  id: number;
  enquiry_dealer_id: number;
  enquiry_id?: number | null;
  dealer_id: number;
  dealer_name?: string | null;
  dealer_city?: string | null;
  vehicle_variant_id: number;
  vehicle_label?: string | null;
  ex_showroom_price: string;
  registration_charges: string;
  insurance_amount: string;
  accessories_amount: string;
  discount_amount: string;
  other_charges: string;
  final_price: string;
  estimated_delivery?: string | null;
  validity_date?: string | null;
  status: string;
  notes?: string | null;
  special_offer?: string | null;
  created_at: string;
  updated_at: string;
  value_score?: number | null;
  is_lowest: boolean;
}

export interface MarketPosition {
  total_quotes: number;
  lowest_final_price?: number | null;
  your_final_price?: number | null;
  your_rank?: number | null;
  gap_to_lowest?: number | null;
  is_lowest: boolean;
}

export interface DealerEnquiryDetail {
  enquiry_dealer_id: number;
  enquiry_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_label?: string | null;
  vehicle_variant_id?: number | null;
  location?: string | null;
  message?: string | null;
  response_status: string;
  market: MarketPosition;
}

// ---- AI multi-agent chat contract (mirrors StructuredChatResponse) ----

export interface ChatAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface ComparisonRow {
  attribute: string;
  values: string[];
}

export interface ComparisonResult {
  vehicles: string[];
  rows: ComparisonRow[];
  differences: string[];
  recommendation?: string | null;
}

// Vehicles in chat data come from either the finder (Recommendation) or details.
export interface ChatVehicle {
  vehicle_id?: number;
  id?: number;
  manufacturer?: string | null;
  model?: string | null;
  body_type?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  matches?: string[];
  tradeoffs?: string[];
  unknowns?: string[];
}

export interface ChatEnquiry {
  enquiry_dealer_id?: number;
  enquiry_id?: number | null;
  customer_name?: string | null;
  vehicle_label?: string | null;
  location?: string | null;
  response_status?: string | null;
}

export interface ChatData {
  vehicles: ChatVehicle[];
  comparison?: ComparisonResult | null;
  dealers: Array<Record<string, unknown>>;
  quotations: Array<Record<string, unknown>>;
  enquiries?: ChatEnquiry[];
}

export interface StructuredChatResponse {
  conversation_id?: number | null;
  intent: string;
  message: string;
  data: ChatData;
  actions: ChatAction[];
  clarification_required: boolean;
  ai_generated: boolean;
  error?: string | null;
}

export interface EnquiryDealerLink {
  id: number;
  dealer_id: number;
  dealer_name: string;
  response_status: string;
  sent_at: string;
  has_quotation: boolean;
}

export interface Enquiry {
  id: number;
  customer_id: number;
  vehicle_variant_id?: number | null;
  vehicle_label?: string | null;
  location?: string | null;
  message?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  dealers: EnquiryDealerLink[];
}
