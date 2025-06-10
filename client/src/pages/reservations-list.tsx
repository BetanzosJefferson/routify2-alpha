import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReservations } from "@/hooks/use-reservations";
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { Search, Calendar, MapPin, Users, CreditCard, Building2, User } from "lucide-react";
import { ReservationWithDetails } from "@shared/schema";
import DefaultLayout from "@/components/layout/default-layout";

function ReservationsListContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { 
    data: reservations = [], 
    isLoading, 
    error 
  } = useReservations({});

  // Filtrar reservaciones por término de búsqueda
  const filteredReservations = reservations.filter((reservation) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      reservation.id.toString().includes(searchLower) ||
      reservation.phone?.toLowerCase().includes(searchLower) ||
      reservation.email?.toLowerCase().includes(searchLower) ||
      reservation.trip?.origin?.toLowerCase().includes(searchLower) ||
      reservation.trip?.destination?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.firstName?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.lastName?.toLowerCase().includes(searchLower)
    );
  });

  // Paginación
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReservations = filteredReservations.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Confirmada</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'canceledAndRefund':
        return <Badge variant="destructive">Cancelada y reembolsada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pagado':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Pagado</Badge>;
      case 'anticipo':
        return <Badge variant="secondary">Anticipo</Badge>;
      case 'pendiente':
        return <Badge variant="outline">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{paymentStatus}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Cargando reservaciones...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-600">Error al cargar reservaciones</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Reservaciones en Lista</h1>
        <div className="text-sm text-gray-600">
          Total: {filteredReservations.length} reservaciones
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por ID, teléfono, email, origen, destino o usuario..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de reservaciones */}
      <div className="space-y-4">
        {paginatedReservations.map((reservation) => (
          <Card key={reservation.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Columna 1: Información básica */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-lg">#{reservation.id}</div>
                    {getStatusBadge(reservation.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(reservation.trip?.departureDate)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" />
                      {reservation.passengers?.length || 0} pasajeros
                    </div>
                  </div>
                </div>

                {/* Columna 2: Ruta */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">{reservation.trip?.origin}</div>
                      <div className="text-gray-500 text-xs">
                        {reservation.trip?.departureTime ? formatTime(reservation.trip.departureTime) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">{reservation.trip?.destination}</div>
                      <div className="text-gray-500 text-xs">
                        {reservation.trip?.arrivalTime ? formatTime(reservation.trip.arrivalTime) : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna 3: Contacto y pago */}
                <div className="space-y-2">
                  <div className="text-sm">
                    <div className="font-medium">{reservation.phone}</div>
                    <div className="text-gray-500 text-xs">{reservation.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3" />
                    {getPaymentBadge(reservation.paymentStatus)}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {formatPrice(reservation.totalAmount)}
                  </div>
                  {reservation.advanceAmount && (
                    <div className="text-xs text-gray-500">
                      Anticipo: {formatPrice(reservation.advanceAmount)}
                    </div>
                  )}
                </div>

                {/* Columna 4: Información adicional */}
                <div className="space-y-2">
                  {reservation.createdByUser && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3 w-3" />
                      <div>
                        <div className="font-medium">
                          {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {reservation.createdByUser.role}
                        </div>
                      </div>
                    </div>
                  )}
                  {reservation.companyId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-3 w-3" />
                      <div className="text-xs text-gray-500">
                        {reservation.companyId}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    Creada: {formatDate(reservation.createdAt)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {filteredReservations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchTerm ? 'No se encontraron reservaciones que coincidan con la búsqueda.' : 'No hay reservaciones disponibles.'}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReservationsListPage() {
  return (
    <DefaultLayout activeTab="reservations">
      <ReservationsListContent />
    </DefaultLayout>
  );
}