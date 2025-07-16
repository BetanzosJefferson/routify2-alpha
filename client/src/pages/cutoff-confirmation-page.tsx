import React from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import CutoffConfirmationPage from "@/components/cutoff-confirmation/cutoff-confirmation-page";

export default function CutoffConfirmationPageRoute() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <div>Acceso no autorizado</div>;
  }

  // Verificar permisos de acceso
  console.log("CutoffConfirmationPage - User:", user);
  console.log("CutoffConfirmationPage - User role:", user.role);
  console.log("CutoffConfirmationPage - Has access:", hasAccessToSection(user, "cutoff-confirmation"));
  
  if (!hasAccessToSection(user, "cutoff-confirmation")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Acceso denegado</h3>
          <p className="text-red-600 mt-2">
            No tienes permisos para acceder a esta sección. Solo los usuarios con roles OWNER o ADMIN pueden confirmar cortes.
          </p>
          <p className="text-sm text-red-500 mt-1">
            Tu rol actual: {user.role}
          </p>
        </div>
      </div>
    );
  }

  return <CutoffConfirmationPage />;
}