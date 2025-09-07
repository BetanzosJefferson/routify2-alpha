import React from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import PassengerVerificationPage from "@/components/passenger-verification/passenger-verification-page";

export default function PassengerVerificationPageRoute() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <div>Acceso no autorizado</div>;
  }

  // Verificar permisos de acceso (similar a otras secciones administrativas)
  if (!hasAccessToSection(user.role, "passengers", user)) {
    return <div>No tienes permisos para acceder a esta sección</div>;
  }

  return <PassengerVerificationPage />;
}