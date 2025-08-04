import { PassengerTransfer } from "@/components/passenger-transfer/passenger-transfer-simple";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function PassengerTransferPage() {
  const { user, isLoading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar activeTab="passenger-transfer" onTabChange={() => {}} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-6 py-8">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Verificando permisos...</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Verificar si el usuario tiene permisos para acceder a transferencia de pasajeros
  const allowedRoles = ['admin', 'dueño', 'callCenter'];
  const hasAccess = user && allowedRoles.includes(user.role);

  if (!hasAccess) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar activeTab="passenger-transfer" onTabChange={() => {}} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-6 py-8">
              <Alert className="max-w-md mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Acceso restringido</strong>
                  <br />
                  Esta sección solo está disponible para administradores, dueños y personal de call center.
                  <br />
                  <span className="text-sm text-muted-foreground mt-2 block">
                    Tu rol actual: {user?.role || 'No definido'}
                  </span>
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Si el usuario tiene permisos, mostrar la página normal
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab="passenger-transfer" onTabChange={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
            <PassengerTransfer />
          </div>
        </main>
      </div>
    </div>
  );
}