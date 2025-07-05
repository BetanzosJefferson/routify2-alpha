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
    <div className="min-h-screen w-screen bg-gray-50 overflow-x-hidden">
      {/* Header fijo con navegación */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm w-full">
        <div className="flex items-center justify-between p-3 max-w-full">
          <Link href="/packages" className="flex items-center justify-center w-10 h-10">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <h1 className="text-base font-semibold text-gray-900 flex-1 text-center">Detalles del Paquete</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Contenido principal responsive */}
      <div className="w-full h-full">
        <div className="px-3 py-3 pb-20">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            
            {/* Header del paquete */}
            <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-gray-900">Paquete #{packageData.id}</h2>
                <p className="text-sm text-gray-600">
                  {packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                    (packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                     formatDate(new Date(packageData.createdAt)))}
                </p>
                <div className="flex">
                  <Badge
                    className={`text-xs px-3 py-1 ${
                      packageData.deliveryStatus === 'entregado' 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {packageData.deliveryStatus === 'entregado' ? 'Entregado' : 'Pendiente de entrega'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contenido del paquete */}
            <div className="p-4 space-y-4">
              
              {/* Información General */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <Package className="mr-2 h-4 w-4 text-blue-600" />
                  Información General
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Fecha</p>
                    <p className="text-sm text-gray-900">
                      {packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                        (packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                         formatDate(new Date(packageData.createdAt)))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Precio</p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(packageData.price)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Descripción</p>
                  <p className="text-sm text-gray-900">{packageData.packageDescription}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Método de Pago</p>
                  <p className="text-sm text-gray-900">{packageData.paymentMethod || 'efectivo'}</p>
                </div>
              </div>

              {/* Remitente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <User className="mr-2 h-4 w-4 text-blue-600" />
                  Remitente
                </h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    {packageData.senderName} {packageData.senderLastName}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center">
                    <Phone className="mr-2 h-3 w-3" /> 
                    <a href={`tel:${packageData.senderPhone}`} className="underline">
                      {packageData.senderPhone}
                    </a>
                  </p>
                </div>
              </div>
              
              {/* Destinatario */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <User className="mr-2 h-4 w-4 text-blue-600" />
                  Destinatario
                </h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    {packageData.recipientName} {packageData.recipientLastName}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center">
                    <Phone className="mr-2 h-3 w-3" /> 
                    <a href={`tel:${packageData.recipientPhone}`} className="underline">
                      {packageData.recipientPhone}
                    </a>
                  </p>
                </div>
              </div>
              
              {/* Origen y Destino */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <Truck className="mr-2 h-4 w-4 text-blue-600" />
                  Origen
                </h3>
                <p className="text-xs text-gray-600">
                  {packageData.segmentOrigin || "No disponible"}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <Truck className="mr-2 h-4 w-4 text-blue-600" />
                  Destino
                </h3>
                <p className="text-xs text-gray-600">
                  {packageData.segmentDestination || "No disponible"}
                </p>
              </div>

              {/* Estado y Seguimiento */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                  <Clock className="mr-2 h-4 w-4 text-blue-600" />
                  Estado y Seguimiento
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 block mb-1">Estado de pago:</span>
                    {packageData.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" /> 
                        Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" /> 
                        Pendiente de pago
                      </Badge>
                    )}
                  </div>
                  
                  <div>
                    <span className="text-xs font-medium text-gray-500 block mb-1">Estado de entrega:</span>
                    {packageData.deliveryStatus === 'entregado' ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                        <Truck className="mr-1 h-3 w-3" /> 
                        Entregado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" /> 
                        Pendiente de entrega
                      </Badge>
                    )}
                  </div>
                  
                  {packageData.registeredBy && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 block mb-1">Registrado por:</span>
                      <span className="text-xs text-gray-900">{packageData.registeredBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Botones de acción fijos en la parte inferior */}
            <div className="border-t border-gray-200 bg-white p-4 space-y-3">
              
              {/* Botones de acción para usuarios autorizados */}
              {user && isSameCompany ? (
                <div className="space-y-2">
                  {!packageData.isPaid && (
                    <Button 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700 w-full py-3 text-sm font-medium" 
                      onClick={handleMarkAsPaid}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como pagado
                    </Button>
                  )}
                  
                  {packageData.deliveryStatus !== 'entregado' && (
                    <Button 
                      variant="default" 
                      className="bg-blue-600 hover:bg-blue-700 w-full py-3 text-sm font-medium" 
                      onClick={handleMarkAsDelivered}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Marcar como entregado
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 text-center">
                    {!user ? 'Inicia sesión para más opciones' : 'No tienes permisos para modificar este paquete'}
                  </p>
                </div>
              )}
              
              {/* Botones secundarios - siempre visibles */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="py-3 text-sm" 
                  onClick={handlePrintTicket}
                >
                  <Printer className="mr-2 h-3 w-3" />
                  Imprimir
                </Button>
                
                <Button 
                  variant="outline" 
                  className="py-3 text-sm" 
                  onClick={handleSharePackage}
                >
                  <Share2 className="mr-2 h-3 w-3" />
                  Compartir
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}