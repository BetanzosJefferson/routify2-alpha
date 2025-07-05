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
    if (user && packageQuery.data) {
      // Si el usuario tiene rol superAdmin, siempre tiene acceso
      if (user.role === 'superAdmin') {
        setIsSameCompany(true);
        console.log("¿Coincide la compañía?", true, "(superAdmin)");
        return;
      }
      
      // Si el usuario tiene rol taquilla, tiene acceso a paquetes de todas sus empresas asociadas
      // Como el endpoint /api/taquilla/packages ya filtra por empresas autorizadas,
      // si llegamos a ver este paquete, significa que tenemos acceso
      if (user.role === 'taquilla') {
        setIsSameCompany(true);
        console.log("¿Coincide la compañía?", true, "(rol taquilla con acceso multi-empresa)");
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
    <div className="min-h-screen w-full bg-gray-50">
      {/* Botón de navegación para móvil - sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="md:hidden">
            <Button variant="ghost" size="sm" className="p-2">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Volver</span>
            </Button>
          </Link>
          <h1 className="text-lg font-semibold md:hidden">Detalles del Paquete</h1>
          <div className="md:hidden w-10"></div> {/* Spacer para centrar el título */}
        </div>
      </div>

      {/* Contenido principal con porcentajes y viewport units */}
      <div className="w-full px-4 py-4 max-w-none">
        <div className="max-w-full mx-auto">
          <Card className="shadow-md w-full">
            <CardHeader className="bg-primary/5 pb-3 px-4 w-full">
              <div className="flex flex-col gap-3 w-full">
                <div className="w-full">
                  <CardTitle className="text-lg font-bold leading-tight">Paquete #{packageData.id}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Fecha de envío: {packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                      (packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                       formatDate(new Date(packageData.createdAt)))}
                  </CardDescription>
                </div>
                <Badge
                  className={`text-xs w-full text-center py-2 ${
                    packageData.deliveryStatus === 'entregado' 
                      ? "bg-green-500 hover:bg-green-600" 
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {packageData.deliveryStatus === 'entregado' ? 'Entregado' : 'Pendiente de entrega'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 w-full">
              <div className="space-y-4 w-full">
                {/* Sección de remitente con porcentajes */}
                <div className="bg-slate-50 p-4 rounded-lg w-full">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <User className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                    Remitente
                  </h3>
                  <div className="space-y-2 w-full">
                    <p className="text-sm font-medium break-words">
                      {packageData.senderName} {packageData.senderLastName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Phone className="mr-2 h-3 w-3 flex-shrink-0" /> 
                      <a href={`tel:${packageData.senderPhone}`} className="underline break-all">
                        {packageData.senderPhone}
                      </a>
                    </p>
                  </div>
                </div>
                
                {/* Sección de destinatario con porcentajes */}
                <div className="bg-slate-50 p-4 rounded-lg w-full">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <User className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                    Destinatario
                  </h3>
                  <div className="space-y-2 w-full">
                    <p className="text-sm font-medium break-words">
                      {packageData.recipientName} {packageData.recipientLastName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Phone className="mr-2 h-3 w-3 flex-shrink-0" /> 
                      <a href={`tel:${packageData.recipientPhone}`} className="underline break-all">
                        {packageData.recipientPhone}
                      </a>
                    </p>
                  </div>
                </div>
              
                {/* Información General - grid responsive */}
                <div className="bg-slate-50 p-4 rounded-lg w-full">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Package className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                    Información General
                  </h3>
                  <div className="space-y-3 w-full">
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Fecha</p>
                        <p className="text-sm break-words">
                          {packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                            (packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                             formatDate(new Date(packageData.createdAt)))}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Precio</p>
                        <p className="text-sm font-semibold text-green-600 break-words">
                          {formatCurrency(packageData.price)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 w-full">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Descripción</p>
                        <p className="text-sm break-words">{packageData.packageDescription}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Método de Pago</p>
                        <p className="text-sm break-words">{packageData.paymentMethod || 'efectivo'}</p>
                      </div>
                    </div>
                    
                    {packageData.usesSeats && (
                      <div className="w-full">
                        <p className="text-xs font-medium text-muted-foreground">Asientos</p>
                        <p className="text-sm">
                          Ocupa {packageData.seatsQuantity} {packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Origen y Destino - stack en móvil */}
                <div className="grid grid-cols-1 gap-4 w-full">
                  <div className="bg-slate-50 p-4 rounded-lg w-full">
                    <h3 className="text-sm font-semibold mb-3 flex items-center">
                      <Truck className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                      Origen
                    </h3>
                    <p className="text-xs text-muted-foreground break-words">
                      {packageData.segmentOrigin || "No disponible"}
                    </p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg w-full">
                    <h3 className="text-sm font-semibold mb-3 flex items-center">
                      <Truck className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                      Destino
                    </h3>
                    <p className="text-xs text-muted-foreground break-words">
                      {packageData.segmentDestination || "No disponible"}
                    </p>
                  </div>
                </div>

                {/* Estado y Seguimiento */}
                <div className="bg-slate-50 p-4 rounded-lg w-full">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                    Estado y Seguimiento
                  </h3>
                  <div className="space-y-3 w-full">
                    <div className="flex flex-col gap-2 w-full">
                      <span className="text-xs font-medium text-muted-foreground">Estado de pago:</span>
                      {packageData.isPaid ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-xs w-fit">
                          <CheckCircle className="mr-1 h-3 w-3" /> 
                          Pagado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs w-fit">
                          <Clock className="mr-1 h-3 w-3" /> 
                          Pendiente de pago
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full">
                      <span className="text-xs font-medium text-muted-foreground">Estado de entrega:</span>
                      {packageData.deliveryStatus === 'entregado' ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-xs w-fit">
                          <Truck className="mr-1 h-3 w-3" /> 
                          Entregado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs w-fit">
                          <Clock className="mr-1 h-3 w-3" /> 
                          Pendiente de entrega
                        </Badge>
                      )}
                    </div>
                    
                    {packageData.registeredBy && (
                      <div className="flex flex-col gap-2 w-full">
                        <span className="text-xs font-medium text-muted-foreground">Registrado por:</span>
                        <span className="text-xs break-words">{packageData.registeredBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          
            {/* Footer con botones optimizados para móvil */}
            <CardFooter className="p-4 w-full bg-gray-50 border-t">
              <div className="w-full space-y-3">
                {/* Botones de acción para usuarios autorizados */}
                {user && isSameCompany && (
                  <div className="grid grid-cols-1 gap-3 w-full">
                    {!packageData.isPaid && (
                      <Button 
                        variant="default" 
                        className="bg-green-600 hover:bg-green-700 w-full text-sm py-3" 
                        onClick={handleMarkAsPaid}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Marcar como pagado
                      </Button>
                    )}
                    
                    {packageData.deliveryStatus !== 'entregado' && (
                      <Button 
                        variant="default" 
                        className="bg-blue-600 hover:bg-blue-700 w-full text-sm py-3" 
                        onClick={handleMarkAsDelivered}
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        Marcar como entregado
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Botones siempre visibles */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs py-3" 
                    onClick={handlePrintTicket}
                  >
                    <Printer className="mr-2 h-3 w-3" />
                    Imprimir
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full text-xs py-3" 
                    onClick={handleSharePackage}
                  >
                    <Share2 className="mr-2 h-3 w-3" />
                    Compartir
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}