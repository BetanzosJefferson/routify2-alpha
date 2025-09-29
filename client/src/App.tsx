import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, initializeCrossTabCache, cleanupCrossTabCache } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/lib/theme-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { DataLoaderProvider } from "@/hooks/use-data-loader";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary";
// import "@/lib/error-handler"; // Inicializar el manejador de errores global - TEMPORARILY DISABLED
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import PassengerListPage from "@/pages/passenger-list-page";
import ReservationDetails from "@/pages/reservation-details";
import CommissionsPage from "@/pages/commissions-page";
import MyCommissionsPage from "@/pages/my-commissions-page";
import ReservationRequestsPage from "@/pages/reservation-requests-page";
import NotificationsPage from "@/pages/notifications-page";
import CouponsPage from "@/pages/coupons-page";
import PackagesPage from "@/pages/packages-page";
import PackageDetailPage from "@/pages/package-detail-page";
import EditTripPage from "@/pages/edit-trip-page";
import CashBoxPage from "@/pages/cash-box";
import CutoffHistoryPage from "@/pages/cutoff-history";
import CutoffConfirmationPage from "@/pages/cutoff-confirmation-page";
import { PassengerTransferPage } from "@/pages/passenger-transfer-page";

import TripLogPageRoute from "@/pages/trip-log-page";
import UsersPageRoute from "@/pages/users-page";
import VehiclesPageRoute from "@/pages/vehicles-page";
import ReservationsPageRoute from "@/pages/reservations-page";
import RoutesPageRoute from "@/pages/routes-page";
import PublishTripPageRoute from "@/pages/publish-trip-page";
import TripsPageRoute from "@/pages/trips-page";
import UserCashBoxesPageRoute from "@/pages/user-cash-boxes-page";
import ProfilePageRoute from "@/pages/profile-page";
import { ReservationsListPage } from "@/pages/reservations-list";
import { TemplatesPage } from "@/pages/templates-page";
import TransactionHistoryPageRoute from "@/pages/transaction-history-page";
import OperatorTimelinePageRoute from "@/pages/operator-timeline-page";
import ExpensesPageRoute from "@/pages/expenses-page";
import PeriodBalancePageRoute from "@/pages/period-balance-page";
import StatisticsPageRoute from "@/pages/statistics-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/trip/:tripId/passengers" component={PassengerListPage} />
      <ProtectedRoute path="/commissions" component={CommissionsPage} />
      <ProtectedRoute path="/my-commissions" component={MyCommissionsPage} />

      <ProtectedRoute path="/reservation-requests" component={ReservationRequestsPage} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/coupons" component={CouponsPage} />
      <ProtectedRoute path="/packages" component={PackagesPage} />
      <ProtectedRoute path="/cash-box" component={CashBoxPage} />
      <ProtectedRoute path="/cutoff-history" component={CutoffHistoryPage} />
      <ProtectedRoute path="/cutoff-confirmation" component={CutoffConfirmationPage} />
      <ProtectedRoute path="/edit-trip/:id" component={EditTripPage} />
      <ProtectedRoute path="/passenger-transfer" component={PassengerTransferPage} />

      <ProtectedRoute path="/trip-log" component={TripLogPageRoute} />
      <ProtectedRoute path="/users" component={UsersPageRoute} />
      <ProtectedRoute path="/vehicles" component={VehiclesPageRoute} />
      <ProtectedRoute path="/reservations" component={ReservationsPageRoute} />
      <ProtectedRoute path="/reservations-list" component={ReservationsListPage} />
      <ProtectedRoute path="/routes" component={RoutesPageRoute} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/publish-trip" component={PublishTripPageRoute} />
      <ProtectedRoute path="/trips" component={TripsPageRoute} />
      <ProtectedRoute path="/user-cash-boxes" component={UserCashBoxesPageRoute} />
      <ProtectedRoute path="/transaction-history" component={TransactionHistoryPageRoute} />
      <ProtectedRoute path="/operator-timeline" component={OperatorTimelinePageRoute} />
      <ProtectedRoute path="/expenses" component={ExpensesPageRoute} />
      <ProtectedRoute path="/period-balance" component={PeriodBalancePageRoute} />
      <ProtectedRoute path="/statistics" component={StatisticsPageRoute} />
      <ProtectedRoute path="/profile" component={ProfilePageRoute} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/register/:token" component={RegisterPage} />
      <Route path="/reservation-details" component={ReservationDetails} />
      <Route path="/reservation-details/:id" component={ReservationDetails} />
      <Route path="/package/:id" component={PackageDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Cache cross-tab sharing se inicializa en main.tsx antes del render
  // Cleanup al desmontar la app
  useEffect(() => {
    return () => {
      cleanupCrossTabCache();
    };
  }, []);

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <DataLoaderProvider>
          <AuthProvider>
            <NotificationsProvider>
              <ThemeProvider>
                <TooltipProvider>
                  <ErrorBoundary fallback={ErrorFallback}>
                    <Toaster />
                    <Router />
                  </ErrorBoundary>
                </TooltipProvider>
              </ThemeProvider>
            </NotificationsProvider>
          </AuthProvider>
        </DataLoaderProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
