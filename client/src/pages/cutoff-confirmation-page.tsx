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
  if (!hasAccessToSection(user, "cutoff-confirmation")) {
    return <div>No tienes permisos para acceder a esta sección</div>;
  }

  return <CutoffConfirmationPage />;
}