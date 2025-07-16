import * as schema from "@shared/schema";
import { 
  Route, 
  InsertRoute, 
  Trip, 
  InsertTrip, 
  Reservation, 
  InsertReservation, 
  Passenger, 
  InsertPassenger,
  RouteWithSegments,
  TripWithRouteInfo,
  ReservationWithDetails,
  SegmentPrice,
  Vehicle,
  InsertVehicle,
  Commission,
  InsertCommission,
  User,
  Coupon,
  InsertCoupon,
  InsertNotification,
  Notification,
  ReservationRequest,
  TripBudget,
  InsertTripBudget,
  TripExpense,
  InsertTripExpense,
  // Referencias a caja registradora eliminadas
  BoxCutoff,
  InsertBoxCutoff,
} from "@shared/schema";

export interface IStorage {
  // Route methods
  getRoutes(companyId?: string): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: number, route: Partial<Route>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined>;

  // Route Template methods
  getRouteTemplates(companyId?: string): Promise<schema.RouteTemplate[]>;
  getRouteTemplate(id: number): Promise<schema.RouteTemplate | undefined>;
  createRouteTemplate(template: schema.InsertRouteTemplate): Promise<schema.RouteTemplate>;
  updateRouteTemplate(id: number, template: Partial<schema.RouteTemplate>): Promise<schema.RouteTemplate | undefined>;
  deleteRouteTemplate(id: number): Promise<boolean>;
  getRouteTemplateWithRoute(id: number): Promise<(schema.RouteTemplate & { route: Route }) | undefined>;

  // Presupuestos de operadores
  getTripBudget(tripId: number): Promise<TripBudget | undefined>;
  createTripBudget(budget: InsertTripBudget): Promise<TripBudget>;
  updateTripBudget(tripId: number, amount: number): Promise<TripBudget | undefined>;
  
  // Gastos de viaje
  getTripExpenses(tripId: number): Promise<TripExpense[]>;
  createTripExpense(expense: InsertTripExpense): Promise<TripExpense>;
  updateTripExpense(id: number, expense: Partial<TripExpense>): Promise<TripExpense | undefined>;
  deleteTripExpense(id: number): Promise<boolean>;
  
  // Sistema de Cajas y operaciones de caja han sido eliminados
  
  // Statistics methods
  getCouponUsageStatistics(companyId: string): Promise<{
    userId: number;
    userName: string;
    totalCouponsUsed: number;
    totalDiscountAmount: number;
    averageDiscountPerCoupon: number;
  }[]>;

  // Transaction History methods
  getTransactionHistory(params: {
    companyId: string;
    startDate?: string;
    endDate?: string;
    userId?: number;
    cutoffId?: number;
  }): Promise<{
    id: number;
    details: any;
    createdAt: string;
    cutoffId: number | null;
    cutoffStatus: 'pending' | 'completed';
    createdBy: {
      id: number;
      name: string;
    };
    type: 'reservation' | 'package';
    amount: number;
  }[]>;
  
