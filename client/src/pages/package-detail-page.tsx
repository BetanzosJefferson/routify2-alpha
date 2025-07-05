import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { PackageTicket, generatePackageTicketPDF } from "@/components/packages/package-ticket";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  Calendar,
  User,
  Phone,
  Truck,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronsRight,
  Share2,
  Printer,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from "qrcode";

export default function PackageDetailPage() {
  const [match, params] = useRoute("/package/:id");
  const { toast } = useToast();
  const { user } = useAuth();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isSameCompany, setIsSameCompany] = useState<boolean>(false);
  const packageId = params?.id ? parseInt(params.id) : 0;

  // Consultar los detalles del paquete desde la API
  const packageQuery = useQuery({
    queryKey: [`/api/public/packages/${packageId}`],
    queryFn: async () => {
      if (!packageId) return null;
      const response = await fetch(`/api/public/packages/${packageId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles del paquete");
      }
      return await response.json();
    },
    enabled: !!packageId,
  });

  // Generar código QR con la URL para verificar el paquete
  React.useEffect(() => {
    if (packageQuery.data) {
      const verificationUrl = `${window.location.origin}/package/${packageId}`;
      QRCode.toDataURL(verificationUrl, { width: 200 })
        .then(url => {
          setQrUrl(url);
        })
        .catch(err => {
          console.error("Error al generar QR:", err);
        });
    }
  }, [packageQuery.data, packageId]);
  
  // Efecto para comprobar si el usuario pertenece a la misma compañía que el paquete
  useEffect(() => {
    console.log("🔍 Verificando permisos de usuario:", { user: user?.email, role: user?.role, companyId: user?.companyId });
    console.log("🔍 Datos del paquete:", packageQuery.data);
    
    if (user && packageQuery.data) {
      // Si el usuario tiene rol superAdmin, siempre tiene acceso
      if (user.role === 'superAdmin') {
        setIsSameCompany(true);
        console.log("✅ Acceso concedido (superAdmin)");
        return;
      }
      
      // Si el usuario tiene rol taquilla, tiene acceso a paquetes de todas sus empresas asociadas
      // Como el endpoint /api/taquilla/packages ya filtra por empresas autorizadas,
      // si llegamos a ver este paquete, significa que tenemos acceso
      if (user.role === 'taquilla') {
        setIsSameCompany(true);
        console.log("✅ Acceso concedido (rol taquilla)");
        return;
      }
      
      // Para otros roles, comprobar si el companyId coincide
      // El usuario puede tener la compañía en diferentes formatos:
      // 1. user.companyId - identificador directo de la compañía (formato slug)
      // 2. user.company - nombre de la compañía que podemos convertir a slug
      const userCompanyId = user.companyId || "";
      const userCompanySlug = user.company ? user.company.toLowerCase().replace(/\s+/g, '-') : "";
      
      // Comparación con el companyId del paquete
      // Intentamos todas las posibles coincidencias
      const packageCompanyId = packageQuery.data.companyId || "";
      
      const matchesCompany = 
        // Verificar coincidencia directa por companyId
        (userCompanyId && packageCompanyId && packageCompanyId === userCompanyId) ||
        // Verificar coincidencia por slug de company
        (userCompanySlug && packageCompanyId && packageCompanyId === userCompanySlug) ||
        // Verificar coincidencia por slug con formato típico (company-123)
        (userCompanySlug && packageCompanyId && packageCompanyId.startsWith(userCompanySlug + '-'));
      
      console.log("Datos del paquete:", JSON.stringify(packageQuery.data, null, 2));
      console.log("CompanyId del usuario:", userCompanyId);
      console.log("Company del usuario (slug):", userCompanySlug);
      console.log("CompanyId del paquete:", packageCompanyId);
      console.log("¿Coincide la compañía?", matchesCompany);
      
      setIsSameCompany(matchesCompany);
    } else {
      setIsSameCompany(false);
    }
  }, [user, packageQuery.data]);

  // Manejar la impresión del ticket
  const handlePrintTicket = async () => {
    if (packageQuery.data) {
      try {
        toast({
          title: "Generando ticket",
          description: "Por favor espere mientras se genera el ticket...",
        });
        
        // Generar el PDF con dimensiones de ticket térmico
        await generatePackageTicketPDF(packageQuery.data, packageQuery.data.companyName || "TransRoute");
      } catch (error) {
        console.error("Error al generar el ticket PDF:", error);
        toast({
          title: "Error",
          description: "No se pudo generar el ticket PDF. Intente nuevamente.",
          variant: "destructive",
        });
      }
    }
  };

  // Compartir enlace del paquete
  const handleSharePackage = () => {
    const url = window.location.href;
    
    if (navigator.share) {
      navigator.share({
        title: `Paquete #${packageId}`,
        text: `Detalles del paquete #${packageId}`,
        url: url,
      })
      .catch(error => {
        console.error("Error al compartir:", error);
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: "Enlace copiado",
          description: "El enlace se ha copiado al portapapeles",
        });
      });
    }
  };

  // Estados de carga y error
  if (packageQuery.isLoading) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Separator />
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (packageQuery.isError || !packageQuery.data) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>No se pudieron cargar los detalles del paquete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-center mb-4">
                El paquete solicitado no existe o no tienes permisos para verlo.
              </p>
              <Link href="/">
                <Button>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const packageData = packageQuery.data;

  // Manejo de marcado como pagado
  const handleMarkAsPaid = async () => {
    try {
      toast({
        title: "Procesando...",
        description: "Marcando paquete como pagado",
      });
      
      console.log(`Enviando petición para marcar como pagado el paquete ${packageId}`);
      
      // No necesitamos enviar el ID del usuario en la petición
      // El servidor lo obtendrá de la sesión autenticada
      const response = await fetch(`/api/public/packages/${packageId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          isPaid: true,
          // Solo enviamos los datos necesarios, el servidor se encargará 
          // de obtener el usuario desde la sesión
        })
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el estado de pago");
      }
      
      // Recargar los datos del paquete
      console.log("Paquete marcado como pagado, recargando datos...");
      await packageQuery.refetch();
      
      toast({
        title: "¡Éxito!",
        description: "El paquete ha sido marcado como pagado",
        variant: "default",
      });
    } catch (error) {
      console.error("Error al marcar como pagado:", error);
      toast({
        title: "Error",
        description: "No se pudo marcar el paquete como pagado",
        variant: "destructive",
      });
    }
  };
  
  // Manejo de marcado como entregado
  const handleMarkAsDelivered = async () => {
    try {
      toast({
        title: "Procesando...",
        description: "Marcando paquete como entregado",
      });
      
      console.log(`Enviando petición para marcar como entregado el paquete ${packageId}`);
      
      // No necesitamos enviar el ID del usuario en la petición
      // El servidor lo obtendrá de la sesión autenticada
      const response = await fetch(`/api/public/packages/${packageId}/mark-delivered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          deliveryStatus: 'entregado',
          // Solo enviamos los datos necesarios, el servidor se encargará 
          // de obtener el usuario desde la sesión
        })
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el estado de entrega");
      }
      
      // Recargar los datos del paquete
      console.log("Paquete marcado como entregado, recargando datos...");
      await packageQuery.refetch();
      
      toast({
        title: "¡Éxito!",
        description: "El paquete ha sido marcado como entregado",
        variant: "default",
      });
    } catch (error) {
      console.error("Error al marcar como entregado:", error);
      toast({
        title: "Error",
        description: "No se pudo marcar el paquete como entregado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simple */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <Link href="/packages" className="mr-3">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Paquete #{packageData.id}</h1>
      </div>

      {/* Contenido simple */}
      <div className="p-4 space-y-4">
        
        {/* Información básica */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Información General</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span>{packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                (packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                 formatDate(new Date(packageData.createdAt)))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Precio:</span>
              <span className="font-semibold text-green-600">{formatCurrency(packageData.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Descripción:</span>
              <span>{packageData.packageDescription}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Método de pago:</span>
              <span>{packageData.paymentMethod || 'efectivo'}</span>
            </div>
          </div>
        </div>

        {/* Remitente */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Remitente</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{packageData.senderName} {packageData.senderLastName}</p>
            <p className="text-gray-600">
              <a href={`tel:${packageData.senderPhone}`} className="underline">
                {packageData.senderPhone}
              </a>
            </p>
          </div>
        </div>

        {/* Destinatario */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Destinatario</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{packageData.recipientName} {packageData.recipientLastName}</p>
            <p className="text-gray-600">
              <a href={`tel:${packageData.recipientPhone}`} className="underline">
                {packageData.recipientPhone}
              </a>
            </p>
          </div>
        </div>

        {/* Origen y Destino */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Ruta</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Origen: </span>
              <span>{packageData.segmentOrigin || "No disponible"}</span>
            </div>
            <div>
              <span className="text-gray-600">Destino: </span>
              <span>{packageData.segmentDestination || "No disponible"}</span>
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">Estado</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Estado de pago:</span>
              <Badge className={packageData.isPaid ? "bg-green-500" : "bg-gray-500"}>
                {packageData.isPaid ? 'Pagado' : 'Pendiente'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Estado de entrega:</span>
              <Badge className={packageData.deliveryStatus === 'entregado' ? "bg-green-500" : "bg-orange-500"}>
                {packageData.deliveryStatus === 'entregado' ? 'Entregado' : 'Pendiente'}
              </Badge>
            </div>
            {packageData.registeredBy && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Registrado por:</span>
                <span className="text-sm">{packageData.registeredBy}</span>
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-3 pb-6">
          {user && isSameCompany && (
            <div className="space-y-2">
              {!packageData.isPaid && (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  onClick={handleMarkAsPaid}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Marcar como pagado
                </Button>
              )}
              
              {packageData.deliveryStatus !== 'entregado' && (
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  onClick={handleMarkAsDelivered}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Marcar como entregado
                </Button>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handlePrintTicket}>
              <Printer className="mr-2 h-3 w-3" />
              Imprimir
            </Button>
            
            <Button variant="outline" onClick={handleSharePackage}>
              <Share2 className="mr-2 h-3 w-3" />
              Compartir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}