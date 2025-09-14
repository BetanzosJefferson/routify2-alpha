/**
 * Centralized Query Key Factory
 * 
 * Estandariza todos los query keys para evitar fragmentación de cache
 * y asegurar que las invalidaciones funcionen correctamente.
 */

// Types for query parameters
interface ReservationsParams {
  tripId?: number;
  recordId?: string;
  includeRelated?: boolean;
  date?: string;
  archived?: boolean;
  parentTripFilter?: boolean;
  driverId?: number;
}

interface TripsParams {
  tripId?: number;
  routeId?: number;
  departureDate?: string;
  searchTerm?: string;
  date?: string;
  isSubTrip?: boolean;
}

interface PackagesParams {
  tripId?: number;
  recordId?: string;
  date?: string;
  userRole?: string;
}

/**
 * Query Key Factory - Estandariza formatos de keys
 * 
 * Patrón: [endpoint, params] - SIEMPRE consistente
 */
export const queryKeys = {
  // Auth
  auth: {
    user: () => ["/api/auth/user"] as const,
  },

  // Reservations - Unificado
  reservations: {
    all: () => ["/api/reservations"] as const,
    filtered: (params: ReservationsParams = {}) => ["/api/reservations", params] as const,
    byTrip: (recordId?: string, date?: string, userRole?: string) => 
      ["/api/reservations", { recordId, date, userRole }] as const,
  },

  // Trips - Estandarizado
  trips: {
    all: () => ["/api/trips"] as const,
    filtered: (params: TripsParams = {}) => ["/api/trips", params] as const,
    single: (tripId: number) => ["/api/trips", { tripId }] as const,
    budget: (tripId: number) => ["/api/trips", { tripId, resource: "budget" }] as const,
  },

  // Packages - Consistente
  packages: {
    all: () => ["/api/packages"] as const,
    byTrip: (params: PackagesParams = {}) => ["/api/packages", params] as const,
  },

  // Expenses
  expenses: {
    all: () => ["/api/expenses"] as const,
    byTrip: (tripId: number) => ["/api/expenses", { tripId }] as const,
  },

  // Notifications
  notifications: {
    all: () => ["/api/notifications"] as const,
    unreadCount: () => ["/api/notifications", { resource: "unread-count" }] as const,
  },

  // Routes
  routes: {
    all: () => ["/api/routes"] as const,
    templates: () => ["/api/route-templates"] as const,
  },

  // Users
  users: {
    all: () => ["/api/users"] as const,
  },

  // Companies
  companies: {
    all: () => ["/api/companies"] as const,
    forTransfer: () => ["/api/companies", { forTransfer: true }] as const,
  },

  // Transactions
  transactions: {
    all: () => ["/api/transactions"] as const,
    current: () => ["/api/transactions", { resource: "current" }] as const,
  },

  // Cutoffs
  cutoffs: {
    all: () => ["/api/cutoffs"] as const,
    single: (cutoffId: string) => ["/api/cutoffs", { cutoffId }] as const,
    pending: () => ["/api/cutoffs", { resource: "pending" }] as const,
    transactions: (cutoffId: string) => ["/api/cutoffs", { cutoffId, resource: "transactions" }] as const,
  },
} as const;

/**
 * Cache Invalidation Helpers
 * 
 * Funciones helper para invalidar cache de manera consistente
 */
export const invalidateQueries = {
  // Invalidar todas las reservations
  allReservations: () => ({ queryKey: queryKeys.reservations.all() }),
  
  // Invalidar reservations con parámetros específicos
  reservationsWithParams: (params: ReservationsParams) => ({ queryKey: queryKeys.reservations.filtered(params) }),
  
  // Invalidar todos los trips
  allTrips: () => ({ queryKey: queryKeys.trips.all() }),
  
  // Invalidar trips con parámetros específicos  
  tripsWithParams: (params: TripsParams) => ({ queryKey: queryKeys.trips.filtered(params) }),
  
  // Invalidar packages
  allPackages: () => ({ queryKey: queryKeys.packages.all() }),
  
  // Helper para invalidaciones múltiples comunes
  reservationsAndTrips: () => [
    { queryKey: queryKeys.reservations.all() },
    { queryKey: queryKeys.trips.all() }
  ],
};