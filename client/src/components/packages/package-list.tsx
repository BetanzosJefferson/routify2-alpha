import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency, formatDateToLocal, getCurrentLocalDate } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/role-based-permissions";
import { UserRole } from "@shared/schema";

// UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Package,
  MoreVertical,
  MoreHorizontal,
  Edit,
  Eye,
  Printer,
  Trash,
  Check,
  Clock,
  Ban,
  Loader2,
  Plus,
  Share2,
  Search,
  Filter,
  X,
  MapPin,
  User,
} from "lucide-react";

// Importar componentes relacionados con paquetes
import { PackageTicket } from "./package-ticket";
import { PackageDetailsModal } from "./package-details-modal";

interface PackageListProps {
  onAddPackage: () => void;
  onEditPackage: (packageId: number) => void;
}

export function PackageList({ onAddPackage, onEditPackage }: PackageListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [packageToDelete, setPackageToDelete] = useState<number | null>(null);
  const [packageToView, setPackageToView] = useState<any | null>(null);
  const [packageToDetail, setPackageToDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  
  // Estados para filtros - INICIALIZAR con fecha actual por defecto
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    date: getCurrentLocalDate(), // ✅ Por defecto mostrar solo paquetes del día actual
    company: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Determinar si el usuario puede añadir/editar paquetes
  const canCreateEdit = user ? hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER, UserRole.TICKET_OFFICE]) : false;
  
  // Determinar si el usuario puede eliminar paquetes
  const canDelete = user ? hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN]) : false;
  
  // Función para verificar si el usuario taquilla puede interactuar con un paquete específico
  const canInteractWithPackage = (packageItem: any) => {
    if (!user) return false;
    
    // Roles con acceso completo
    if (hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER])) {
      return true;
    }
    
    // Para rol taquilla, verificar acceso a la empresa del paquete
    if (user.role === UserRole.TICKET_OFFICE) {
      // Aquí verificaremos si el usuario tiene acceso a la empresa del paquete
      // Por ahora asumimos que sí tiene acceso ya que el endpoint /taquilla/packages
      // solo devuelve paquetes de empresas a las que el usuario tiene acceso
      return true;
    }
    
    return false;
  };
  
  // Determinar qué endpoint usar basado en el rol del usuario
  const packageEndpoint = user?.role === UserRole.TICKET_OFFICE ? "/api/taquilla/packages" : "/api/packages";
  
  // Obtener los paquetes
  const packagesQuery = useQuery({
    queryKey: [packageEndpoint],
    queryFn: async () => {
      const response = await fetch(packageEndpoint);
      if (!response.ok) {
        throw new Error("Error al cargar paquetes");
      }
      return response.json();
    },
  });

  // Filtrar paquetes basado en los filtros aplicados
  const filteredPackages = useMemo(() => {
    if (!packagesQuery.data) return [];
    
    return packagesQuery.data.filter((pkg: any) => {
      // Filtro por origen
      if (filters.origin && !pkg.tripOrigin?.toLowerCase().includes(filters.origin.toLowerCase())) {
        return false;
      }
      
      // Filtro por destino
      if (filters.destination && !pkg.tripDestination?.toLowerCase().includes(filters.destination.toLowerCase())) {
        return false;
      }
      
      // Filtro por fecha
      if (filters.date) {
        // Solo usar tripDepartureDate para filtrar por fecha del segmento específico
        // NUNCA usar createdAt como fallback porque no tiene sentido lógico
        console.log(`[FILTRO FECHA DEBUG] Evaluando condiciones para paquete #${pkg.id}:`, {
          'pkg.tripDepartureDate': pkg.tripDepartureDate,
          'typeof pkg.tripDepartureDate': typeof pkg.tripDepartureDate,
          'pkg.tripDepartureDate evaluado': !!pkg.tripDepartureDate,
          'pkg.shippingDate': pkg.shippingDate,
          'pkg.shippingDate evaluado': !!pkg.shippingDate,
          'pkg.tripDate': pkg.tripDate,
          'pkg.tripDate evaluado': !!pkg.tripDate,
        });
        
        // Solo usar fechas relacionadas con el viaje, nunca createdAt
        let packageDate = null;
        if (pkg.tripDepartureDate) {
          // NO usar new Date() para strings de fecha - causa problemas de timezone
          // Usar formatDateToLocal directamente con el string
          console.log(`[FECHA DEBUG] Procesando tripDepartureDate: "${pkg.tripDepartureDate}"`);
          packageDate = formatDateToLocal(pkg.tripDepartureDate);
          console.log(`[FECHA DEBUG] formatDateToLocal result:`, packageDate);
        } else if (pkg.shippingDate) {
          console.log(`[FECHA DEBUG] Procesando shippingDate: "${pkg.shippingDate}"`);
          packageDate = formatDateToLocal(pkg.shippingDate);
        } else if (pkg.tripDate) {
          console.log(`[FECHA DEBUG] Procesando tripDate: "${pkg.tripDate}"`);
          packageDate = formatDateToLocal(pkg.tripDate);
        }
        
        // Debug: Log para verificar el filtrado
        console.log(`[FILTRO FECHA DEBUG] Paquete #${pkg.id}:`, {
          'TODAS LAS PROPIEDADES': Object.keys(pkg),
          'shippingDate': pkg.shippingDate,
          'tripDepartureDate': pkg.tripDepartureDate,
          'tripDate': pkg.tripDate,
          'packageDate calculado': packageDate,
          'filters.date': filters.date,
          'coincide': packageDate === filters.date
        });
        
        // Si no hay fecha de viaje válida, excluir el paquete del filtro
        if (!packageDate || packageDate !== filters.date) {
          return false;
        }
      }
      
      // Filtro por empresa (solo para roles que pueden ver múltiples empresas)
      if (filters.company && pkg.companyId) {
        if (!pkg.companyId.toLowerCase().includes(filters.company.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
  }, [packagesQuery.data, filters]);

  // Función para limpiar filtros - mantener fecha actual como predeterminada
  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      date: getCurrentLocalDate(), // ✅ Al limpiar, volver a mostrar solo el día actual
      company: "",
    });
  };

  // Contar filtros activos
  const activeFiltersCount = Object.values(filters).filter(value => value !== "").length;
  
  // Función para imprimir ticket de paquete
  const printPackageTicket = (pkg: any) => {
    // Importar la función de generación de PDF de manera dinámica
    import('./package-ticket').then(({ generatePackageTicketPDF }) => {
      // Generar el PDF con dimensiones de ticket térmico (58mm x 160mm)
      generatePackageTicketPDF(pkg, user?.company || "TransRoute");
    }).catch(error => {
      console.error("Error al generar el ticket PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el ticket",
        variant: "destructive",
      });
    });
  };
  
  // Mutación para marcar un paquete como entregado
  const markAsDeliveredMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const response = await apiRequest("PATCH", `/api/packages/${packageId}/deliver`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al marcar como entregado");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete actualizado",
        description: "El paquete ha sido marcado como entregado",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: [packageEndpoint] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para eliminar un paquete
  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const response = await apiRequest("DELETE", `/api/packages/${packageId}`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar el paquete");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete eliminado",
        description: "El paquete ha sido eliminado exitosamente",
        variant: "default",
      });
      
      // Invalidar la caché de paquetes
      queryClient.invalidateQueries({ queryKey: [packageEndpoint] });
      
      // Invalidar también la caché de viajes para actualizar los asientos disponibles
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      setPackageToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setPackageToDelete(null);
    },
  });
  
  // Manejar la impresión del ticket usando jsPDF para el formato térmico
  const handlePrintTicket = () => {
    if (packageToView) {
      // Importar la función de generación de PDF de manera dinámica
      import('./package-ticket').then(({ generatePackageTicketPDF }) => {
        // Generar el PDF con dimensiones de ticket térmico (58mm x 160mm)
        generatePackageTicketPDF(packageToView, user?.company || "TransRoute");
        
        // Cerrar el diálogo automáticamente después de abrir la ventana del PDF
        setTimeout(() => {
          setPackageToView(null);
        }, 500);
      }).catch(error => {
        console.error("Error al generar el ticket PDF:", error);
        toast({
          title: "Error",
          description: "No se pudo generar el ticket PDF. Intente nuevamente.",
          variant: "destructive",
        });
      });
    }
  };

  // Manejar el compartir ticket usando la Web Share API
  const handleShareTicket = async () => {
    if (packageToView) {
      try {
        // Generar el PDF primero
        const { generatePackageTicketPDF } = await import('./package-ticket');
        const doc = await generatePackageTicketPDF(packageToView, user?.company || "TransRoute");
        
        // Crear el blob del PDF
        const pdfBlob = doc.output('blob');
        
        // Crear el archivo para compartir
        const file = new File([pdfBlob], `ticket-paquete-${packageToView.id}.pdf`, {
          type: 'application/pdf',
        });

        // Datos para compartir
        const shareData = {
          title: `Ticket de Paquete #${packageToView.id}`,
          text: `Ticket de paquete #${packageToView.id} - ${packageToView.senderName} ${packageToView.senderLastName} → ${packageToView.recipientName} ${packageToView.recipientLastName}`,
          files: [file],
          url: `${window.location.origin}/package/${packageToView.id}`,
        };

        // Verificar si el dispositivo soporta compartir archivos
        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast({
            title: "Ticket compartido",
            description: "El ticket se ha compartido exitosamente",
          });
        } else if (navigator.share) {
          // Si no soporta archivos, compartir solo el enlace
          await navigator.share({
            title: shareData.title,
            text: shareData.text,
            url: shareData.url,
          });
          toast({
            title: "Enlace compartido",
            description: "El enlace del ticket se ha compartido exitosamente",
          });
        } else {
          // Fallback: copiar al portapapeles
          await navigator.clipboard.writeText(shareData.url);
          toast({
            title: "Enlace copiado",
            description: "El enlace del ticket se ha copiado al portapapeles",
          });
        }
      } catch (error) {
        console.error('Error al compartir ticket:', error);
        if (error.name === 'AbortError') {
          // Usuario canceló el compartir
          return;
        }
        toast({
          title: "Error al compartir",
          description: "No se pudo compartir el ticket. Intente nuevamente.",
          variant: "destructive",
        });
      }
    }
  };

  // Manejar la impresión del ticket de 60mm
  const handlePrintTicket60mm = () => {
    if (packageToView) {
      // Importar la función de generación de PDF de 60mm de manera dinámica
      import('./package-ticket').then(({ generatePackageTicket60mmPDF }) => {
        // Generar el PDF con dimensiones de ticket térmico (60mm x 170mm)
        generatePackageTicket60mmPDF(packageToView, user?.company || "TransRoute");
        
        // Cerrar el diálogo automáticamente después de abrir la ventana del PDF
        setTimeout(() => {
          setPackageToView(null);
        }, 500);
      }).catch(error => {
        console.error("Error al generar el ticket PDF 60mm:", error);
        toast({
          title: "Error",
          description: "No se pudo generar el ticket PDF 60mm. Intente nuevamente.",
          variant: "destructive",
        });
      });
    }
  };
  
  // Renderizar el estado de carga
  if (packagesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Renderizar el estado de error
  if (packagesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            No se pudieron cargar los paquetes. Por favor, intente de nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            {packagesQuery.error instanceof Error
              ? packagesQuery.error.message
              : "Error desconocido"}
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => packagesQuery.refetch()}>Reintentar</Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Renderizar cuando no hay paquetes
  if (!packagesQuery.data || packagesQuery.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No hay paquetes registrados</CardTitle>
          <CardDescription>
            Aún no hay paquetes registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Package className="h-16 w-16 text-muted-foreground opacity-50" />
        </CardContent>
        <CardFooter className="flex justify-center">
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar nuevo paquete
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Renderizar cuando no hay paquetes que coincidan con los filtros
  if (filteredPackages.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">
              Paquetes ({packagesQuery.data.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              {filters.date === getCurrentLocalDate() ? 
                `Filtrando paquetes de hoy (${formatDateToLocal(getCurrentLocalDate())})` :
                filters.date ? 
                  `Filtrando paquetes del ${formatDateToLocal(filters.date)}` :
                  `${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} aplicado${activeFiltersCount > 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            {canCreateEdit && (
              <Button onClick={onAddPackage}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Paquete
              </Button>
            )}
          </div>
        </div>

        {/* Sección de filtros */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center">
                  <Search className="mr-2 h-5 w-5" />
                  Filtros de búsqueda
                </div>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Limpiar filtros
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-origin">Origen</Label>
                  <Input
                    id="filter-origin"
                    placeholder="Buscar por origen..."
                    value={filters.origin}
                    onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-destination">Destino</Label>
                  <Input
                    id="filter-destination"
                    placeholder="Buscar por destino..."
                    value={filters.destination}
                    onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-date">Fecha</Label>
                  <Input
                    id="filter-date"
                    type="date"
                    value={filters.date}
                    onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>No se encontraron paquetes</CardTitle>
            <CardDescription>
              No hay paquetes que coincidan con los filtros aplicados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Search className="h-16 w-16 text-muted-foreground opacity-50" />
          </CardContent>
          <CardFooter className="flex justify-center gap-2">
            <Button variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
            {canCreateEdit && (
              <Button onClick={onAddPackage}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Paquete
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Renderizar la lista de paquetes
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">
            Paquetes ({filteredPackages.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            {filters.date === getCurrentLocalDate() ? 
              `Mostrando paquetes de hoy (${formatDateToLocal(getCurrentLocalDate())})` :
              filters.date ? 
                `Mostrando paquetes del ${formatDateToLocal(filters.date)}` :
                `${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} aplicado${activeFiltersCount > 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Paquete
            </Button>
          )}
        </div>
      </div>

      {/* Sección de filtros */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center">
                <Search className="mr-2 h-5 w-5" />
                Filtros de búsqueda
              </div>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpiar filtros
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-origin">Origen</Label>
                <Input
                  id="filter-origin"
                  placeholder="Buscar por origen..."
                  value={filters.origin}
                  onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-destination">Destino</Label>
                <Input
                  id="filter-destination"
                  placeholder="Buscar por destino..."
                  value={filters.destination}
                  onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-date">Fecha</Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              {user?.role === UserRole.TICKET_OFFICE && (
                <div className="space-y-2">
                  <Label htmlFor="filter-company">Empresa</Label>
                  <Input
                    id="filter-company"
                    placeholder="Buscar por empresa..."
                    value={filters.company}
                    onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPackages.map((pkg: any) => (
          <Card 
            key={pkg.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setPackageToDetail(pkg);
              setIsDetailModalOpen(true);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Paquete #{pkg.id}</CardTitle>
                  <CardDescription className="text-sm">
                    {pkg.tripDepartureDate ? formatDate(new Date(pkg.tripDepartureDate)) : formatDate(new Date(pkg.createdAt))}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-600">
                    {formatCurrency(pkg.price)}
                  </p>
                  <div className="mt-1">
                    {pkg.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                        <Check className="mr-1 h-3 w-3" /> Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Descripción */}
              <div>
                <p className="text-xs text-muted-foreground font-medium">Descripción</p>
                <p className="text-sm font-medium truncate">
                  {pkg.packageDescription || "Sin descripción"}
                </p>
              </div>
              
              {/* Empresa - Solo para taquilla */}
              {user?.role === UserRole.TICKET_OFFICE && pkg.companyId && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Empresa</p>
                  <p className="text-sm font-medium text-orange-600 truncate">
                    {pkg.companyId}
                  </p>
                </div>
              )}
              
              {/* Detalles del Viaje */}
              <div>
                <p className="text-xs text-muted-foreground font-medium">Detalles del Viaje</p>
                <div className="text-sm space-y-1">
                  <div className="flex items-center text-blue-600">
                    <MapPin className="mr-1 h-3 w-3" />
                    <span className="truncate">{pkg.segmentOrigin || pkg.tripOrigin || "No disponible"}</span>
                  </div>
                  <div className="flex items-center text-red-600">
                    <MapPin className="mr-1 h-3 w-3" />
                    <span className="truncate">{pkg.segmentDestination || pkg.tripDestination || "No disponible"}</span>
                  </div>
                  {/* Horario de salida */}
                  {(pkg.tripDetails?.departureTime || pkg.tripDepartureTime) && (
                    <div className="flex items-center text-gray-600 mt-1">
                      <Clock className="mr-1 h-3 w-3" />
                      <span className="text-xs font-medium">
                        Salida: {pkg.tripDetails?.departureTime || pkg.tripDepartureTime}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Remitente y Destinatario */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Remitente</p>
                  <p className="font-medium truncate">{pkg.senderName} {pkg.senderLastName}</p>
                  <p className="text-xs text-muted-foreground">{pkg.senderPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Destinatario</p>
                  <p className="font-medium truncate">{pkg.recipientName} {pkg.recipientLastName}</p>
                  <p className="text-xs text-muted-foreground">{pkg.recipientPhone}</p>
                </div>
              </div>
              
              {/* Creado por */}
              {(pkg.creatorFirstName || pkg.creatorLastName) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground font-medium flex items-center">
                    <User className="mr-1 h-3 w-3" />
                    Creado por
                  </p>
                  <p className="text-sm font-medium text-blue-600">
                    {pkg.creatorFirstName} {pkg.creatorLastName}
                  </p>
                </div>
              )}

              {/* Operador asignado */}
              {(pkg.operatorFirstName || pkg.operatorLastName) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground font-medium flex items-center">
                    <User className="mr-1 h-3 w-3" />
                    Operador asignado
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    {pkg.operatorFirstName} {pkg.operatorLastName}
                  </p>
                </div>
              )}

              {/* Información de pagos y entregas */}
              {((pkg.isPaid && (pkg.paidByFirstName || pkg.paidByLastName)) || 
                (pkg.deliveryStatus === "entregado" && (pkg.deliveredByFirstName || pkg.deliveredByLastName))) && (
                <div className="pt-2 border-t space-y-1">
                  {pkg.isPaid && (pkg.paidByFirstName || pkg.paidByLastName) && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Marcado como pagado por</p>
                      <p className="text-sm font-medium text-green-600">
                        {pkg.paidByFirstName} {pkg.paidByLastName}
                      </p>
                    </div>
                  )}
                  {pkg.deliveryStatus === "entregado" && (pkg.deliveredByFirstName || pkg.deliveredByLastName) && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Marcado como entregado por</p>
                      <p className="text-sm font-medium text-green-600">
                        {pkg.deliveredByFirstName} {pkg.deliveredByLastName}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Estados y Asientos */}
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex gap-2 items-center">
                  {pkg.deliveryStatus === "entregado" ? (
                    <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                      <Check className="mr-1 h-3 w-3" /> Entregado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" /> Pendiente
                    </Badge>
                  )}
                  
                  {pkg.usesSeats && (
                    <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
                      {pkg.seatsQuantity} {pkg.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                    </Badge>
                  )}
                </div>
                
                {/* Acciones */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canCreateEdit && (
                        <DropdownMenuItem onClick={() => onEditPackage(pkg.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem asChild>
                        <Link href={`/package/${pkg.id}`} target="_blank">
                          <Share2 className="mr-2 h-4 w-4" />
                          Ver ficha pública
                        </Link>
                      </DropdownMenuItem>

                      <Dialog>
                        <DialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setPackageToView(pkg);
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Ver/Imprimir Ticket
                          </DropdownMenuItem>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Ticket de Paquete</DialogTitle>
                          </DialogHeader>
                          {packageToView && (
                            <div className="flex flex-col items-center space-y-4 pb-4">
                              <div className="w-full max-w-sm">
                                <PackageTicket 
                                  packageData={packageToView} 
                                  companyName={user?.company || "TransRoute"} 
                                />
                              </div>
                              <div className="flex flex-col gap-2 w-full max-w-sm">
                                <Button 
                                  onClick={handlePrintTicket} 
                                  className="w-full"
                                  size="lg"
                                >
                                  <Printer className="mr-2 h-4 w-4" />
                                  Imprimir Ticket
                                </Button>
                      
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      {canInteractWithPackage(pkg) && pkg.deliveryStatus !== "entregado" && (
                        <DropdownMenuItem
                          onClick={() => {
                            markAsDeliveredMutation.mutate(pkg.id);
                          }}
                          disabled={markAsDeliveredMutation.isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Marcar como Entregado
                        </DropdownMenuItem>
                      )}
                      
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPackageToDelete(pkg.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


      
      {/* Diálogo de confirmación para eliminar paquete */}
      <AlertDialog open={!!packageToDelete} onOpenChange={(open) => !open && setPackageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el paquete del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => packageToDelete && deletePackageMutation.mutate(packageToDelete)}
              disabled={deletePackageMutation.isPending}
            >
              {deletePackageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Modal de detalles de paquete */}
      <PackageDetailsModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        packageData={packageToDetail}
      />
    </div>
  );
}