  // Trip methods
  getTrips(companyId?: string): Promise<TripWithRouteInfo[]>;
  getTrip(id: number): Promise<Trip | undefined>;
  getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<Trip>): Promise<Trip | undefined>;
  deleteTrip(id: number): Promise<boolean>;
  getTripsInDateRange(startDate: string, endDate: string, companyId?: string): Promise<Trip[]>;
  searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    dateRange?: string[];
    seats?: number;
    companyId?: string | null;
    companyIds?: string[];
    driverId?: number;
    visibility?: string;
    includeAllVisibilities?: boolean;
    optimizedResponse?: boolean;
  }): Promise<TripWithRouteInfo[]>;
  searchTripsOptimized(params: {
    origin?: string;
    destination?: string;
    date?: string;
    dateRange?: string[];
    seats?: number;
    companyId?: string;
    companyIds?: string[];
    driverId?: number;
    visibility?: string;
    includeAllVisibilities?: boolean;
    optimizedResponse?: boolean;
  }): Promise<TripWithRouteInfo[]>;
  updateRelatedTripsAvailability(recordId: number, tripId: string, seatChange: number): Promise<void>;
  cancelReservationsByTripId(tripId: number): Promise<{ cancelledCount: number; errors: string[] }>;
  
  // Reservation methods
  getReservations(filters?: { 
    companyId?: string; 
    currentUserId?: number; 
    userRole?: string; 
    createdBy?: number; 
  }): Promise<ReservationWithDetails[]>;
  getReservationsOptimized(companyId?: string, currentUserId?: number, userRole?: string): Promise<ReservationWithDetails[]>;
  getReservation(id: number): Promise<Reservation | undefined>;
  getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, reservation: Partial<Reservation>): Promise<Reservation | undefined>;
  deleteReservation(id: number): Promise<boolean>;
  getPaidReservationsByUser(userId: number): Promise<ReservationWithDetails[]>;
  getPaidReservationsByCompany(companyId: string): Promise<ReservationWithDetails[]>;
  
  // Passenger methods
  getPassengers(reservationId: number): Promise<Passenger[]>;
  createPassenger(passenger: InsertPassenger): Promise<Passenger>;
  deletePassengersByReservation(reservationId: number): Promise<boolean>;
  
  // Vehicle methods
  getVehicles(companyId?: string): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  
  // Commission methods
  getCommissions(companyId?: string): Promise<Commission[]>;
  getCommission(id: number): Promise<Commission | undefined>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: number, commission: Partial<Commission>): Promise<Commission | undefined>;
  deleteCommission(id: number): Promise<boolean>;
  
  // User methods
  getUsers(): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserCompanies(userId: number): Promise<schema.UserCompany[]>;
  updateUser(id: number, userData: { 
    email?: string; 
    password?: string; 
    commissionPercentage?: number; 
  }): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Reservation Requests methods (new)
  createReservationRequest(requestData: any): Promise<ReservationRequest>;
  getReservationRequests(filters?: { 
    companyId?: string, 
    status?: string,
    requesterId?: number 
  }): Promise<any[]>;
  getReservationRequest(id: number): Promise<any>;
  updateReservationRequestStatus(
    id: number, 
    status: string, 
    reviewedBy: number, 
    reviewNotes?: string
  ): Promise<ReservationRequest>;
  
  // Notification methods (new)
  createNotification(notificationData: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  
  // Transferencia de pasajeros
  checkReservationTransferPermission(reservationId: number, userId: number): Promise<boolean>;
  
  // Pagos de comisiones
  markCommissionsAsPaid(reservationIds: number[]): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }>;
  
  // Cupones methods
  getCoupons(companyId?: string): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;
  incrementCouponUsage(id: number): Promise<Coupon | undefined>;
  verifyCouponValidity(code: string): Promise<{
    valid: boolean;
    coupon?: Coupon;
    message?: string;
  }>;
  
  // Package methods
  getPackages(filters?: { companyId?: string, tripId?: number }): Promise<schema.Package[]>;
  getPackage(id: number): Promise<schema.Package | undefined>;
  getPackageWithTripInfo(id: number): Promise<schema.Package & { trip?: TripWithRouteInfo } | undefined>;
  getPackagesWithTripInfo(filters?: { 
    companyId?: string; 
    companyIds?: string[]; 
    tripId?: number; 
    tripIds?: number[] 
  }, currentUserId?: number, userRole?: string): Promise<any[]>;
  createPackage(packageData: schema.InsertPackage): Promise<schema.Package>;
  updatePackage(id: number, packageData: Partial<schema.Package>): Promise<schema.Package | undefined>;
  deletePackage(id: number): Promise<boolean>;
  
  // Company methods
  getCompanyById(companyId: string): Promise<{id: string, name: string} | null>;
  
  // Transacciones methods
  createTransaccion(transaccionData: schema.InsertTransaccion): Promise<schema.Transaccion>;
  getTransacciones(filters?: { usuario_id?: number, id_corte?: number }): Promise<schema.Transaccion[]>;
  getTransactionsByCompanyExcludingUser(companyId: string, excludeUserId: number): Promise<schema.Transaccion[]>;
  updateTransaccion(id: number, data: Partial<schema.Transaccion>, userId?: number): Promise<schema.Transaccion | undefined>;
  deleteTransaccion(id: number): Promise<boolean>;
  getTransaccionesByReservation(reservationId: number): Promise<schema.Transaccion[]>;
  getTransaccionesByPackageId(packageId: number): Promise<schema.Transaccion[]>;
  
  // Cajas de usuarios methods
  getUserCashBoxes(currentUserId: number, companyId: string): Promise<any[]>;
  
  // Box cutoff methods
  createBoxCutoff(cutoffData: schema.InsertBoxCutoff): Promise<schema.BoxCutoff>;
  
  // Statistics methods
  getCouponUsageStatistics(companyId: string, startDate?: string, endDate?: string): Promise<{
    userId: number;
    userName: string;
    totalCouponsUsed: number;
    totalDiscountAmount: number;
    averageDiscountPerCoupon: number;
  }[]>;
  
  getPopularRoutesStatistics(companyId: string, startDate?: string, endDate?: string): Promise<{
    origin: string;
    destination: string;
    totalReservations: number;
    totalRevenue: number;
    averageRevenuePerReservation: number;
  }[]>;
  
  getPassengerIntakeStatistics(companyId: string, startDate?: string, endDate?: string): Promise<{
    userId: number;
    userName: string;
    totalReservationsCreated: number;
    totalPassengersAdded: number;
    totalRevenueGenerated: number;
    averageRevenuePerReservation: number;
  }[]>;
}

// Importamos la clase DatabaseStorage desde el archivo separado
import { DatabaseStorage } from "./db-storage";

// Usamos la versión de almacenamiento en base de datos para implementar la funcionalidad
export const storage = new DatabaseStorage();
