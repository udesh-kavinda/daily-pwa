import { create } from "zustand";
import type { Loan, Collection, Debtor, DashboardStats } from "@/types/database";

interface DashboardState {
  loans: Loan[];
  collections: Collection[];
  debtors: Debtor[];
  stats: DashboardStats | null;
  isLoading: boolean;
  selectedDateRange: "today" | "week" | "month" | "year";
  
  setLoans: (loans: Loan[]) => void;
  setCollections: (collections: Collection[]) => void;
  setDebtors: (debtors: Debtor[]) => void;
  setStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setDateRange: (range: "today" | "week" | "month" | "year") => void;
  
  addLoan: (loan: Loan) => void;
  addCollection: (collection: Collection) => void;
  updateLoan: (loanId: string, updates: Partial<Loan>) => void;
  clear: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  loans: [],
  collections: [],
  debtors: [],
  stats: null,
  isLoading: true,
  selectedDateRange: "today",
  
  setLoans: (loans) => set({ loans }),
  setCollections: (collections) => set({ collections }),
  setDebtors: (debtors) => set({ debtors }),
  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setDateRange: (selectedDateRange) => set({ selectedDateRange }),
  
  addLoan: (loan) => set((state) => ({ loans: [loan, ...state.loans] })),
  addCollection: (collection) => set((state) => ({ collections: [collection, ...state.collections] })),
  updateLoan: (loanId, updates) => set((state) => ({
    loans: state.loans.map((loan) => (loan.id === loanId ? { ...loan, ...updates } : loan)),
  })),
  clear: () => set({
    loans: [],
    collections: [],
    debtors: [],
    stats: null,
    isLoading: true,
    selectedDateRange: "today",
  }),
}));
