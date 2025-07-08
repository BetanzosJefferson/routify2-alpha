// BACKUP COMPLETO del archivo original db-storage.ts
// Creado el 2025-07-08 antes de implementar solución basada en plantillas
// Este archivo contiene toda la lógica original para rollback si es necesario

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, inArray, isNull, isNotNull, desc, gte, lte, and, or, like, ilike } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { IStorage } from './storage';
import type { 
  User, 
  InsertUser, 
  Route, 
  InsertRoute, 
  Trip, 
  InsertTrip, 
  Reservation, 
  InsertReservation,
  Passenger,
  InsertPassenger,
  Package,
  InsertPackage,
  Transaction,
  InsertTransaction,
  ReservationRequest,
  InsertReservationRequest,
  UserCompany,
  InsertUserCompany,
  Company,
  InsertCompany,
  Vehicle,
  InsertVehicle,
  Driver,
  InsertDriver,
  RouteTemplate,
  InsertRouteTemplate,
  TripBudget,
  InsertTripBudget,
  TripExpense,
  InsertTripExpense,
  CashRegister,
  InsertCashRegister,
  CashBoxTransaction,
  InsertCashBoxTransaction,
  CashboxCutoff,
  InsertCashboxCutoff,
  TripTemplate,
  InsertTripTemplate,
  Notification,
  InsertNotification
} from '@shared/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Export the database instance for use in other files
export { db };

export class DatabaseStorage implements IStorage {
  
  // User methods
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(schema.users).values(user).returning();
    return newUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(schema.users)
      .set(userUpdate)
      .where(eq(schema.users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(schema.users).where(eq(schema.users.id, id));
    return result.count > 0;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  // Route methods
  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(schema.routes).values(route).returning();
    return newRoute;
  }

  async getRouteById(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }

  async updateRoute(id: number, routeUpdate: Partial<Route>): Promise<Route | undefined> {
    const [updatedRoute] = await db
      .update(schema.routes)
      .set(routeUpdate)
      .where(eq(schema.routes.id, id))
      .returning();
    return updatedRoute;
  }

  async deleteRoute(id: number): Promise<boolean> {
    const result = await db.delete(schema.routes).where(eq(schema.routes.id, id));
    return result.count > 0;
  }

  async getRoutes(): Promise<Route[]> {
    return await db.select().from(schema.routes);
  }

  // Trip methods
  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [newTrip] = await db.insert(schema.trips).values(trip).returning();
    return newTrip;
  }

  async getTripById(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
    return trip;
  }

  async updateTrip(id: number, tripUpdate: Partial<Trip>): Promise<Trip | undefined> {
    const [updatedTrip] = await db
      .update(schema.trips)
      .set(tripUpdate)
      .where(eq(schema.trips.id, id))
      .returning();
    return updatedTrip;
  }

  async deleteTrip(id: number): Promise<boolean> {
    const result = await db.delete(schema.trips).where(eq(schema.trips.id, id));
    return result.count > 0;
  }

  async getTrips(): Promise<Trip[]> {
    return await db.select().from(schema.trips);
  }

