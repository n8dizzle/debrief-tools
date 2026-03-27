// @homework/shared types
// Complete TypeScript types for the Homework marketplace platform.
// All money amounts are stored as integers (cents).
// All ratings are stored as integers (1-5).
// All timestamps are ISO 8601 strings from Supabase (timestamptz).

// ---------------------------------------------------------------------------
// Enums & Union Types
// ---------------------------------------------------------------------------

export type UserRole = 'homeowner' | 'contractor' | 'admin';

export type ProfileStatus = 'active' | 'suspended' | 'deactivated';

export type ContractorStatus =
  | 'pending_application'
  | 'pending_review'
  | 'approved'
  | 'suspended'
  | 'deactivated';

export type ContractorTier = 'standard' | 'preferred' | 'elite';

/** How a service can be priced / purchased */
export type ProductizabilityType =
  | 'instant_price'    // Fixed price, buy now
  | 'configurator'     // Price varies by home variables, calculated live
  | 'photo_estimate'   // Homeowner uploads photos, contractor quotes
  | 'onsite_estimate'  // Requires an onsite visit to quote
  | 'custom';          // Fully custom / contact us

/** HomeFit compatibility result */
export type HomeFitResult = 'compatible' | 'incompatible' | 'needs_review';

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type OrderItemStatus =
  | 'pending'
  | 'contractor_assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TransactionType = 'payment' | 'platform_fee' | 'payout' | 'refund';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type NotificationType =
  | 'order_confirmation'
  | 'order_scheduled'
  | 'order_completed'
  | 'order_cancelled'
  | 'payment_received'
  | 'payout_sent'
  | 'review_received'
  | 'new_lead'
  | 'lead_expired'
  | 'account_update'
  | 'system';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type HomeOwnershipType = 'own' | 'rent';

export type MarketStatus = 'active' | 'coming_soon' | 'inactive';

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

/** Linked to auth.users via id. Single source of truth for user identity. */
export interface UserProfile {
  id: string;                        // auth.users UUID
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Master Catalog
// ---------------------------------------------------------------------------

/** Top-level grouping: e.g. HVAC, Plumbing, Electrical */
export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Second-level grouping within a department: e.g. AC Repair, Water Heaters */
export interface Category {
  id: string;
  department_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  department?: Department;
}

/** An individual service offering: e.g. AC Tune-Up, Tankless Water Heater Install */
export interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  short_description: string;
  long_description: string | null;
  icon: string | null;
  image_url: string | null;
  productizability: ProductizabilityType;
  base_price_cents: number | null;     // Base price before variables, in cents
  estimated_duration_minutes: number | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  meta: Record<string, unknown> | null; // Flexible metadata (SEO, tags, etc.)
  created_at: string;
  updated_at: string;

  // Joined
  category?: Category;
  variables?: ServiceVariable[];
  addons?: ServiceAddon[];
  homefit_rules?: HomeFitRule[];
}

/**
 * A configurable variable that affects price.
 * e.g. "Home Square Footage", "System Age", "Number of Units"
 */
export interface ServiceVariable {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  description: string | null;
  variable_type: 'select' | 'number' | 'boolean';
  options: ServiceVariableOption[] | null; // For 'select' type
  min_value: number | null;                // For 'number' type
  max_value: number | null;                // For 'number' type
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceVariableOption {
  value: string;
  label: string;
  price_adjustment_cents: number;          // Added to base price
}

/** Optional add-on for a service: e.g. "UV Light", "Smart Thermostat Upgrade" */
export interface ServiceAddon {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * HomeFit rule: determines whether a service is compatible with a home.
 * Each rule checks a home feature against a condition.
 */
export interface HomeFitRule {
  id: string;
  service_id: string;
  home_feature_key: string;              // e.g. 'home_type', 'has_ductwork', 'year_built'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: string;                         // JSON-encoded comparison value
  fail_message: string;                  // Shown to homeowner when incompatible
  is_blocking: boolean;                  // true = incompatible, false = needs_review
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Contractor System
// ---------------------------------------------------------------------------

/** Extended profile for contractor users */
export interface ContractorProfile {
  id: string;                            // Same as user_profiles.id
  company_name: string;
  company_description: string | null;
  logo_url: string | null;
  website_url: string | null;
  license_number: string | null;
  license_state: string | null;
  license_expiry: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  bonded: boolean;
  years_in_business: number | null;
  employee_count: number | null;
  status: ContractorStatus;
  tier: ContractorTier;
  avg_rating: number | null;            // Cached average (1.0-5.0)
  total_reviews: number;
  total_jobs_completed: number;
  background_check_passed: boolean;
  background_check_date: string | null;
  onboarding_completed_at: string | null;
  stripe_account_id: string | null;     // Stripe Connect account
  stripe_onboarding_complete: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  user_profile?: UserProfile;
  trades?: ContractorTrade[];
  service_areas?: ContractorServiceArea[];
  availability?: ContractorAvailability[];
}

/** Which trades/departments a contractor is qualified for */
export interface ContractorTrade {
  id: string;
  contractor_id: string;
  department_id: string;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;

