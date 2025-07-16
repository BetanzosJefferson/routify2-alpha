import { useAuth } from "@/hooks/use-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import TransactionHistoryPage from "@/components/transaction-history/transaction-history-page";

export default function TransactionHistoryPageRoute() {
  const { user } = useAuth();

  if (!user || !hasAccessToSection(user.role, "transaction-history")) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            No tienes permisos para acceder al historial de transacciones.
          </p>
        </div>
      </div>
    );
  }

  return <TransactionHistoryPage />;
}