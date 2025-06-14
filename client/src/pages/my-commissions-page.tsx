import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { TabType } from "@/hooks/use-active-tab";
import { CommissionsList } from "@/components/commissions/commissions-list";

export default function MyCommissionsPage() {
  // Simular funcionalidad de useActiveTab sin usar el hook directamente
  const [activeTab, setActiveTab] = useState<TabType>("trips");
  const handleTabChange = (tab: TabType) => setActiveTab(tab);
  
  const { user } = useAuth();

  // Función para determinar si el usuario tiene acceso a esta sección
  const canAccess = (section: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, section);
  };

  // Si el usuario no tiene acceso, mostrar mensaje de acceso denegado
  if (!canAccess("my-commissions")) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Contenido principal de la página
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Mis Comisiones</h1>
            </div>

            <CommissionsList readOnly={true} queryKeySuffix="my-commissions" />
          </main>
        </div>
      </div>
    </div>
  );
}