  // Joined
  department?: Department;
}

/** Zip codes a contractor serves */
export interface ContractorServiceArea {
  id: string;
  contractor_id: string;
  zip_code: string;
  is_active: boolean;
  created_at: string;
}

/** Contractor-specific pricing for a service (overrides catalog base_price) */
export interface ContractorServicePrice {
  id: string;
  contractor_id: string;
  service_id: string;
  base_price_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  service?: Service;
}

/** Weekly availability schedule */
export interface ContractorAvailability {
  id: string;
  contractor_id: string;
  day_of_week: DayOfWeek;
  start_time: string;                   // HH:MM format (24h)
  end_time: string;                     // HH:MM format (24h)
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

/** Specific date overrides (vacations, holidays, etc.) */
export interface ContractorDateOverride {
  id: string;
  contractor_id: string;
  date: string;                         // YYYY-MM-DD
  is_available: boolean;
  start_time: string | null;            // If available, custom hours
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Home Profiles
// ---------------------------------------------------------------------------

/** A homeowner's property */
export interface Home {
  id: string;
  homeowner_id: string;                 // user_profiles.id
  nickname: string | null;              // e.g. "Main House", "Rental Property"
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  ownership_type: HomeOwnershipType;
  year_built: number | null;
  square_footage: number | null;
  stories: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garage_spaces: number | null;
  lot_size_sqft: number | null;
  home_type: 'single_family' | 'townhouse' | 'condo' | 'apartment' | 'mobile_home' | 'other';
  is_primary: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  systems?: HomeSystem[];
  features?: HomeFeature[];
}

/** Major systems in a home: HVAC, water heater, electrical panel, etc. */
export interface HomeSystem {
  id: string;
  home_id: string;
  system_type: string;                  // e.g. 'hvac', 'water_heater', 'electrical_panel'
  brand: string | null;
  model: string | null;
  year_installed: number | null;
  fuel_type: string | null;             // e.g. 'electric', 'gas', 'propane'
  capacity: string | null;              // e.g. '3 ton', '50 gallon'
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  has_warranty: boolean;
  warranty_expiry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Boolean or key-value features of a home used for HomeFit evaluation */
export interface HomeFeature {
  id: string;
  home_id: string;
  feature_key: string;                  // e.g. 'has_ductwork', 'has_attic_access', 'foundation_type'
  feature_value: string;                // e.g. 'true', 'slab', 'pier_and_beam'
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Marketplace / Cart / Orders
// ---------------------------------------------------------------------------

/** An item in the homeowner's cart (pre-checkout) */
export interface CartItem {
  id: string;
  homeowner_id: string;
  home_id: string;
  service_id: string;
  contractor_id: string | null;         // null if platform-assigned
  selected_variables: Record<string, string | number | boolean>; // Variable slug -> chosen value
  selected_addon_ids: string[];
  quantity: number;
  unit_price_cents: number;             // Calculated total per unit (base + vars + addons)
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  service?: Service;
  contractor?: ContractorProfile;
  home?: Home;
}

/** A completed order (checkout creates this from cart items) */
export interface Order {
  id: string;
  order_number: string;                 // Human-readable: HW-20260212-XXXX
  homeowner_id: string;
  home_id: string;
  status: OrderStatus;
  subtotal_cents: number;               // Sum of all item totals
  platform_fee_cents: number;           // Platform fee charged to homeowner
  tax_cents: number;
  total_cents: number;                  // subtotal + platform_fee + tax
  payment_intent_id: string | null;     // Stripe PaymentIntent
  payment_method_id: string | null;
  paid_at: string | null;
  scheduled_date: string | null;        // YYYY-MM-DD
  scheduled_time_start: string | null;  // HH:MM
  scheduled_time_end: string | null;    // HH:MM
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  homeowner_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  homeowner?: UserProfile;
  home?: Home;
  items?: OrderItem[];
  transactions?: Transaction[];
  reviews?: Review[];
}

/** Individual line item within an order */
export interface OrderItem {
  id: string;
  order_id: string;
  service_id: string;
  contractor_id: string | null;
  status: OrderItemStatus;
  selected_variables: Record<string, string | number | boolean>;
  selected_addon_ids: string[];
  quantity: number;
  unit_price_cents: number;
  total_cents: number;                  // unit_price * quantity
  contractor_payout_cents: number | null;
  platform_fee_cents: number | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  completed_at: string | null;
  contractor_notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  service?: Service;
  contractor?: ContractorProfile;
  order?: Order;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** 5-dimension review left by a homeowner after order completion */
export interface Review {
  id: string;
  order_id: string;
  order_item_id: string | null;         // null = review for entire order
  homeowner_id: string;
  contractor_id: string;
  service_id: string;
  overall_rating: number;               // 1-5
  quality_rating: number;               // 1-5
  punctuality_rating: number;           // 1-5
  communication_rating: number;         // 1-5
  value_rating: number;                 // 1-5
  title: string | null;
  body: string | null;
  photos: string[];                     // Array of photo URLs
  is_verified_purchase: boolean;
  is_published: boolean;
  contractor_response: string | null;
  contractor_responded_at: string | null;
  flagged: boolean;
  flagged_reason: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  homeowner?: UserProfile;
  contractor?: ContractorProfile;
  service?: Service;
  order?: Order;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Financial transaction record */
export interface Transaction {
  id: string;
  order_id: string;
  order_item_id: string | null;
  type: TransactionType;
  status: TransactionStatus;
  amount_cents: number;                 // Always positive; type indicates direction
  currency: string;                     // 'usd'
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  order?: Order;
}

/** Contractor payout record (aggregated from transactions) */
export interface Payout {
  id: string;
  contractor_id: string;
  status: PayoutStatus;
  amount_cents: number;
  currency: string;
  stripe_payout_id: string | null;
  period_start: string;                 // Start of payout period
  period_end: string;                   // End of payout period
  order_item_ids: string[];             // Which order items are included
  processed_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  contractor?: ContractorProfile;
}

// ---------------------------------------------------------------------------
// Markets & Geography
// ---------------------------------------------------------------------------

/** A metro market area (e.g. DFW, Houston, Austin) */
export interface Market {
  id: string;
  name: string;                         // e.g. "Dallas-Fort Worth"
  slug: string;                         // e.g. "dfw"
  state: string;
  status: MarketStatus;
  launch_date: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_miles: number;                 // Approximate market radius
  created_at: string;
  updated_at: string;
}

/** Zip codes belonging to a market */
export interface MarketZipCode {
  id: string;
  market_id: string;
  zip_code: string;
  city: string;
  county: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;