  // Reservation methods
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [newReservation] = await db.insert(schema.reservations).values(reservation).returning();
    return newReservation;
  }

  async getReservationById(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
    return reservation;
  }

  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    const [updatedReservation] = await db
      .update(schema.reservations)
      .set(reservationUpdate)
      .where(eq(schema.reservations.id, id))
      .returning();
    return updatedReservation;
  }

  async deleteReservation(id: number): Promise<boolean> {
    const result = await db.delete(schema.reservations).where(eq(schema.reservations.id, id));
    return result.count > 0;
  }

  async getReservations(): Promise<Reservation[]> {
    return await db.select().from(schema.reservations);
  }

  // Passenger methods
  async createPassenger(passenger: InsertPassenger): Promise<Passenger> {
    const [newPassenger] = await db.insert(schema.passengers).values(passenger).returning();
    return newPassenger;
  }

  async getPassengerById(id: number): Promise<Passenger | undefined> {
    const [passenger] = await db.select().from(schema.passengers).where(eq(schema.passengers.id, id));
    return passenger;
  }

  async updatePassenger(id: number, passengerUpdate: Partial<Passenger>): Promise<Passenger | undefined> {
    const [updatedPassenger] = await db
      .update(schema.passengers)
      .set(passengerUpdate)
      .where(eq(schema.passengers.id, id))
      .returning();
    return updatedPassenger;
  }

  async deletePassenger(id: number): Promise<boolean> {
    const result = await db.delete(schema.passengers).where(eq(schema.passengers.id, id));
    return result.count > 0;
  }

  async getPassengers(): Promise<Passenger[]> {
    return await db.select().from(schema.passengers);
  }

  // Package methods
  async createPackage(packageData: InsertPackage): Promise<Package> {
    const [newPackage] = await db.insert(schema.packages).values(packageData).returning();
    return newPackage;
  }

  async getPackageById(id: number): Promise<Package | undefined> {
    const [packageData] = await db.select().from(schema.packages).where(eq(schema.packages.id, id));
    return packageData;
  }

  async updatePackage(id: number, packageUpdate: Partial<Package>): Promise<Package | undefined> {
    const [updatedPackage] = await db
      .update(schema.packages)
      .set(packageUpdate)
      .where(eq(schema.packages.id, id))
      .returning();
    return updatedPackage;
  }

  async deletePackage(id: number): Promise<boolean> {
    const result = await db.delete(schema.packages).where(eq(schema.packages.id, id));
    return result.count > 0;
  }

  async getPackages(): Promise<Package[]> {
    return await db.select().from(schema.packages);
  }

  // Transaction methods
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(schema.transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id));
    return transaction;
  }

  async updateTransaction(id: number, transactionUpdate: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updatedTransaction] = await db
      .update(schema.transactions)
      .set(transactionUpdate)
      .where(eq(schema.transactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
    return result.count > 0;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(schema.transactions);
  }

  // Reservation Request methods
  async createReservationRequest(reservationRequest: InsertReservationRequest): Promise<ReservationRequest> {
    const [newReservationRequest] = await db.insert(schema.reservationRequests).values(reservationRequest).returning();
    return newReservationRequest;
  }

  async getReservationRequestById(id: number): Promise<ReservationRequest | undefined> {
    const [reservationRequest] = await db.select().from(schema.reservationRequests).where(eq(schema.reservationRequests.id, id));
    return reservationRequest;
  }

  async updateReservationRequest(id: number, reservationRequestUpdate: Partial<ReservationRequest>): Promise<ReservationRequest | undefined> {
    const [updatedReservationRequest] = await db
      .update(schema.reservationRequests)
      .set(reservationRequestUpdate)
      .where(eq(schema.reservationRequests.id, id))
      .returning();
    return updatedReservationRequest;
  }

  async deleteReservationRequest(id: number): Promise<boolean> {
    const result = await db.delete(schema.reservationRequests).where(eq(schema.reservationRequests.id, id));
    return result.count > 0;
  }

  async getReservationRequests(): Promise<ReservationRequest[]> {
    return await db.select().from(schema.reservationRequests);
  }

  // UserCompany methods
  async createUserCompany(userCompany: InsertUserCompany): Promise<UserCompany> {
    const [newUserCompany] = await db.insert(schema.userCompanies).values(userCompany).returning();
    return newUserCompany;
  }

  async getUserCompanyById(id: number): Promise<UserCompany | undefined> {
    const [userCompany] = await db.select().from(schema.userCompanies).where(eq(schema.userCompanies.id, id));
    return userCompany;
  }

  async updateUserCompany(id: number, userCompanyUpdate: Partial<UserCompany>): Promise<UserCompany | undefined> {
    const [updatedUserCompany] = await db
      .update(schema.userCompanies)
      .set(userCompanyUpdate)
      .where(eq(schema.userCompanies.id, id))
      .returning();
    return updatedUserCompany;
  }

  async deleteUserCompany(id: number): Promise<boolean> {
    const result = await db.delete(schema.userCompanies).where(eq(schema.userCompanies.id, id));
    return result.count > 0;
  }

  async getUserCompanies(): Promise<UserCompany[]> {
    return await db.select().from(schema.userCompanies);
  }

  // Company methods
  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(schema.companies).values(company).returning();
    return newCompany;
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    return company;
  }

  async updateCompany(id: string, companyUpdate: Partial<Company>): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(schema.companies)
      .set(companyUpdate)
      .where(eq(schema.companies.id, id))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(schema.companies).where(eq(schema.companies.id, id));
    return result.count > 0;
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(schema.companies);
  }

  // Vehicle methods
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(schema.vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async getVehicleById(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id));
    return vehicle;
  }

  async updateVehicle(id: number, vehicleUpdate: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await db
      .update(schema.vehicles)
      .set(vehicleUpdate)
      .where(eq(schema.vehicles.id, id))
      .returning();
    return updatedVehicle;
  }

  async deleteVehicle(id: number): Promise<boolean> {
    const result = await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
    return result.count > 0;
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(schema.vehicles);
  }

  // Driver methods
  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [newDriver] = await db.insert(schema.drivers).values(driver).returning();
    return newDriver;
  }

  async getDriverById(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(schema.drivers).where(eq(schema.drivers.id, id));
    return driver;
  }

  async updateDriver(id: number, driverUpdate: Partial<Driver>): Promise<Driver | undefined> {
    const [updatedDriver] = await db
      .update(schema.drivers)
      .set(driverUpdate)
      .where(eq(schema.drivers.id, id))
      .returning();
    return updatedDriver;
  }

  async deleteDriver(id: number): Promise<boolean> {
    const result = await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
    return result.count > 0;
  }

  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(schema.drivers);
  }

  // Route Template methods
  async createRouteTemplate(routeTemplate: InsertRouteTemplate): Promise<RouteTemplate> {
    const [newRouteTemplate] = await db.insert(schema.routeTemplates).values(routeTemplate).returning();
    return newRouteTemplate;
  }

  async getRouteTemplateById(id: number): Promise<RouteTemplate | undefined> {
    const [routeTemplate] = await db.select().from(schema.routeTemplates).where(eq(schema.routeTemplates.id, id));
    return routeTemplate;
  }

  async updateRouteTemplate(id: number, routeTemplateUpdate: Partial<RouteTemplate>): Promise<RouteTemplate | undefined> {
    const [updatedRouteTemplate] = await db
      .update(schema.routeTemplates)
      .set(routeTemplateUpdate)
      .where(eq(schema.routeTemplates.id, id))
      .returning();
    return updatedRouteTemplate;
  }

  async deleteRouteTemplate(id: number): Promise<boolean> {
    const result = await db.delete(schema.routeTemplates).where(eq(schema.routeTemplates.id, id));
    return result.count > 0;
  }

  async getRouteTemplates(): Promise<RouteTemplate[]> {
    return await db.select().from(schema.routeTemplates);
  }

  // Trip Budget methods
  async createTripBudget(tripBudget: InsertTripBudget): Promise<TripBudget> {
    const [newTripBudget] = await db.insert(schema.tripBudgets).values(tripBudget).returning();
    return newTripBudget;
  }

  async getTripBudgetById(id: number): Promise<TripBudget | undefined> {
    const [tripBudget] = await db.select().from(schema.tripBudgets).where(eq(schema.tripBudgets.id, id));
    return tripBudget;
  }

  async updateTripBudget(id: number, tripBudgetUpdate: Partial<TripBudget>): Promise<TripBudget | undefined> {
    const [updatedTripBudget] = await db
      .update(schema.tripBudgets)
      .set(tripBudgetUpdate)
      .where(eq(schema.tripBudgets.id, id))
      .returning();
    return updatedTripBudget;
  }

  async deleteTripBudget(id: number): Promise<boolean> {
    const result = await db.delete(schema.tripBudgets).where(eq(schema.tripBudgets.id, id));
    return result.count > 0;
  }

  async getTripBudgets(): Promise<TripBudget[]> {
    return await db.select().from(schema.tripBudgets);
  }

  // Trip Expense methods
  async createTripExpense(tripExpense: InsertTripExpense): Promise<TripExpense> {
    const [newTripExpense] = await db.insert(schema.tripExpenses).values(tripExpense).returning();
    return newTripExpense;
  }

  async getTripExpenseById(id: number): Promise<TripExpense | undefined> {
    const [tripExpense] = await db.select().from(schema.tripExpenses).where(eq(schema.tripExpenses.id, id));
    return tripExpense;
  }

  async updateTripExpense(id: number, tripExpenseUpdate: Partial<TripExpense>): Promise<TripExpense | undefined> {
    const [updatedTripExpense] = await db
      .update(schema.tripExpenses)
      .set(tripExpenseUpdate)
      .where(eq(schema.tripExpenses.id, id))
      .returning();
    return updatedTripExpense;
  }

  async deleteTripExpense(id: number): Promise<boolean> {
    const result = await db.delete(schema.tripExpenses).where(eq(schema.tripExpenses.id, id));
    return result.count > 0;
  }

  async getTripExpenses(): Promise<TripExpense[]> {
    return await db.select().from(schema.tripExpenses);
  }

  // Cash Register methods
  async createCashRegister(cashRegister: InsertCashRegister): Promise<CashRegister> {
    const [newCashRegister] = await db.insert(schema.cashRegisters).values(cashRegister).returning();
    return newCashRegister;
  }

  async getCashRegisterById(id: number): Promise<CashRegister | undefined> {
    const [cashRegister] = await db.select().from(schema.cashRegisters).where(eq(schema.cashRegisters.id, id));
    return cashRegister;
  }

  async updateCashRegister(id: number, cashRegisterUpdate: Partial<CashRegister>): Promise<CashRegister | undefined> {
    const [updatedCashRegister] = await db
      .update(schema.cashRegisters)
      .set(cashRegisterUpdate)
      .where(eq(schema.cashRegisters.id, id))
      .returning();
    return updatedCashRegister;
  }

  async deleteCashRegister(id: number): Promise<boolean> {
    const result = await db.delete(schema.cashRegisters).where(eq(schema.cashRegisters.id, id));
    return result.count > 0;
  }

  async getCashRegisters(): Promise<CashRegister[]> {
    return await db.select().from(schema.cashRegisters);
  }

  // Cash Box Transaction methods
  async createCashBoxTransaction(cashBoxTransaction: InsertCashBoxTransaction): Promise<CashBoxTransaction> {
    const [newCashBoxTransaction] = await db.insert(schema.cashBoxTransactions).values(cashBoxTransaction).returning();
    return newCashBoxTransaction;
  }

  async getCashBoxTransactionById(id: number): Promise<CashBoxTransaction | undefined> {
    const [cashBoxTransaction] = await db.select().from(schema.cashBoxTransactions).where(eq(schema.cashBoxTransactions.id, id));
    return cashBoxTransaction;
  }

  async updateCashBoxTransaction(id: number, cashBoxTransactionUpdate: Partial<CashBoxTransaction>): Promise<CashBoxTransaction | undefined> {
    const [updatedCashBoxTransaction] = await db
      .update(schema.cashBoxTransactions)
      .set(cashBoxTransactionUpdate)
      .where(eq(schema.cashBoxTransactions.id, id))
      .returning();
    return updatedCashBoxTransaction;
  }

  async deleteCashBoxTransaction(id: number): Promise<boolean> {
    const result = await db.delete(schema.cashBoxTransactions).where(eq(schema.cashBoxTransactions.id, id));
    return result.count > 0;
  }

  async getCashBoxTransactions(): Promise<CashBoxTransaction[]> {
    return await db.select().from(schema.cashBoxTransactions);
  }

  // Cashbox Cutoff methods
  async createCashboxCutoff(cashboxCutoff: InsertCashboxCutoff): Promise<CashboxCutoff> {
    const [newCashboxCutoff] = await db.insert(schema.cashboxCutoffs).values(cashboxCutoff).returning();
    return newCashboxCutoff;
  }

  async getCashboxCutoffById(id: number): Promise<CashboxCutoff | undefined> {
    const [cashboxCutoff] = await db.select().from(schema.cashboxCutoffs).where(eq(schema.cashboxCutoffs.id, id));
    return cashboxCutoff;
  }

  async updateCashboxCutoff(id: number, cashboxCutoffUpdate: Partial<CashboxCutoff>): Promise<CashboxCutoff | undefined> {
    const [updatedCashboxCutoff] = await db
      .update(schema.cashboxCutoffs)
      .set(cashboxCutoffUpdate)
      .where(eq(schema.cashboxCutoffs.id, id))
      .returning();
    return updatedCashboxCutoff;
  }

  async deleteCashboxCutoff(id: number): Promise<boolean> {
    const result = await db.delete(schema.cashboxCutoffs).where(eq(schema.cashboxCutoffs.id, id));
    return result.count > 0;
  }

  async getCashboxCutoffs(): Promise<CashboxCutoff[]> {
    return await db.select().from(schema.cashboxCutoffs);
  }

  // Trip Template methods
  async createTripTemplate(tripTemplate: InsertTripTemplate): Promise<TripTemplate> {
    const [newTripTemplate] = await db.insert(schema.tripTemplates).values(tripTemplate).returning();
    return newTripTemplate;
  }

  async getTripTemplateById(id: number): Promise<TripTemplate | undefined> {
    const [tripTemplate] = await db.select().from(schema.tripTemplates).where(eq(schema.tripTemplates.id, id));
    return tripTemplate;
  }

  async updateTripTemplate(id: number, tripTemplateUpdate: Partial<TripTemplate>): Promise<TripTemplate | undefined> {
    const [updatedTripTemplate] = await db
      .update(schema.tripTemplates)
      .set(tripTemplateUpdate)
      .where(eq(schema.tripTemplates.id, id))
      .returning();
    return updatedTripTemplate;
  }

  async deleteTripTemplate(id: number): Promise<boolean> {
    const result = await db.delete(schema.tripTemplates).where(eq(schema.tripTemplates.id, id));
    return result.count > 0;
  }

  async getTripTemplates(): Promise<TripTemplate[]> {
    return await db.select().from(schema.tripTemplates);
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(schema.notifications).values(notification).returning();
    return newNotification;
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
    return notification;
  }

  async updateNotification(id: number, notificationUpdate: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db
      .update(schema.notifications)
      .set(notificationUpdate)
      .where(eq(schema.notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
    return result.count > 0;
  }

  async getNotifications(): Promise<Notification[]> {
    return await db.select().from(schema.notifications);
  }

  // Métodos especializados que requieren consultas más complejas
  async getRoutesByCompanyId(companyId: string): Promise<Route[]> {
    return await db.select().from(schema.routes).where(eq(schema.routes.companyId, companyId));
  }

  async getRouteTemplatesByCompanyId(companyId: string): Promise<RouteTemplate[]> {
    return await db.select().from(schema.routeTemplates).where(eq(schema.routeTemplates.companyId, companyId));
  }

  async getRouteTemplatesByRouteId(routeId: number): Promise<RouteTemplate[]> {
    return await db.select().from(schema.routeTemplates).where(eq(schema.routeTemplates.routeId, routeId));
  }

  async getTripsByCompanyId(companyId: string): Promise<Trip[]> {
    return await db.select().from(schema.trips).where(eq(schema.trips.companyId, companyId));
  }

  async getReservationsByTripId(tripId: number): Promise<Reservation[]> {
    return await db.select().from(schema.reservations).where(eq(schema.reservations.tripId, tripId));
  }

  async getPackagesByTripId(tripId: number): Promise<Package[]> {
    return await db.select().from(schema.packages).where(eq(schema.packages.tripId, tripId));
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return await db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId));
  }

  async getReservationRequestsByStatus(status: string): Promise<ReservationRequest[]> {
    return await db.select().from(schema.reservationRequests).where(eq(schema.reservationRequests.status, status));
  }

  async getUserCompaniesByUserId(userId: number): Promise<UserCompany[]> {
    return await db.select().from(schema.userCompanies).where(eq(schema.userCompanies.userId, userId));
  }

  async getVehiclesByCompanyId(companyId: string): Promise<Vehicle[]> {
    return await db.select().from(schema.vehicles).where(eq(schema.vehicles.companyId, companyId));
  }

  async getDriversByCompanyId(companyId: string): Promise<Driver[]> {
    return await db.select().from(schema.drivers).where(eq(schema.drivers.companyId, companyId));
  }

  async getTripBudgetsByTripId(tripId: number): Promise<TripBudget[]> {
    return await db.select().from(schema.tripBudgets).where(eq(schema.tripBudgets.tripId, tripId));
  }

  async getTripExpensesByTripId(tripId: number): Promise<TripExpense[]> {
    return await db.select().from(schema.tripExpenses).where(eq(schema.tripExpenses.tripId, tripId));
  }

  async getCashRegistersByUserId(userId: number): Promise<CashRegister[]> {
    return await db.select().from(schema.cashRegisters).where(eq(schema.cashRegisters.userId, userId));
  }

  async getCashBoxTransactionsByUserId(userId: number): Promise<CashBoxTransaction[]> {
    return await db.select().from(schema.cashBoxTransactions).where(eq(schema.cashBoxTransactions.userId, userId));
  }

  async getCashboxCutoffsByUserId(userId: number): Promise<CashboxCutoff[]> {
    return await db.select().from(schema.cashboxCutoffs).where(eq(schema.cashboxCutoffs.userId, userId));
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));
  }
}