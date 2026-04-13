// Daily PWA Database Types (from Daily+)

export type UserRole = 'creditor' | 'collector' | 'recovery_agent' | 'debtor';
export type LoanStatus = 'pending_approval' | 'approved' | 'active' | 'completed' | 'overdue' | 'defaulted' | 'rejected';
export type CollectionStatus = 'pending' | 'collected' | 'missed' | 'partial' | 'deferred';
export type PaymentMethod = 'cash' | 'transfer' | 'mobile_money' | 'recovery_collection';

// Users table
export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Creditor specific settings
export interface CreditorSettings {
  id: string;
  user_id: string | null;
  business_name: string | null;
  default_interest_rate: number;
  default_loan_tenure: number;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// Collectors assigned to creditors
export interface Collector {
  id: string;
  user_id: string | null;
  creditor_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  alternate_phone: string | null;
  address: string | null;
  notes: string | null;
  employee_code: string | null;
  photo_url: string | null;
  invite_email: string | null;
  invite_status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  onboarding_completed_at: string | null;
  is_active: boolean;
  assigned_routes: string[];
  created_at: string;
  updated_at: string;
}

// Debtors (loan recipients)
export interface Debtor {
  id: string;
  user_id: string | null;
  creditor_id: string;
  collector_id: string | null;
  requested_by_collector_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  address: string | null;
  id_number: string | null;
  id_photo_front_url: string | null;
  id_photo_back_url: string | null;
  debtor_photo_url: string | null;
  signature_url: string | null;
  route_id: string | null;
  credit_score: number | null;
  notes: string | null;
  approval_status: string | null;
  approval_requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  approval_note: string | null;
  portal_email: string | null;
  invite_status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  onboarding_completed_at: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Routes for organizing collections
export interface Route {
  id: string;
  creditor_id: string;
  collector_id: string | null;
  name: string;
  description: string | null;
  area: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Loans
export interface Loan {
  id: string;
  creditor_id: string;
  debtor_id: string;
  collector_id: string | null;
  requested_by_collector_id: string | null;
  loan_number: string;
  principal_amount: number;
  interest_rate: number;
  interest_amount: number;
  total_amount: number;
  daily_installment: number;
  tenure_days: number;
  start_date: string;
  end_date: string;
  status: LoanStatus;
  amount_collected: number;
  amount_remaining: number;
  missed_payments: number;
  recovery_agent_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_note: string | null;
  disbursed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Daily Collections
export interface Collection {
  id: string;
  loan_id: string;
  collector_id: string;
  creditor_id: string;
  debtor_id: string;
  amount_due: number;
  amount_collected: number;
  collection_date: string;
  status: CollectionStatus;
  payment_method: PaymentMethod | null;
  receipt_number: string | null;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
}

// Daily Collection Summary
export interface DailyCollectionSummary {
  id: string;
  creditor_id: string;
  collector_id: string | null;
  date: string;
  total_expected: number;
  total_collected: number;
  total_missed: number;
  collections_count: number;
  collected_count: number;
  missed_count: number;
  partial_count: number;
  created_at: string;
  updated_at: string;
}

// Settlements (EOD Cash Handover)
export interface Settlement {
  id: string;
  creditor_id: string;
  collector_id: string;
  settlement_date: string;
  expected_amount: number;
  actual_amount: number;
  difference_amount: number;
  status: 'pending' | 'verified' | 'disputed';
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Dashboard Stats Types
export interface DashboardStats {
  totalLoans: number;
  activeLoans: number;
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectorsCount: number;
  debtorsCount: number;
  todayExpected: number;
  todayCollected: number;
  collectionRate: number;
  overdueLoans: number;
}

export interface CollectorPerformance {
  collectorId: string;
  collectorName: string;
  totalAssigned: number;
  totalCollected: number;
  collectionRate: number;
  missedPayments: number;
  activeLoans: number;
}

export interface LoanSummary {
  id: string;
  loanNumber: string;
  debtorName: string;
  principalAmount: number;
  amountRemaining: number;
  dailyInstallment: number;
  status: LoanStatus;
  daysRemaining: number;
  missedPayments: number;
}