  // Joined
  market?: Market;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown> | null; // Contextual data (order_id, etc.)
  read_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;

  // Joined
  user?: UserProfile;
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export interface ActivityLog {
  id: string;
  actor_id: string;                     // user_profiles.id of who performed the action
  actor_role: UserRole;
  entity_type: string;                  // e.g. 'order', 'contractor_profile', 'service'
  entity_id: string;
  action: string;                       // e.g. 'created', 'updated', 'status_changed'
  changes: Record<string, unknown> | null; // { field: { old: ..., new: ... } }
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API / Query Helpers
// ---------------------------------------------------------------------------

/** Standard paginated response shape */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** Standard API error shape */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Standard API response wrapper */
export type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: ApiError;
};

/** Filter parameters for service search */
export interface ServiceSearchParams {
  query?: string;
  department_id?: string;
  category_id?: string;
  productizability?: ProductizabilityType[];
  zip_code?: string;
  min_price_cents?: number;
  max_price_cents?: number;
  is_featured?: boolean;
  page?: number;
  per_page?: number;
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'popular' | 'newest';
}

/** Filter parameters for contractor search */
export interface ContractorSearchParams {
  query?: string;
  department_id?: string;
  zip_code?: string;
  min_rating?: number;
  tier?: ContractorTier;
  has_availability?: boolean;
  page?: number;
  per_page?: number;
  sort_by?: 'rating' | 'reviews' | 'price_asc' | 'price_desc' | 'nearest';
}

/** Filter parameters for order search */
export interface OrderSearchParams {
  homeowner_id?: string;
  contractor_id?: string;
  status?: OrderStatus[];
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: 'newest' | 'oldest' | 'total_asc' | 'total_desc';
}

// ---------------------------------------------------------------------------
// Property Data (Rentcast enrichment)
// ---------------------------------------------------------------------------

export type TaxAssessment = {
  year: number;
  totalValue: number;
  landValue?: number;
  improvements?: number;
};

export type TaxHistory = {
  year: number;
  amount: number;
  rate?: number;
};

export interface PropertyData {
  rentcastId?: string;
  propertyType?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  yearBuilt?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  lotSizeSqft?: number;
  stories?: number;
  buildingStyle?: string;
  constructionType?: string;
  foundationType?: string;
  garageSpaces?: number;
  garageType?: string;
  pool?: boolean;
  fireplace?: boolean;
  basement?: boolean;
  basementSqft?: number;
  attic?: boolean;
  coolingType?: string;
  heatingType?: string;
  heatingFuel?: string;
  roofType?: string;
  windowType?: string;
  sidingType?: string;
  assessorId?: string;
  taxAssessedValue?: number;
  taxAssessedYear?: number;
  taxAnnualAmount?: number;
  taxRateArea?: string;
  taxAssessments?: TaxAssessment[];
  taxHistory?: TaxHistory[];
  lastSaleDate?: string;
  lastSalePrice?: number;
  priorSaleDate?: string;
  priorSalePrice?: number;
  ownerName?: string;
  ownerType?: string;
  ownerOccupied?: boolean;
  ownerMailingAddress?: string;
  ownerMailingCity?: string;
  ownerMailingState?: string;
  ownerMailingZip?: string;
  legalDescription?: string;
  parcelNumber?: string;
  apn?: string;
  subdivision?: string;
  zoning?: string;
  estimatedValue?: number;
  estimatedRent?: number;
  features?: Record<string, unknown>;
  source: 'api' | 'mock';
}

// ---------------------------------------------------------------------------
// Consumer Flow Types (conversational AI marketplace)
// ---------------------------------------------------------------------------

export type FlowStep =
  | 'home'
  | 'address'
  | 'loading'
  | 'agent'
  | 'pricing'
  | 'pros'
  | 'addons'
  | 'scheduling'
  | 'checkout'
  | 'confirmation';

export interface HomeData {
  address: string;
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  sqft: number | null;
  yearBuilt: number | null;
  beds: number | null;
  baths: number | null;
  lotSizeSqft: number | null;
  stories: number | null;
  satelliteUrl?: string;
}

export interface EquipmentData {
  method: 'photo' | 'manual' | 'skipped';
  brand?: string;
  model?: string;
  serial?: string;
  tonnage?: number;
  estimatedAge?: number;
  seer?: number;
  warrantyStatus?: WarrantyInfo;
  photoUrl?: string;
}

export interface WarrantyInfo {
  hasWarranty: boolean;
  compressorExpires?: string;
  partsExpires?: string;
  laborExpires?: string;
  message?: string;
}

export type TriageIntent =
  | 'ac_replacement'
  | 'ac_repair'
  | 'heating'
  | 'plumbing'
  | 'electrical'
  | 'general_maintenance'
  | 'emergency'
  | 'unknown';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';

export type NextAction = 'ADDRESS' | 'PHOTO' | 'OPTIONS' | 'SCHEDULE' | 'HANDOFF';

// HVAC Pricing Flow Types
export type IntentReason = 'not_working' | 'old_inefficient' | 'exploring';
export type SystemUrgency = 'emergency' | 'struggling';
export type EstimatedAge = '5-10' | '10-15' | '15+' | 'unknown';
export type SystemScope = 'whole_system' | 'ac_only' | 'heating_only' | 'unsure';
export type SizingMethod = 'photo' | 'questions';
export type ThermostatCount = 1 | 2 | 3;
export type TargetZone = 'upstairs' | 'downstairs' | 'both';
export type ZoneSqft = '<1000' | '1000-1500' | '1500-2000' | '2000+' | 'unknown';
export type IndoorUnitLocation = 'attic' | 'closet' | 'garage' | 'basement' | 'unknown';
export type HeatSource = 'gas' | 'electric' | 'heat_pump';

export interface HVACFlowData {
  intentReason: IntentReason | null;
  systemUrgency: SystemUrgency | null;
  estimatedAge: EstimatedAge | null;
  scope: SystemScope | null;
  sizingMethod: SizingMethod | null;
  photoData: {
    brand: string | null;
    modelNumber: string | null;
    serialNumber: string | null;
    tonnage: number | null;
    seerRating: number | null;
    manufactureYear: number | null;
  } | null;
  questionsData: {
    thermostatCount: ThermostatCount | null;
    targetZone: TargetZone | null;
    zoneSqft: ZoneSqft | null;
    comfortIssues: boolean | null;
    indoorUnitLocation: IndoorUnitLocation | null;
    estimatedTonnage: number | null;
  } | null;
  heatSource: HeatSource | null;
  propertyData: {
    sqft: number | null;
    yearBuilt: number | null;
    beds: number | null;
    baths: number | null;
  } | null;
  finalTonnage: number | null;
  tonnageSource: 'photo' | 'questions' | 'property' | null;
}

export interface DiscoveryData {
  intent: TriageIntent | null;
  urgency: UrgencyLevel | null;
  problemSummary: string | null;
  needsAddress: boolean;
  nextAction: NextAction | null;
  equipment: EquipmentData | null;
  sizing: {
    confirmed: boolean;
    tonnage: number;
    source: 'photo' | 'calculated' | 'manual';
  };
  comfort: {
    tempBalance: 'even' | 'some_issues' | 'significant' | null;
    allergies: boolean | null;
  };
  hvacFlow: HVACFlowData | null;
}

export type TierLevel = 'good' | 'better' | 'best';

export interface PricingOption {
  id: string;
  tier: TierLevel;
  productLine: string;
  brand: string;
  seer: number;
  stages: 'single' | 'two' | 'variable';
  priceRange: { min: number; max: number };
  features: string[];
  recommended?: boolean;
  bestFor?: string[];
}

export interface ProOption {
  id: string;
  name: string;
  logo?: string;
  rating: number;
  reviewCount: number;
  established: number;
  installCount: number;
  price: number;
  laborWarrantyYears: number;
  includedExtras: string[];
  nextAvailable: Date;
  badges: string[];
}

export interface FlowAddon {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  recurring?: boolean;
  recurringInterval?: 'monthly' | 'yearly';
  recommended?: boolean;
  includedFree?: boolean;
  category: 'thermostat' | 'maintenance' | 'iaq' | 'warranty' | 'other';
}

export interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
  rushFee?: number;
}

export interface ChatButton {
  label: string;
  value: string;
  emoji?: string;
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  buttons?: ChatButton[];
  isLoading?: boolean;
  source?: 'intro' | 'agent';
  showAddressInput?: boolean;
}

// Conversation message types
export type MessageType =
  | 'text'
  | 'chips'
  | 'address-input'
  | 'property-reveal'
  | 'auth-prompt'
  | 'pricing-options'
  | 'pro-options'
  | 'addon-options'
  | 'schedule-picker'
  | 'checkout-summary'
  | 'loading';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChipButton {
  label: string;
  value: string;
  icon?: string;
}
