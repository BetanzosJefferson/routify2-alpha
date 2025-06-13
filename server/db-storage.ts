import * as schema from "@shared/schema";
import { 
  Route, 
  InsertRoute, 
  Trip, 
  InsertTrip, 
  Reservation, 
  InsertReservation, 
  Passenger, 
  InsertPassenger,
  RouteWithSegments,
  TripWithRouteInfo,
  ReservationWithDetails,
  SegmentPrice,
  Vehicle,
  InsertVehicle,
  Commission,
  InsertCommission
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lt, like, or, sql, isNotNull, isNull } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  private db = db;

  async getRoutes(companyId?: string): Promise<Route[]> {
    console.log(companyId ? `DB Storage: Consultando rutas para la compañía: ${companyId}` : "DB Storage: Consultando todas las rutas");
    
    try {
      // Si se proporciona un companyId, filtrar por compañía
      if (companyId) {
        // SEGURIDAD: Primero verificar si existen rutas para esta compañía
        const countQuery = await db
          .select({ count: sql`count(*)` })
          .from(schema.routes)
          .where(eq(schema.routes.companyId, companyId));
        
        const routeCount = parseInt(countQuery[0].count.toString());
        console.log(`DB Storage: Existen ${routeCount} rutas para compañía ${companyId}`);
        
        // Obtener las rutas filtradas
        const routes = await db
          .select()
          .from(schema.routes)
          .where(eq(schema.routes.companyId, companyId));
        
        console.log(`DB Storage: Rutas filtradas encontradas: ${routes.length}`);
        
        // Verificación adicional - imprimir datos para depuración
        if (routes.length > 0) {
          console.log(`DB Storage: Datos de rutas:`, JSON.stringify(routes));
        }
        
        return routes;
      }
      
      // Si no hay filtro, obtener todas las rutas
      const routes = await db.select().from(schema.routes);
      console.log(`DB Storage: Rutas encontradas: ${routes.length}`);
      return routes;
    } catch (error) {
      console.error(`DB Storage ERROR - getRoutes: ${error}`);
      return [];
    }
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    console.log("DB Storage: Creando ruta con los datos:", JSON.stringify(route));
    
    // Validación adicional para asegurar que rutas no superadmin tengan companyId
    if (!route.companyId) {
      console.log("DB Storage - ADVERTENCIA: Intento de crear ruta sin companyId");
    }
    
    const [newRoute] = await db.insert(schema.routes).values(route).returning();
    console.log("DB Storage: Ruta creada con ID:", newRoute.id, "CompanyId:", newRoute.companyId);
    return newRoute;
  }
  
  async updateRoute(id: number, routeUpdate: Partial<Route>): Promise<Route | undefined> {
    const [updatedRoute] = await db
      .update(schema.routes)
      .set(routeUpdate)
      .where(eq(schema.routes.id, id))
      .returning();
    return updatedRoute;
  }
  
  async deleteRoute(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.routes)
      .where(eq(schema.routes.id, id))
      .returning({ id: schema.routes.id });
    return result.length > 0;
  }
  
  async getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined> {
    const route = await this.getRoute(id);
    if (!route) return undefined;
    
    const segments: Array<{origin: string; destination: string; price?: number}> = [];
    
    // Generate all possible segments from the stops
    const stops = route.stops;
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        segments.push({
          origin: stops[i],
          destination: stops[j],
        });
      }
    }
    
    return {
      ...route,
      segments
    };
  }
  
  async getTrips(companyId?: string): Promise<TripWithRouteInfo[]> {
    console.log("DB Storage: Obteniendo viajes");
    const startTime = performance.now();
    
    // Construir la consulta base
    let query = db.select().from(schema.trips);
    
    // Si hay un companyId, filtrar por esa compañía
    if (companyId) {
      console.log(`DB Storage: Filtrando viajes por compañía: ${companyId}`);
      console.log(`DEBUG SQL: SELECT * FROM trips WHERE company_id = '${companyId}'`);
      query = query.where(eq(schema.trips.companyId, companyId));
    }
    
    // Ejecutar la consulta construida
    const trips = await query;
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para buscar rápidamente
    const companyMap = new Map();
    owners.forEach(owner => {
      const companyId = owner.companyId || owner.company;
      if (companyId) {
        companyMap.set(companyId, {
          companyName: owner.company,
          companyLogo: owner.profilePicture
        });
      }
    });
    
    // Imprimir el mapa de compañías para depuración
    console.log("Mapa de compañías:");
    companyMap.forEach((data, id) => {
      console.log(`Compañía ${id}: Nombre=${data.companyName}, Logo=${data.companyLogo ? "Sí" : "No"}`);
    });
    
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (route) {
        // Obtener datos de la compañía si existen
        let companyData = { companyName: undefined, companyLogo: undefined };
        if (trip.companyId && companyMap.has(trip.companyId)) {
          companyData = companyMap.get(trip.companyId);
          console.log(`Encontrados datos para compañía ${trip.companyId} en el viaje ${trip.id}`);
        } else if (trip.companyId) {
          console.log(`Viaje ${trip.id} tiene companyId=${trip.companyId} pero no se encontraron datos correspondientes`);
        } else {
          console.log(`Viaje ${trip.id} no tiene companyId`);
        }
        
        const tripWithInfo = {
          ...trip,
          route,
          numStops: route.stops.length,
          // Agregar información de la compañía
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo
        };
        
        // Verificar que los datos de la compañía estén presentes
        console.log(`Viaje ${trip.id} - companyName: ${tripWithInfo.companyName}, companyLogo: ${tripWithInfo.companyLogo}`);
        
        tripsWithRouteInfo.push(tripWithInfo);
      }
    }
    
    const endTime = performance.now();
    console.log(`getTrips-optimized: ${(endTime - startTime).toFixed(3)}ms`);
    
    return tripsWithRouteInfo;
  }
  
  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
    return trip;
  }
  
  async getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined> {
    const trip = await this.getTrip(id);
    if (!trip) return undefined;
    
    const route = await this.getRoute(trip.routeId);
    if (!route) return undefined;
    
    // Obtener información de la compañía si existe companyId
    let companyName = undefined;
    let companyLogo = undefined;
    
    if (trip.companyId) {
      // Buscar el dueño de la compañía para obtener el nombre y logo
      const [owner] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, schema.UserRole.OWNER),
            or(
              eq(schema.users.companyId, trip.companyId),
              eq(schema.users.company, trip.companyId)
            )
          )
        );
      
      if (owner) {
        companyName = owner.company;
        companyLogo = owner.profilePicture;
      }
    }
    
    return {
      ...trip,
      route,
      numStops: route.stops.length,
      companyName,
      companyLogo
    };
  }
  
  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [newTrip] = await db.insert(schema.trips).values(trip).returning();
    return newTrip;
  }
  
  async updateTrip(id: number, tripUpdate: Partial<Trip>): Promise<Trip | undefined> {
    const [updatedTrip] = await db
      .update(schema.trips)
      .set(tripUpdate)
      .where(eq(schema.trips.id, id))
      .returning();
    return updatedTrip;
  }
  
  async deleteTrip(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.trips)
      .where(eq(schema.trips.id, id))
      .returning({ id: schema.trips.id });
    return result.length > 0;
  }
  
  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    dateRange?: string[];
    seats?: number;
    companyId?: string;
    companyIds?: string[];
    driverId?: number;
    visibility?: string;
    includeAllVisibilities?: boolean;
    optimizedResponse?: boolean;
  }): Promise<TripWithRouteInfo[]> {
    console.log(`[searchTrips] Iniciando búsqueda con parámetros:`, params);
    
    // Construir los filtros como un array de condiciones 
    const condiciones = [];
    
    // Aplicar filtro de visibilidad
    if (params.includeAllVisibilities) {
      console.log(`[searchTrips] Incluyendo TODOS los estados de visibilidad`);
    } else if (params.visibility) {
      console.log(`[searchTrips] Filtro por visibilidad: ${params.visibility}`);
      condiciones.push(eq(schema.trips.visibility, params.visibility));
    } else {
      // Por defecto, solo mostrar viajes publicados
      condiciones.push(eq(schema.trips.visibility, 'publicado'));
      console.log(`[searchTrips] Aplicando filtro predeterminado: solo viajes publicados`);
    }
    
    // Filtrado por compañía
    if (params.companyIds && params.companyIds.length > 0) {
      console.log(`[searchTrips] FILTRADO MÚLTIPLE POR COMPAÑÍAS: [${params.companyIds.join(', ')}]`);
      // Para múltiples compañías usamos OR
      const companyConditions = params.companyIds.map(id => eq(schema.trips.companyId, id));
      condiciones.push(or(...companyConditions));
    } else if (params.companyId) {
      if (params.companyId === 'ALL') {
        console.log(`[searchTrips] ACCESO TOTAL: Sin filtrar por compañía`);
      } else {
        console.log(`[searchTrips] FILTRADO POR COMPAÑÍA: "${params.companyId}"`);
        condiciones.push(eq(schema.trips.companyId, params.companyId));
      }
    }
    
    // Aplicar filtro de fecha o rango de fechas usando JSONB
    if (params.dateRange && params.dateRange.length > 0) {
      console.log(`[searchTrips] Filtro por rango de fechas:`, params.dateRange);
      
      const dateConditions = params.dateRange.map(date => {
        return sql`DATE(${schema.trips.tripData}->>'departureDate') = ${date}`;
      });
      
      if (dateConditions.length === 1) {
        condiciones.push(dateConditions[0]);
      } else {
        condiciones.push(or(...dateConditions));
      }
    } else if (params.date) {
      console.log(`[searchTrips] Filtro de fecha individual: ${params.date}`);
      condiciones.push(sql`DATE(${schema.trips.tripData}->>'departureDate') = ${params.date}`);
    }
    
    // Aplicar filtro por conductor (driverId)
    if (params.driverId) {
      console.log(`[searchTrips] Filtro por conductor ID: ${params.driverId}`);
      condiciones.push(eq(schema.trips.driverId, params.driverId));
    }
    
    // Aplicar filtro de asientos
    if (params.seats) {
      console.log(`[searchTrips] Filtro: Mínimo ${params.seats} asientos disponibles`);
      condiciones.push(gte(schema.trips.availableSeats, params.seats));
    }
    
    // Ejecutar consulta con todas las condiciones
    let trips;
    
    if (condiciones.length > 0) {
      const whereClause = condiciones.length === 1 ? condiciones[0] : and(...condiciones);
      console.log(`[searchTrips] Ejecutando consulta con ${condiciones.length} filtros`);
      trips = await db.select().from(schema.trips).where(whereClause);
    } else {
      console.log(`[searchTrips] Ejecutando consulta SIN FILTROS`);
      trips = await db.select().from(schema.trips);
    }
    
    console.log(`[searchTrips] Encontrados ${trips.length} viajes que coinciden con los filtros SQL`);
    
    // Get all routes in a single query for better performance
    const routes = await db.select().from(schema.routes);
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para búsqueda rápida
    const companyMap = new Map();
    owners.forEach(owner => {
      const companyId = owner.companyId || owner.company;
      if (companyId) {
        companyMap.set(companyId, {
          companyName: owner.company,
          companyLogo: owner.profilePicture
        });
      }
    });
    
    // Create map for quick lookups
    const routeMap = new Map<number, Route>();
    routes.forEach(route => {
      routeMap.set(route.id, route);
    });
    
    // Obtener todos los vehículos en una sola consulta
    const vehicles = await db.select().from(schema.vehicles);
    
    // Crear un mapa de vehículos para búsqueda rápida
    const vehicleMap = new Map<number, schema.Vehicle>();
    vehicles.forEach(vehicle => {
      vehicleMap.set(vehicle.id, vehicle);
    });
    
    // Obtener todos los conductores (choferes) en una sola consulta
    const drivers = await db
      .select()
      .from(schema.users)
      .where(
        or(
          eq(schema.users.role, "chofer"),
          eq(schema.users.role, "CHOFER"),
          eq(schema.users.role, "Chofer"),
          eq(schema.users.role, "driver"),
          eq(schema.users.role, "DRIVER"),
          eq(schema.users.role, "Driver")
        )
      );
    
    // Crear un mapa de conductores para búsqueda rápida
    const driverMap = new Map<number, schema.User>();
    drivers.forEach(driver => {
      driverMap.set(driver.id, driver);
    });
    
    console.log(`Cargados ${vehicles.length} vehículos y ${drivers.length} conductores para búsqueda rápida`);
    
    // Determinar el modo de respuesta basado en el flag optimizedResponse
    const shouldReturnOptimized = params.optimizedResponse === true;
    
    console.log(`[searchTrips] optimizedResponse flag: ${params.optimizedResponse}`);
    console.log(`[searchTrips] shouldReturnOptimized: ${shouldReturnOptimized}`);
    console.log(`[searchTrips] Modo de respuesta: ${shouldReturnOptimized ? 'OPTIMIZADO' : 'EXPANDIDO'}`);
    
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = routeMap.get(trip.routeId);
      if (!route) continue;
      
      // Parse tripData JSON array
      let tripDataArray = [];
      try {
        tripDataArray = Array.isArray(trip.tripData) ? trip.tripData : JSON.parse(trip.tripData as string);
        console.log(`[searchTrips] Trip ${trip.id} has ${tripDataArray.length} segments in tripData`);
      } catch (error) {
        console.warn(`[searchTrips] Error parsing tripData for trip ${trip.id}:`, error);
        continue;
      }
      
      // Buscar información de la compañía si existe
      let companyData = { companyName: undefined, companyLogo: undefined };
      if (trip.companyId && companyMap.has(trip.companyId)) {
        companyData = companyMap.get(trip.companyId);
      }
      
      // Buscar vehículo asignado
      let assignedVehicle = undefined;
      if (trip.vehicleId && vehicleMap.has(trip.vehicleId)) {
        assignedVehicle = vehicleMap.get(trip.vehicleId);
      }
      
      // Buscar conductor asignado
      let assignedDriver = undefined;
      if (trip.driverId && driverMap.has(trip.driverId)) {
        assignedDriver = driverMap.get(trip.driverId);
      }
      
      if (shouldReturnOptimized) {
        // MODO OPTIMIZADO: Retornar un solo objeto por viaje sin expansión de segmentos
        console.log(`[searchTrips] Modo optimizado: Procesando viaje ${trip.id} como objeto único`);
        
        // Usar el primer segmento como representativo del viaje completo
        const firstSegment = tripDataArray[0];
        if (firstSegment) {
          tripsWithRouteInfo.push({
            ...trip,
            // Mantener ID original para viaje principal
            id: trip.id,
            // Usar datos del primer segmento como representativos
            origin: route.origin,
            destination: route.destination,
            departureDate: firstSegment.departureDate,
            departureTime: firstSegment.departureTime,
            arrivalTime: tripDataArray[tripDataArray.length - 1]?.arrivalTime || firstSegment.arrivalTime,
            price: firstSegment.price,
            availableSeats: firstSegment.availableSeats,
            // Solo metadatos esenciales, NO incluir tripData completo ni logos
            route: {
              id: route.id,
              name: route.name,
              origin: route.origin,
              destination: route.destination,
              stops: route.stops,
              companyId: route.companyId
            },
            numStops: route.stops.length,
            companyName: companyData.companyName,
            // NO incluir companyLogo para reducir payload
            assignedVehicle: assignedVehicle ? {
              id: assignedVehicle.id,
              model: assignedVehicle.model,
              plateNumber: assignedVehicle.plateNumber
            } : undefined,
            assignedDriver: assignedDriver ? {
              id: assignedDriver.id,
              firstName: assignedDriver.firstName,
              lastName: assignedDriver.lastName
            } : undefined
          });
        }
      } else {
        // MODO EXPANDIDO: Process each segment in the tripData array
        for (let segmentIndex = 0; segmentIndex < tripDataArray.length; segmentIndex++) {
        const segment = tripDataArray[segmentIndex];
        console.log(`[searchTrips] Processing segment ${segmentIndex} for trip ${trip.id}:`, {
          origin: segment.origin,
          destination: segment.destination,
          price: segment.price,
          availableSeats: segment.availableSeats
        });
        
        // Check origin and destination filters
        let originMatch = !params.origin;
        let destMatch = !params.destination;
        
        if (params.origin) {
          const searchOrigin = params.origin.toLowerCase();
          originMatch = segment.origin?.toLowerCase().includes(searchOrigin);
        }
        
        if (params.destination) {
          const searchDest = params.destination.toLowerCase();
          destMatch = segment.destination?.toLowerCase().includes(searchDest);
        }
        
        // Check seat availability filter
        let seatMatch = !params.seats || (segment.availableSeats >= params.seats);
        
        console.log(`[searchTrips] Segment ${segmentIndex} filters - origin: ${originMatch}, dest: ${destMatch}, seats: ${seatMatch}`);
        
        // Only include segment if it matches all filters
        if (originMatch && destMatch && seatMatch) {
          // Create a unique identifier for this segment using recordId_segmentIndex format
          const uniqueTripId = `${trip.id}_${segmentIndex}`;
          
          // Create a trip object that combines the base trip with segment data
          const expandedTrip = {
            ...trip,
            // Use the unique trip ID for frontend compatibility
            id: uniqueTripId,
            // Override with segment-specific data for frontend compatibility
            origin: segment.origin,
            destination: segment.destination,
            departureDate: segment.departureDate,
            departureTime: segment.departureTime,
            arrivalTime: segment.arrivalTime,
            price: segment.price,
            availableSeats: segment.availableSeats,
            tripId: segment.tripId,
            isMainTrip: segment.isMainTrip,
            // Store original record ID for reservations
            recordId: trip.id,
            // Add route and company info
            route,
            numStops: route.stops.length,
            companyName: companyData.companyName,
            companyLogo: companyData.companyLogo,
            assignedVehicle,
            assignedDriver
          };
          
          console.log(`[searchTrips] Adding expanded trip ${uniqueTripId} with origin: ${expandedTrip.origin}, destination: ${expandedTrip.destination}`);
          tripsWithRouteInfo.push(expandedTrip as TripWithRouteInfo);
        }
        }
      }
    }
    
    return tripsWithRouteInfo;
  }
  
  async updateRelatedTripsAvailability(recordId: number, tripId: string, seatChange: number): Promise<void> {
    // Obtener el registro principal del viaje
    const tripRecord = await this.getTrip(recordId);
    if (!tripRecord || !tripRecord.tripData || !Array.isArray(tripRecord.tripData)) return;
    
    // Extraer el índice del tripId específico (ej: "10_2" -> índice 2)
    const segmentIndex = parseInt(tripId.split('_')[1]);
    if (isNaN(segmentIndex) || segmentIndex >= tripRecord.tripData.length) return;
    
    const isReducingSeats = seatChange < 0;
    const absoluteChange = Math.abs(seatChange);
    
    console.log(`[updateRelatedTripsAvailability] Actualizando registro ${recordId}, segmento ${tripId} con cambio de ${seatChange} asientos`);
    
    // Obtener el segmento específico reservado
    const reservedSegment = tripRecord.tripData[segmentIndex];
    if (!reservedSegment) return;
    
    // Obtener información de la ruta para determinar el orden de las paradas
    const routeInfo = await this.getRouteWithSegments(tripRecord.routeId);
    if (!routeInfo) return;
    
    // Crear array con todas las paradas en orden
    const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
    
    // Encontrar índices de las ubicaciones del segmento reservado
    const reservedOriginIdx = allStops.indexOf(reservedSegment.origin);
    const reservedDestinationIdx = allStops.indexOf(reservedSegment.destination);
    
    if (reservedOriginIdx === -1 || reservedDestinationIdx === -1) return;
    
    // Clonar el array tripData para modificarlo
    const updatedTripData = [...tripRecord.tripData];
    
    // Actualizar todos los segmentos que se superponen con el reservado
    for (let i = 0; i < updatedTripData.length; i++) {
      const segment = updatedTripData[i];
      
      // Encontrar índices de este segmento
      const segmentOriginIdx = allStops.indexOf(segment.origin);
      const segmentDestinationIdx = allStops.indexOf(segment.destination);
      
      if (segmentOriginIdx === -1 || segmentDestinationIdx === -1) continue;
      
      // Verificar si este segmento se superpone con el segmento reservado
      const hasOverlap = reservedOriginIdx < segmentDestinationIdx && reservedDestinationIdx > segmentOriginIdx;
      
      if (hasOverlap) {
        // Actualizar asientos disponibles del segmento superpuesto
        const currentSeats = segment.availableSeats || tripRecord.capacity || 0;
        let newSeats;
        
        if (isReducingSeats) {
          newSeats = Math.max(currentSeats - absoluteChange, 0);
        } else {
          newSeats = Math.min(currentSeats + absoluteChange, tripRecord.capacity || currentSeats);
        }
        
        updatedTripData[i] = {
          ...segment,
          availableSeats: newSeats
        };
        
        console.log(`[updateRelatedTripsAvailability] Segmento ${recordId}_${i} (${segment.origin} → ${segment.destination}): ${currentSeats} → ${newSeats} asientos`);
      }
    }
    
    // Actualizar el registro en la base de datos con el tripData modificado
    await db
      .update(schema.trips)
      .set({ tripData: updatedTripData })
      .where(eq(schema.trips.id, recordId));
  }
  
  async getReservations(companyId?: string): Promise<ReservationWithDetails[]> {
    console.log("DB Storage: Consultando reservaciones");
    
    // Primero, definimos la consulta base
    let query = db.select().from(schema.reservations);
    
    // Si hay un companyId, filtrar directamente por ese campo en la tabla de reservaciones
    if (companyId) {
      console.log(`DB Storage: Filtrando reservaciones por compañía: ${companyId}`);
      query = query.where(eq(schema.reservations.companyId, companyId));
    }
    
    // Ejecutar la consulta
    const reservations = await query;
    console.log(`DB Storage: Reservaciones encontradas: ${reservations.length}`);
    
    const reservationsWithDetails: ReservationWithDetails[] = [];
    
    // Para cada reservación, extraemos los datos del trip desde tripDetails JSON
    for (const reservation of reservations) {
      let tripDetails = null;
      
      try {
        // Parse tripDetails JSON que contiene {recordId, tripId, seats}
        tripDetails = typeof reservation.tripDetails === 'string' 
          ? JSON.parse(reservation.tripDetails) 
          : reservation.tripDetails;
      } catch (error) {
        console.warn(`Error parsing tripDetails for reservation ${reservation.id}:`, error);
        continue;
      }
      
      if (!tripDetails || !tripDetails.recordId || !tripDetails.tripId) {
        console.warn(`Invalid tripDetails for reservation ${reservation.id}:`, tripDetails);
        continue;
      }
      
      // Obtener el trip record usando recordId desde tripDetails
      const tripRecord = await this.getTrip(tripDetails.recordId);
      if (!tripRecord) {
        console.warn(`Trip record ${tripDetails.recordId} not found for reservation ${reservation.id}`);
        continue;
      }
      
      // Parse tripData JSON array para encontrar el segmento específico
      let tripDataArray = [];
      try {
        tripDataArray = Array.isArray(tripRecord.tripData) ? tripRecord.tripData : JSON.parse(tripRecord.tripData as string);
      } catch (error) {
        console.warn(`Error parsing tripData for trip ${tripRecord.id}:`, error);
        continue;
      }
      
      // Encontrar el segmento específico usando tripId (formato: "recordId_segmentIndex")
      const segmentIndex = parseInt(tripDetails.tripId.split('_')[1]);
      const tripSegment = tripDataArray[segmentIndex];
      
      if (!tripSegment) {
        console.warn(`Trip segment ${tripDetails.tripId} not found in trip ${tripRecord.id}`);
        continue;
      }
      
      // Obtener información de la ruta
      const route = await this.getRoute(tripRecord.routeId);
      if (!route) {
        console.warn(`Route ${tripRecord.routeId} not found for trip ${tripRecord.id}`);
        continue;
      }
      
      // Obtener información de pasajeros
      const passengers = await this.getPassengers(reservation.id);
      
      // Obtener información del usuario que creó la reservación
      let createdByUser = null;
      if (reservation.createdBy) {
        try {
          const [user] = await db.select().from(schema.users).where(eq(schema.users.id, reservation.createdBy));
          if (user) {
            createdByUser = {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role
            };
          }
        } catch (error) {
          console.warn(`Error fetching created_by user ${reservation.createdBy}:`, error);
          // Fallback to avoid blocking the reservation data
          createdByUser = {
            id: reservation.createdBy,
            firstName: "Usuario",
            lastName: "Desconocido",
            email: "no-disponible@example.com",
            role: "usuario"
          };
        }
      }
      
      // Buscar el segmento principal (isMainTrip: true) para información del viaje padre
      const mainTripSegment = tripDataArray.find(segment => segment.isMainTrip === true);
      
      // Crear objeto trip compatible con el frontend usando datos del segmento específico
      const trip = {
        id: tripDetails.tripId, // Use the specific segment ID
        recordId: tripRecord.id,
        routeId: tripRecord.routeId,
        route: route,
        origin: tripSegment.origin,
        destination: tripSegment.destination,
        departureDate: tripSegment.departureDate,
        departureTime: tripSegment.departureTime,
        arrivalTime: tripSegment.arrivalTime,
        price: tripSegment.price,
        availableSeats: tripSegment.availableSeats,
        capacity: tripRecord.capacity,
        companyId: tripRecord.companyId,
        visibility: tripRecord.visibility,
        // Información del viaje padre para agrupación en frontend
        parentTrip: mainTripSegment ? {
          origin: mainTripSegment.origin,
          destination: mainTripSegment.destination,
          departureDate: mainTripSegment.departureDate,
          departureTime: mainTripSegment.departureTime,
          arrivalTime: mainTripSegment.arrivalTime,
          isMainTrip: true
        } : null
      };
      
      reservationsWithDetails.push({
        ...reservation,
        trip,
        passengers,
        createdByUser
      });
    }
    
    console.log(`DB Storage: Reservaciones procesadas: ${reservationsWithDetails.length}`);
    return reservationsWithDetails;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
    return reservation;
  }
  
  async getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined> {
    const reservation = await this.getReservation(id);
    if (!reservation) return undefined;
    
    // Parse tripDetails JSON para obtener información del viaje
    let tripDetails;
    try {
      tripDetails = typeof reservation.tripDetails === 'string' 
        ? JSON.parse(reservation.tripDetails) 
        : reservation.tripDetails;
    } catch (error) {
      console.warn(`Error parsing tripDetails for reservation ${reservation.id}:`, error);
      return undefined;
    }
    
    if (!tripDetails || !tripDetails.recordId || !tripDetails.tripId) {
      console.warn(`Invalid tripDetails for reservation ${reservation.id}:`, tripDetails);
      return undefined;
    }
    
    // Obtener el trip record usando recordId desde tripDetails
    const tripRecord = await this.getTrip(tripDetails.recordId);
    if (!tripRecord) {
      console.warn(`Trip record ${tripDetails.recordId} not found for reservation ${reservation.id}`);
      return undefined;
    }
    
    // Parse tripData JSON array para encontrar el segmento específico
    let tripDataArray = [];
    try {
      tripDataArray = Array.isArray(tripRecord.tripData) ? tripRecord.tripData : JSON.parse(tripRecord.tripData as string);
    } catch (error) {
      console.warn(`Error parsing tripData for trip ${tripRecord.id}:`, error);
      return undefined;
    }
    
    // Encontrar el segmento específico usando tripId (formato: "recordId_segmentIndex")
    const segmentIndex = parseInt(tripDetails.tripId.split('_')[1]);
    const tripSegment = tripDataArray[segmentIndex];
    
    if (!tripSegment) {
      console.warn(`Trip segment ${tripDetails.tripId} not found in trip ${tripRecord.id}`);
      return undefined;
    }
    
    // Obtener información de la ruta
    const route = await this.getRoute(tripRecord.routeId);
    if (!route) {
      console.warn(`Route ${tripRecord.routeId} not found for trip ${tripRecord.id}`);
      return undefined;
    }
    
    // Si se proporciona companyId, verificar que el viaje pertenezca a esa compañía
    if (companyId && tripRecord.companyId !== companyId) {
      console.log(`Acceso denegado: El viaje ${tripRecord.id} pertenece a la compañía ${tripRecord.companyId} pero se solicita acceso desde la compañía ${companyId}`);
      return undefined;
    }
    
    // Obtener información de pasajeros
    const passengers = await this.getPassengers(reservation.id);
    
    // Obtener información del usuario que creó la reservación
    let createdByUser = null;
    if (reservation.createdBy) {
      try {
        const [user] = await db.select().from(schema.users).where(eq(schema.users.id, reservation.createdBy));
        if (user) {
          createdByUser = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
          };
        }
      } catch (error) {
        console.warn(`Error fetching created_by user ${reservation.createdBy}:`, error);
        createdByUser = {
          id: reservation.createdBy,
          firstName: "Usuario",
          lastName: "Desconocido",
          email: "no-disponible@example.com",
          role: "usuario"
        };
      }
    }
    
    // Crear objeto trip compatible con el frontend usando datos del segmento específico
    const trip = {
      id: tripDetails.tripId,
      recordId: tripRecord.id,
      routeId: tripRecord.routeId,
      route: route,
      origin: tripSegment.origin,
      destination: tripSegment.destination,
      departureDate: tripSegment.departureDate,
      departureTime: tripSegment.departureTime,
      arrivalTime: tripSegment.arrivalTime,
      price: tripSegment.price,
      availableSeats: tripSegment.availableSeats,
      capacity: tripRecord.capacity,
      companyId: tripRecord.companyId,
      visibility: tripRecord.visibility
    };
    
    return {
      ...reservation,
      trip,
      passengers,
      createdByUser
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    // Si no se proporciona un companyId, intentamos obtenerlo del viaje relacionado
    if (!reservation.companyId) {
      const trip = await this.getTrip(reservation.tripId);
      if (trip && trip.companyId) {
        console.log(`Heredando companyId ${trip.companyId} del viaje ${trip.id} para la nueva reservación`);
        reservation.companyId = trip.companyId;
      } else {
        console.warn(`No se pudo obtener companyId del viaje ${reservation.tripId}. La reservación no tendrá companyId.`);
      }
    }
    
    console.log("Creando reservación con datos:", JSON.stringify(reservation, null, 2));
    const [newReservation] = await db.insert(schema.reservations).values(reservation).returning();
    return newReservation;
  }
  
  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    const [updatedReservation] = await db
      .update(schema.reservations)
      .set(reservationUpdate)
      .where(eq(schema.reservations.id, id))
      .returning();
    return updatedReservation;
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.reservations)
      .where(eq(schema.reservations.id, id))
      .returning({ id: schema.reservations.id });
    return result.length > 0;
  }
  
  async getPassengers(reservationId: number): Promise<Passenger[]> {
    return await db
      .select()
      .from(schema.passengers)
      .where(eq(schema.passengers.reservationId, reservationId));
  }
  
  async createPassenger(passenger: InsertPassenger): Promise<Passenger> {
    const [newPassenger] = await db.insert(schema.passengers).values(passenger).returning();
    return newPassenger;
  }
  
  async deletePassengersByReservation(reservationId: number): Promise<boolean> {
    const result = await db
      .delete(schema.passengers)
      .where(eq(schema.passengers.reservationId, reservationId))
      .returning({ id: schema.passengers.id });
    return result.length > 0;
  }
  
  // Métodos para gestión de vehículos (unidades)
  async getVehicles(companyId?: string): Promise<Vehicle[]> {
    console.log("DB Storage: Consultando vehículos");
    
    // Definir la consulta base
    let query = db.select().from(schema.vehicles);
    
    // Si hay un companyId, filtrar directamente por ese campo
    if (companyId) {
      console.log(`DB Storage: Filtrando vehículos por compañía: ${companyId}`);
      query = query.where(eq(schema.vehicles.companyId, companyId));
    }
    
    // Ejecutar la consulta
    const vehicles = await query;
    console.log(`DB Storage: Vehículos encontrados: ${vehicles.length}`);
    
    return vehicles;
  }
  
  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id));
    return vehicle;
  }
  
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    console.log("Creando vehículo con datos:", JSON.stringify(vehicle, null, 2));
    
    // Aseguramos que los valores opcionales sean correctamente manejados
    const vehicleData = {
      plates: vehicle.plates,
      brand: vehicle.brand,
      model: vehicle.model,
      economicNumber: vehicle.economicNumber,
      capacity: vehicle.capacity,
      hasAC: vehicle.hasAC === true,
      hasRecliningSeats: vehicle.hasRecliningSeats === true,
      services: Array.isArray(vehicle.services) ? vehicle.services : [],
      description: vehicle.description || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const [newVehicle] = await db.insert(schema.vehicles).values(vehicleData).returning();
    return newVehicle;
  }
  
  async updateVehicle(id: number, vehicleUpdate: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await db
      .update(schema.vehicles)
      .set(vehicleUpdate)
      .where(eq(schema.vehicles.id, id))
      .returning();
    return updatedVehicle;
  }
  
  async deleteVehicle(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.vehicles)
      .where(eq(schema.vehicles.id, id))
      .returning({ id: schema.vehicles.id });
    return result.length > 0;
  }
  
  // Métodos para gestión de comisiones
  async getCommissions(): Promise<Commission[]> {
    return await db.select().from(schema.commissions);
  }
  
  async getCommission(id: number): Promise<Commission | undefined> {
    const [commission] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
    return commission;
  }
  
  async createCommission(commission: InsertCommission): Promise<Commission> {
    const [newCommission] = await db.insert(schema.commissions).values(commission).returning();
    return newCommission;
  }
  
  async updateCommission(id: number, commissionUpdate: Partial<Commission>): Promise<Commission | undefined> {
    const [updatedCommission] = await db
      .update(schema.commissions)
      .set(commissionUpdate)
      .where(eq(schema.commissions.id, id))
      .returning();
    return updatedCommission;
  }
  
  async deleteCommission(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.commissions)
      .where(eq(schema.commissions.id, id))
      .returning({ id: schema.commissions.id });
    return result.length > 0;
  }

  // Transactions methods
  async createTransaccion(transaccionData: schema.InsertTransaccion): Promise<schema.Transaccion> {
    console.log("[DatabaseStorage] Creando transacción:", JSON.stringify(transaccionData, null, 2));
    
    try {
      const [newTransaction] = await db
        .insert(schema.transacciones)
        .values(transaccionData)
        .returning();
      
      console.log("[DatabaseStorage] Transacción creada exitosamente con ID:", newTransaction.id);
      return newTransaction;
    } catch (error) {
      console.error("[DatabaseStorage] Error al crear transacción:", error);
      throw error;
    }
  }

  async getTransacciones(filters?: any): Promise<schema.Transaccion[]> {
    try {
      const conditions = [];
      
      if (filters?.user_id) {
        conditions.push(eq(schema.transacciones.user_id, filters.user_id));
      }
      
      if (filters?.cutoff_id !== undefined) {
        if (filters.cutoff_id === null) {
          conditions.push(isNull(schema.transacciones.cutoff_id));
        } else {
          conditions.push(eq(schema.transacciones.cutoff_id, filters.cutoff_id));
        }
      }
      
      if (filters?.cutoff_id_not_null) {
        conditions.push(isNotNull(schema.transacciones.cutoff_id));
      }
      
      if (filters?.companyId) {
        conditions.push(eq(schema.transacciones.companyId, filters.companyId));
      }
      
      if (filters?.startDate) {
        conditions.push(gte(schema.transacciones.createdAt, filters.startDate));
      }

      const query = conditions.length > 0 
        ? this.db.select().from(schema.transacciones).where(and(...conditions))
        : this.db.select().from(schema.transacciones);
      
      const transactions = await query;
      return transactions;
    } catch (error) {
      console.error("[DatabaseStorage] Error al obtener transacciones:", error);
      return [];
    }
  }

  async getTransactionsByCompanyExcludingUser(companyId: string, excludeUserId: number): Promise<schema.Transaccion[]> {
    try {
      const transactions = await db
        .select()
        .from(schema.transacciones)
        .where(
          and(
            eq(schema.transacciones.companyId, companyId),
            sql`${schema.transacciones.user_id} != ${excludeUserId}`
          )
        );
      
      return transactions;
    } catch (error) {
      console.error("[DatabaseStorage] Error al obtener transacciones por compañía:", error);
      return [];
    }
  }

  async createBoxCutoff(cutoffData: schema.InsertBoxCutoff): Promise<schema.BoxCutoff> {
    const [cutoff] = await this.db
      .insert(schema.boxCutoff)
      .values(cutoffData)
      .returning();
    return cutoff;
  }

  async updateTransaccion(id: number, data: Partial<schema.Transaccion>, userId?: number): Promise<schema.Transaccion | undefined> {
    try {
      const whereClause = userId 
        ? and(eq(schema.transacciones.id, id), eq(schema.transacciones.user_id, userId))
        : eq(schema.transacciones.id, id);

      const [updated] = await this.db
        .update(schema.transacciones)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(whereClause)
        .returning();

      return updated;
    } catch (error) {
      console.error("[DatabaseStorage] Error al actualizar transacción:", error);
      return undefined;
    }
  }

  async deleteTransaccion(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.transacciones)
        .where(eq(schema.transacciones.id, id));
      
      return result.rowCount > 0;
    } catch (error) {
      console.error("[DatabaseStorage] Error al eliminar transacción:", error);
      return false;
    }
  }

  async getTransaccionesByReservation(reservationId: number): Promise<schema.Transaccion[]> {
    try {
      console.log(`[DatabaseStorage] Buscando todas las transacciones para reservación ${reservationId}`);
      
      const transactions = await this.db
        .select()
        .from(schema.transacciones)
        .where(
          and(
            eq(sql`details->>'type'`, 'reservation'),
            eq(sql`details->'details'->>'id'`, reservationId.toString())
          )
        );
      
      console.log(`[DatabaseStorage] Encontradas ${transactions.length} transacciones para reservación ${reservationId}`);
      return transactions;
    } catch (error) {
      console.error("[DatabaseStorage] Error al buscar transacciones por reservación:", error);
      return [];
    }
  }

  // Métodos para gestión de usuarios
  async getUsers(companyId?: string): Promise<schema.User[]> {
    console.log("DB Storage: Consultando usuarios");
    
    try {
      // Si se proporciona companyId, filtrar por esa compañía
      if (companyId) {
        console.log(`DB Storage: Filtrando usuarios por compañía: ${companyId}`);
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.companyId, companyId));
        
        console.log(`DB Storage: Usuarios encontrados para compañía ${companyId}: ${users.length}`);
        return users;
      }
      
      // Si no hay companyId, devolver todos los usuarios
      const users = await db.select().from(schema.users);
      console.log(`DB Storage: Total usuarios encontrados: ${users.length}`);
      return users;
    } catch (error) {
      console.error("DB Storage: Error al obtener usuarios:", error);
      throw error;
    }
  }

  async getAllUsers(): Promise<schema.User[]> {
    console.log("DB Storage: Consultando todos los usuarios (sin filtro de compañía)");
    
    try {
      const users = await db.select().from(schema.users);
      console.log(`DB Storage: Total usuarios encontrados: ${users.length}`);
      return users;
    } catch (error) {
      console.error("DB Storage: Error al obtener todos los usuarios:", error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<schema.User | undefined> {
    console.log(`DB Storage: Consultando usuario por ID: ${id}`);
    
    try {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id));
      
      if (user) {
        console.log(`DB Storage: Usuario encontrado: ${user.firstName} ${user.lastName} (${user.email})`);
      } else {
        console.log(`DB Storage: Usuario con ID ${id} no encontrado`);
      }
      
      return user;
    } catch (error) {
      console.error(`DB Storage: Error al obtener usuario ${id}:`, error);
      throw error;
    }
  }

  async getUsersByCompany(companyId: string): Promise<schema.User[]> {
    console.log(`DB Storage: Consultando usuarios por compañía: ${companyId}`);
    
    try {
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.companyId, companyId));
      
      console.log(`DB Storage: Usuarios encontrados para compañía ${companyId}: ${users.length}`);
      return users;
    } catch (error) {
      console.error(`DB Storage: Error al obtener usuarios por compañía ${companyId}:`, error);
      throw error;
    }
  }

  async getUsersByCompanyAndRole(companyId: string, role: string): Promise<schema.User[]> {
    console.log(`DB Storage: Consultando usuarios por compañía ${companyId} y rol ${role}`);
    
    try {
      const users = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.companyId, companyId),
            eq(schema.users.role, role)
          )
        );
      
      console.log(`DB Storage: Usuarios encontrados para compañía ${companyId} y rol ${role}: ${users.length}`);
      return users;
    } catch (error) {
      console.error(`DB Storage: Error al obtener usuarios por compañía ${companyId} y rol ${role}:`, error);
      throw error;
    }
  }

  async updateUser(id: number, userUpdate: Partial<schema.User>): Promise<schema.User | undefined> {
    console.log(`DB Storage: Actualizando usuario ${id} con datos:`, JSON.stringify(userUpdate, null, 2));
    
    try {
      // Agregar timestamp de actualización
      const updateData = {
        ...userUpdate,
        updatedAt: new Date()
      };
      
      const [updatedUser] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning();
      
      if (updatedUser) {
        console.log(`DB Storage: Usuario ${id} actualizado exitosamente`);
        // No loggear datos sensibles como password
        const safeUserData = {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          role: updatedUser.role,
          companyId: updatedUser.companyId,
          commissionPercentage: updatedUser.commissionPercentage
        };
        console.log(`DB Storage: Datos actualizados:`, JSON.stringify(safeUserData, null, 2));
      } else {
        console.log(`DB Storage: No se pudo actualizar el usuario ${id}`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error(`DB Storage: Error al actualizar usuario ${id}:`, error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    console.log(`DB Storage: Eliminando usuario ${id}`);
    
    try {
      const result = await db
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning({ id: schema.users.id });
      
      const wasDeleted = result.length > 0;
      console.log(`DB Storage: Usuario ${id} ${wasDeleted ? 'eliminado exitosamente' : 'no pudo ser eliminado'}`);
      
      return wasDeleted;
    } catch (error) {
      console.error(`DB Storage: Error al eliminar usuario ${id}:`, error);
      throw error;
    }
  }

  // Métodos para solicitudes de reservación (nueva estructura simplificada)
  async createReservationRequest(requestData: schema.InsertReservationRequest): Promise<schema.ReservationRequest> {
    console.log("DB Storage: Creando solicitud de reservación:", JSON.stringify(requestData, null, 2));
    
    try {
      const [newRequest] = await db
        .insert(schema.reservationRequests)
        .values(requestData)
        .returning();
      
      console.log(`DB Storage: Solicitud de reservación creada con ID: ${newRequest.id}`);
      return newRequest;
    } catch (error) {
      console.error("DB Storage: Error al crear solicitud de reservación:", error);
      throw error;
    }
  }

  async getReservationRequests(filters?: { 
    companyId?: string; 
    status?: string; 
    requesterId?: number; 
  }): Promise<schema.ReservationRequest[]> {
    console.log("DB Storage: Consultando solicitudes de reservación con filtros:", filters);
    
    try {
      let query = db.select().from(schema.reservationRequests);
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(eq(schema.reservationRequests.status, filters.status));
      }
      
      if (filters?.requesterId) {
        conditions.push(eq(schema.reservationRequests.requesterId, filters.requesterId));
      }
      
      // Para filtrar por compañía, necesitamos extraerlo del campo data JSON
      if (filters?.companyId) {
        conditions.push(sql`${schema.reservationRequests.data}->>'company_id' = ${filters.companyId}`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const requests = await query.orderBy(sql`${schema.reservationRequests.createdAt} DESC`);
      
      console.log(`DB Storage: Encontradas ${requests.length} solicitudes de reservación`);
      return requests;
    } catch (error) {
      console.error("DB Storage: Error al obtener solicitudes de reservación:", error);
      throw error;
    }
  }

  async getReservationRequest(id: number): Promise<schema.ReservationRequest | undefined> {
    console.log(`DB Storage: Consultando solicitud de reservación ${id}`);
    
    try {
      const [request] = await db
        .select()
        .from(schema.reservationRequests)
        .where(eq(schema.reservationRequests.id, id));
      
      if (request) {
        console.log(`DB Storage: Solicitud de reservación ${id} encontrada`);
      } else {
        console.log(`DB Storage: Solicitud de reservación ${id} no encontrada`);
      }
      
      return request;
    } catch (error) {
      console.error(`DB Storage: Error al obtener solicitud de reservación ${id}:`, error);
      throw error;
    }
  }

  async updateReservationRequestStatus(
    id: number, 
    status: string, 
    reviewedBy: number, 
    reviewNotes?: string
  ): Promise<schema.ReservationRequest | undefined> {
    console.log(`DB Storage: Iniciando proceso de ${status} para solicitud ${id}`);
    
    try {
      // 1. Obtener la solicitud original
      const request = await this.getReservationRequest(id);
      if (!request) {
        throw new Error(`Solicitud ${id} no encontrada`);
      }
      
      // 2. Si es rechazo, solo actualizar estado
      if (status === 'rechazada') {
        console.log(`DB Storage: Rechazando solicitud ${id}`);
        const [updatedRequest] = await db
          .update(schema.reservationRequests)
          .set({
            status,
            reviewedBy,
            reviewNotes: reviewNotes || null
          })
          .where(eq(schema.reservationRequests.id, id))
          .returning();
        
        return updatedRequest;
      }
      
      // 3. Si es aprobación, procesar creación completa
      if (status === 'aprobada') {
        console.log(`DB Storage: Procesando aprobación de solicitud ${id}`);
        
        // Parsear datos de la solicitud
        const requestData = request.data as any;
        console.log(`DB Storage: Datos de solicitud:`, JSON.stringify(requestData, null, 2));
        
        // Validar estructura de datos requerida
        if (!requestData.trip_details?.recordId || !requestData.trip_details?.tripId) {
          throw new Error('Datos de viaje inválidos en la solicitud');
        }
        
        const recordId = requestData.trip_details.recordId;
        const tripId = requestData.trip_details.tripId;
        const seatsRequested = requestData.trip_details.seats || 1;
        
        // 4. Validar disponibilidad de asientos
        const hasAvailability = await this.validateSeatAvailability(recordId, tripId, seatsRequested);
        if (!hasAvailability) {
          throw new Error(`No hay suficientes asientos disponibles para el segmento ${tripId}`);
        }
        
        // 5. Iniciar transacción de base de datos
        return await db.transaction(async (tx) => {
          console.log(`DB Storage: Iniciando transacción para solicitud ${id}`);
          
          // 6. Crear reservación asociada al comisionista
          const reservationData = await this.mapReservationData(requestData);
          const [newReservation] = await tx
            .insert(schema.reservations)
            .values(reservationData)
            .returning();
          
          console.log(`DB Storage: Reservación ${newReservation.id} creada para comisionista ${requestData.created_by}`);
          
          // 7. Crear pasajeros
          await this.createPassengersFromData(requestData.passengers || [], newReservation.id, tx);
          
          // 8. Crear transacción si aplica (asociada al aprobador)
          await this.createTransactionFromReservation(requestData, reviewedBy, newReservation.id, tx);
          
          // 9. Actualizar disponibilidad de asientos
          await this.updateRelatedTripsAvailability(recordId, tripId, -seatsRequested);
          
          // 10. Actualizar estado de la solicitud
          const [updatedRequest] = await tx
            .update(schema.reservationRequests)
            .set({
              status,
              reviewedBy,
              reviewNotes: reviewNotes || null
            })
            .where(eq(schema.reservationRequests.id, id))
            .returning();
          
          console.log(`DB Storage: Solicitud ${id} aprobada exitosamente. Reservación: ${newReservation.id}`);
          return updatedRequest;
        });
      }
      
      throw new Error(`Estado inválido: ${status}`);
      
    } catch (error) {
      console.error(`DB Storage: Error al procesar solicitud ${id}:`, error);
      throw error;
    }
  }

  // Métodos para notificaciones
  async createNotification(notificationData: schema.InsertNotification): Promise<schema.Notification> {
    console.log("DB Storage: Creando notificación:", JSON.stringify(notificationData, null, 2));
    
    try {
      const [notification] = await db
        .insert(schema.notifications)
        .values(notificationData)
        .returning();
      
      console.log(`DB Storage: Notificación creada con ID: ${notification.id}`);
      return notification;
    } catch (error) {
      console.error("DB Storage: Error al crear notificación:", error);
      throw error;
    }
  }

  async getNotifications(userId: number): Promise<schema.Notification[]> {
    console.log(`DB Storage: Consultando notificaciones para usuario ${userId}`);
    
    try {
      const currentTime = new Date();
      
      // Obtener solo notificaciones no expiradas
      const notifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            sql`${schema.notifications.expiresAt} > ${currentTime}`
          )
        )
        .orderBy(sql`${schema.notifications.createdAt} DESC`);
      
      console.log(`DB Storage: Encontradas ${notifications.length} notificaciones válidas para usuario ${userId}`);
      
      // Ejecutar limpieza de notificaciones expiradas en segundo plano
      this.cleanupExpiredNotifications().catch(error => {
        console.error('Error en limpieza automática de notificaciones:', error);
      });
      
      return notifications;
    } catch (error) {
      console.error(`DB Storage: Error al obtener notificaciones para usuario ${userId}:`, error);
      throw error;
    }
  }

  async markNotificationAsRead(id: number): Promise<schema.Notification | undefined> {
    console.log(`DB Storage: Marcando notificación ${id} como leída`);
    
    try {
      const [notification] = await db
        .update(schema.notifications)
        .set({ read: true })
        .where(eq(schema.notifications.id, id))
        .returning();
      
      if (notification) {
        console.log(`DB Storage: Notificación ${id} marcada como leída`);
      } else {
        console.log(`DB Storage: No se pudo marcar la notificación ${id} como leída`);
      }
      
      return notification;
    } catch (error) {
      console.error(`DB Storage: Error al marcar notificación ${id} como leída:`, error);
      throw error;
    }
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    console.log(`DB Storage: Consultando conteo de notificaciones no leídas para usuario ${userId}`);
    
    try {
      const currentTime = new Date();
      
      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false),
            sql`${schema.notifications.expiresAt} > ${currentTime}`
          )
        );
      
      const count = parseInt(result[0].count.toString());
      console.log(`DB Storage: Usuario ${userId} tiene ${count} notificaciones no leídas válidas`);
      
      return count;
    } catch (error) {
      console.error(`DB Storage: Error al obtener conteo de notificaciones no leídas para usuario ${userId}:`, error);
      throw error;
    }
  }

  // Método para limpiar notificaciones expiradas
  async cleanupExpiredNotifications(): Promise<number> {
    console.log('DB Storage: Iniciando limpieza de notificaciones expiradas');
    
    try {
      const currentTime = new Date();
      
      const deletedResult = await db
        .delete(schema.notifications)
        .where(sql`${schema.notifications.expiresAt} <= ${currentTime}`)
        .returning({ id: schema.notifications.id });
      
      const deletedCount = deletedResult.length;
      console.log(`DB Storage: Eliminadas ${deletedCount} notificaciones expiradas`);
      
      return deletedCount;
    } catch (error) {
      console.error('DB Storage: Error al limpiar notificaciones expiradas:', error);
      throw error;
    }
  }

  // Paso 2: Validar disponibilidad de asientos antes de crear reservación
  async validateSeatAvailability(recordId: number, tripId: string, seatsRequested: number): Promise<boolean> {
    console.log(`DB Storage: [validateSeatAvailability] Iniciando validación - Registro: ${recordId}, Segmento: ${tripId}, Asientos: ${seatsRequested}`);
    
    try {
      // 1. Validar parámetros de entrada
      if (!recordId || !tripId || seatsRequested <= 0) {
        console.log(`DB Storage: [validateSeatAvailability] Parámetros inválidos - recordId: ${recordId}, tripId: ${tripId}, seats: ${seatsRequested}`);
        return false;
      }
      
      // 2. Obtener el registro del viaje
      const trip = await this.getTrip(recordId);
      if (!trip) {
        console.log(`DB Storage: [validateSeatAvailability] Registro ${recordId} no encontrado`);
        return false;
      }
      
      // 3. Validar estructura de datos del viaje
      if (!trip.tripData || !Array.isArray(trip.tripData)) {
        console.log(`DB Storage: [validateSeatAvailability] Registro ${recordId} sin datos de segmentos válidos`);
        return false;
      }
      
      // 4. Extraer y validar índice del segmento
      const tripIdParts = tripId.split('_');
      if (tripIdParts.length !== 2) {
        console.log(`DB Storage: [validateSeatAvailability] Formato de tripId inválido: ${tripId}. Esperado: recordId_segmentIndex`);
        return false;
      }
      
      const segmentIndex = parseInt(tripIdParts[1]);
      if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex >= trip.tripData.length) {
        console.log(`DB Storage: [validateSeatAvailability] Índice de segmento ${segmentIndex} fuera de rango para ${tripId}. Segmentos disponibles: ${trip.tripData.length}`);
        return false;
      }
      
      // 5. Validar estructura del segmento específico
      const segment = trip.tripData[segmentIndex];
      if (!segment || typeof segment !== 'object') {
        console.log(`DB Storage: [validateSeatAvailability] Segmento ${segmentIndex} no válido en registro ${recordId}`);
        return false;
      }
      
      // 6. Verificar asientos disponibles
      const availableSeats = segment.availableSeats;
      if (typeof availableSeats !== 'number' || availableSeats < 0) {
        console.log(`DB Storage: [validateSeatAvailability] Campo availableSeats inválido en segmento ${tripId}: ${availableSeats}`);
        return false;
      }
      
      // 7. Verificar disponibilidad suficiente
      const hasEnoughSeats = availableSeats >= seatsRequested;
      
      console.log(`DB Storage: [validateSeatAvailability] Resultado - Segmento: ${tripId}, Disponibles: ${availableSeats}, Solicitados: ${seatsRequested}, Suficientes: ${hasEnoughSeats}`);
      
      if (!hasEnoughSeats) {
        console.log(`DB Storage: [validateSeatAvailability] ❌ Asientos insuficientes para ${tripId} - Necesarios: ${seatsRequested}, Disponibles: ${availableSeats}`);
      } else {
        console.log(`DB Storage: [validateSeatAvailability] ✅ Asientos suficientes para ${tripId} - Reservando: ${seatsRequested}/${availableSeats}`);
      }
      
      return hasEnoughSeats;
      
    } catch (error) {
      console.error(`DB Storage: [validateSeatAvailability] Error inesperado al validar disponibilidad:`, error);
      return false;
    }
  }

  // Método temporal para mapear datos de reservación (Paso 3)
  async mapReservationData(requestData: any): Promise<any> {
    console.log(`DB Storage: Mapeando datos de reservación para comisionista ${requestData.created_by}`);
    
    return {
      companyId: requestData.company_id,
      tripDetails: requestData.trip_details,
      totalAmount: requestData.total_amount,
      email: requestData.email,
      phone: requestData.phone,
      notes: requestData.notes,
      paymentMethod: requestData.payment_method,
      paymentStatus: requestData.payment_status,
      advanceAmount: requestData.advance_amount || 0,
      advancePaymentMethod: requestData.advance_payment_method,
      discountAmount: requestData.discount_amount || 0,
      originalAmount: requestData.original_amount,
      status: 'confirmed',
      createdBy: requestData.created_by, // Asociar al comisionista
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Método temporal para crear pasajeros (Paso 4)
  async createPassengersFromData(passengers: any[], reservationId: number, tx: any): Promise<void> {
    console.log(`DB Storage: Creando ${passengers.length} pasajeros para reservación ${reservationId}`);
    
    if (!passengers || passengers.length === 0) {
      console.log(`DB Storage: No hay pasajeros para crear`);
      return;
    }
    
    for (const passenger of passengers) {
      const passengerData = {
        reservationId,
        firstName: passenger.firstName || '',
        lastName: passenger.lastName || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await tx.insert(schema.passengers).values(passengerData);
      console.log(`DB Storage: Pasajero ${passenger.firstName} ${passenger.lastName} creado`);
    }
  }

  // Método temporal para crear transacción (Paso 5)
  async createTransactionFromReservation(requestData: any, approvedBy: number, reservationId: number, tx: any): Promise<void> {
    console.log(`DB Storage: Evaluando creación de transacción para reservación ${reservationId}`);
    
    const needsTransaction = requestData.payment_status === 'pagado' || (requestData.advance_amount && requestData.advance_amount > 0);
    
    if (!needsTransaction) {
      console.log(`DB Storage: No se requiere transacción (estado: ${requestData.payment_status}, anticipo: ${requestData.advance_amount})`);
      return;
    }
    
    let transactionData;
    
    if (requestData.payment_status === 'pagado') {
      // Transacción completa
      transactionData = {
        userId: approvedBy, // Asociar al aprobador
        companyId: requestData.company_id,
        amount: requestData.total_amount,
        type: 'sale',
        method: requestData.payment_method,
        description: `Pago completo - Reservación ${reservationId}`,
        createdAt: new Date()
      };
    } else if (requestData.advance_amount > 0) {
      // Transacción de anticipo
      transactionData = {
        userId: approvedBy, // Asociar al aprobador
        companyId: requestData.company_id,
        amount: requestData.advance_amount,
        type: 'advance',
        method: requestData.advance_payment_method,
        description: `Anticipo - Reservación ${reservationId}`,
        createdAt: new Date()
      };
    }
    
    if (transactionData) {
      await tx.insert(schema.transactions).values(transactionData);
      console.log(`DB Storage: Transacción creada - Tipo: ${transactionData.type}, Monto: ${transactionData.amount}, Usuario: ${approvedBy}`);
    }
  }
}