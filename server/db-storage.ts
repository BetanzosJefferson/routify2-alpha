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
import { eq, and, gte, lt, like, or, sql, isNotNull, isNull, inArray, ne, desc } from "drizzle-orm";

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

    // Obtener información completa del conductor si existe driverId
    let driverInfo = null;
    if (trip.driverId) {
      const [driver] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, trip.driverId));
      
      if (driver) {
        driverInfo = {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          email: driver.email,
          phone: driver.phone
        };
      }
    }
    
    return {
      ...trip,
      route,
      numStops: route.stops.length,
      companyName,
      companyLogo,
      driver: driverInfo
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
  
  async getReservations(companyId?: string, currentUserId?: number, userRole?: string): Promise<ReservationWithDetails[]> {
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
      
      // Si el usuario es conductor (chofer), solo mostrar reservaciones de sus viajes asignados
      if (userRole === 'chofer' && currentUserId && tripRecord.driverId !== currentUserId) {
        console.log(`DB Storage: Omitiendo reservación ${reservation.id} - no es del conductor ${currentUserId}`);
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
              role: user.role,
              commissionPercentage: user.commissionPercentage
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
      
      // Obtener información del conductor
      let driverInfo = null;
      if (tripRecord.driverId) {
        try {
          const [driver] = await db.select().from(schema.users).where(eq(schema.users.id, tripRecord.driverId));
          if (driver) {
            driverInfo = {
              id: driver.id,
              firstName: driver.firstName,
              lastName: driver.lastName,
              email: driver.email,
              phone: driver.phone
            };
          }
        } catch (error) {
          console.warn(`Error fetching driver ${tripRecord.driverId}:`, error);
        }
      }
      
      // Obtener información del vehículo
      let vehicleInfo = null;
      if (tripRecord.vehicleId) {
        try {
          const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, tripRecord.vehicleId));
          if (vehicle) {
            vehicleInfo = {
              id: vehicle.id,
              model: vehicle.model,
              plates: vehicle.plates, // Usar "plates" como está en la base de datos
              brand: vehicle.brand,
              capacity: vehicle.capacity
            };
          }
        } catch (error) {
          console.warn(`Error fetching vehicle ${tripRecord.vehicleId}:`, error);
        }
      }
      
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
        // Información del conductor y vehículo
        driver: driverInfo,
        vehicle: vehicleInfo,
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
      
      // DEBUG: Mostrar información del conductor y vehículo que se envía
      console.log(`[getReservations] Reservación ${reservation.id} - Driver:`, driverInfo, 'Vehicle:', vehicleInfo);
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
      companyId: vehicle.companyId || null, // Incluir companyId
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log("Insertando vehículo con companyId:", vehicleData.companyId);
    
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

  async getTransaccionesByPackageId(packageId: number): Promise<schema.Transaccion[]> {
    try {
      const transactions = await this.db
        .select()
        .from(schema.transacciones)
        .where(
          and(
            eq(sql`${schema.transacciones.details}->>'type'`, 'package'),
            eq(sql`(${schema.transacciones.details}->'details'->>'id')::integer`, packageId)
          )
        );
      
      console.log(`[DatabaseStorage] Encontradas ${transactions.length} transacciones para paquetería ID ${packageId}`);
      return transactions;
    } catch (error) {
      console.error(`[DatabaseStorage] Error obteniendo transacciones para paquetería ${packageId}:`, error);
      return [];
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
  }): Promise<any[]> {
    console.log("DB Storage: Consultando solicitudes de reservación con filtros:", filters);
    
    try {
      let query = db.select({
        id: schema.reservationRequests.id,
        data: schema.reservationRequests.data,
        requesterId: schema.reservationRequests.requesterId,
        status: schema.reservationRequests.status,
        createdAt: schema.reservationRequests.createdAt,
        reviewedBy: schema.reservationRequests.reviewedBy,
        reviewNotes: schema.reservationRequests.reviewNotes,
        // Información del usuario solicitante
        requesterName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
        requesterEmail: schema.users.email,
        requesterRole: schema.users.role,
      })
      .from(schema.reservationRequests)
      .leftJoin(schema.users, eq(schema.reservationRequests.requesterId, schema.users.id));
      
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

  // Paso 3: Mapear datos de solicitud a formato de reservación
  async mapReservationData(requestData: any): Promise<schema.InsertReservation> {
    console.log(`DB Storage: [mapReservationData] Iniciando mapeo para comisionista ${requestData.created_by}`);
    
    try {
      // 1. Validar datos requeridos del request
      if (!requestData.created_by) {
        throw new Error('Campo created_by requerido para asociar reservación al comisionista');
      }
      
      if (!requestData.company_id) {
        throw new Error('Campo company_id requerido para la reservación');
      }
      
      if (!requestData.trip_details) {
        throw new Error('Campo trip_details requerido para la reservación');
      }
      
      if (!requestData.total_amount || requestData.total_amount <= 0) {
        throw new Error('Campo total_amount debe ser mayor a 0');
      }
      
      if (!requestData.phone) {
        throw new Error('Campo phone requerido para la reservación');
      }
      
      // 2. Validar estructura de trip_details
      if (!requestData.trip_details.recordId || !requestData.trip_details.tripId) {
        throw new Error('trip_details debe contener recordId y tripId');
      }
      
      if (!requestData.trip_details.seats || requestData.trip_details.seats <= 0) {
        throw new Error('trip_details debe contener número válido de asientos');
      }
      
      // 3. Crear objeto de reservación con mapeo completo
      const reservationData: schema.InsertReservation = {
        // Información de la compañía y asociación
        companyId: requestData.company_id,
        createdBy: requestData.created_by, // CRÍTICO: Asociar al comisionista, no al aprobador
        
        // Detalles del viaje (mantener como JSON)
        tripDetails: requestData.trip_details,
        
        // Información financiera
        totalAmount: requestData.total_amount,
        advanceAmount: requestData.advance_amount || 0,
        discountAmount: requestData.discount_amount || 0,
        originalAmount: requestData.original_amount || requestData.total_amount,
        
        // Información de contacto
        email: requestData.email || null,
        phone: requestData.phone,
        notes: requestData.notes || null,
        
        // Información de pago
        paymentMethod: requestData.payment_method || 'efectivo',
        paymentStatus: requestData.payment_status || 'pendiente',
        advancePaymentMethod: requestData.advance_payment_method || 'efectivo',
        
        // Estado y metadata
        status: 'confirmed', // Las reservaciones aprobadas siempre están confirmadas
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Campos adicionales para compatibilidad
        commissionPaid: requestData.commission_paid || false,
        couponCode: requestData.coupon_code || null,
        markedAsPaidAt: requestData.marked_as_paid_at ? new Date(requestData.marked_as_paid_at) : null,
        paidBy: requestData.paid_by || null
      };
      
      console.log(`DB Storage: [mapReservationData] Reservación mapeada exitosamente:`);
      console.log(`  - Comisionista: ${reservationData.createdBy}`);
      console.log(`  - Compañía: ${reservationData.companyId}`);
      console.log(`  - Monto total: ${reservationData.totalAmount}`);
      console.log(`  - Viaje: ${JSON.stringify(reservationData.tripDetails)}`);
      console.log(`  - Estado pago: ${reservationData.paymentStatus}`);
      console.log(`  - Anticipo: ${reservationData.advanceAmount}`);
      
      return reservationData;
      
    } catch (error) {
      console.error(`DB Storage: [mapReservationData] Error al mapear datos:`, error);
      throw error;
    }
  }

  // Paso 4: Crear registros de pasajeros asociados a la reservación
  async createPassengersFromData(passengers: any[], reservationId: number, tx: any): Promise<void> {
    console.log(`DB Storage: [createPassengersFromData] Iniciando creación de pasajeros para reservación ${reservationId}`);
    
    try {
      // 1. Validar parámetros de entrada
      if (!reservationId || reservationId <= 0) {
        throw new Error('ReservationId debe ser un número válido mayor a 0');
      }
      
      if (!tx) {
        throw new Error('Transacción de base de datos requerida para crear pasajeros');
      }
      
      // 2. Validar array de pasajeros
      if (!passengers || !Array.isArray(passengers)) {
        console.log(`DB Storage: [createPassengersFromData] No se proporcionaron pasajeros válidos para reservación ${reservationId}`);
        return;
      }
      
      if (passengers.length === 0) {
        console.log(`DB Storage: [createPassengersFromData] Array de pasajeros vacío para reservación ${reservationId}`);
        return;
      }
      
      console.log(`DB Storage: [createPassengersFromData] Procesando ${passengers.length} pasajeros`);
      
      // 3. Validar y crear cada pasajero
      for (let i = 0; i < passengers.length; i++) {
        const passenger = passengers[i];
        
        // Validar estructura del pasajero
        if (!passenger || typeof passenger !== 'object') {
          console.warn(`DB Storage: [createPassengersFromData] Pasajero ${i + 1} tiene estructura inválida, omitiendo`);
          continue;
        }
        
        // Validar campos requeridos
        const firstName = passenger.firstName?.trim();
        const lastName = passenger.lastName?.trim();
        
        if (!firstName && !lastName) {
          console.warn(`DB Storage: [createPassengersFromData] Pasajero ${i + 1} no tiene firstName ni lastName, omitiendo`);
          continue;
        }
        
        // Preparar datos del pasajero
        const passengerData: schema.InsertPassenger = {
          reservationId,
          firstName: firstName || '',
          lastName: lastName || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Agregar campos opcionales si están presentes
        if (passenger.documentType) {
          passengerData.documentType = passenger.documentType.toString().trim();
        }
        
        if (passenger.documentNumber) {
          passengerData.documentNumber = passenger.documentNumber.toString().trim();
        }
        
        if (passenger.age && typeof passenger.age === 'number' && passenger.age > 0) {
          passengerData.age = passenger.age;
        }
        
        if (passenger.seat) {
          passengerData.seat = passenger.seat.toString().trim();
        }
        
        // Crear el registro en la base de datos
        const [createdPassenger] = await tx
          .insert(schema.passengers)
          .values(passengerData)
          .returning();
        
        console.log(`DB Storage: [createPassengersFromData] ✅ Pasajero ${i + 1} creado: ${firstName} ${lastName} (ID: ${createdPassenger.id})`);
      }
      
      console.log(`DB Storage: [createPassengersFromData] Proceso completado para reservación ${reservationId}`);
      
    } catch (error) {
      console.error(`DB Storage: [createPassengersFromData] Error al crear pasajeros para reservación ${reservationId}:`, error);
      throw error;
    }
  }

  // Paso 5: Crear transacción financiera asociada a la reservación
  async createTransactionFromReservation(requestData: any, approvedBy: number, reservationId: number, tx: any): Promise<void> {
    console.log(`DB Storage: [createTransactionFromReservation] Evaluando creación de transacción para reservación ${reservationId}`);
    
    try {
      // 1. Validar parámetros de entrada
      if (!requestData) {
        throw new Error('RequestData es requerido para crear transacción');
      }
      
      if (!approvedBy || approvedBy <= 0) {
        throw new Error('ApprovedBy debe ser un ID de usuario válido');
      }
      
      if (!reservationId || reservationId <= 0) {
        throw new Error('ReservationId debe ser un número válido mayor a 0');
      }
      
      if (!tx) {
        throw new Error('Transacción de base de datos requerida');
      }
      
      // 2. Validar datos financieros
      const totalAmount = requestData.total_amount || 0;
      const advanceAmount = requestData.advance_amount || 0;
      const paymentStatus = requestData.payment_status || 'pendiente';
      
      if (totalAmount <= 0) {
        console.log(`DB Storage: [createTransactionFromReservation] Total amount inválido (${totalAmount}), no se creará transacción`);
        return;
      }
      
      // 3. Determinar si se debe crear transacción
      const shouldCreateTransaction = (
        advanceAmount > 0 || 
        paymentStatus === 'pagado' || 
        paymentStatus === 'completado'
      );
      
      if (!shouldCreateTransaction) {
        console.log(`DB Storage: [createTransactionFromReservation] No se requiere transacción:`);
        console.log(`  - Anticipo: ${advanceAmount}`);
        console.log(`  - Estado pago: ${paymentStatus}`);
        console.log(`  - Condición no cumplida para crear transacción`);
        return;
      }
      
      // 4. Calcular monto y tipo de transacción
      let transactionAmount: number;
      let transactionType: string;
      let paymentMethod: string;
      
      if (advanceAmount > 0) {
        // Hay anticipo - crear transacción por el monto del anticipo
        transactionAmount = advanceAmount;
        transactionType = 'anticipo';
        paymentMethod = requestData.advance_payment_method || 'efectivo';
      } else if (paymentStatus === 'pagado' || paymentStatus === 'completado') {
        // Está marcado como pagado - crear transacción por el monto total
        transactionAmount = totalAmount;
        transactionType = 'pago_completo';
        paymentMethod = requestData.payment_method || 'efectivo';
      } else {
        throw new Error('Condición de transacción no válida');
      }
      
      // 5. Obtener información del viaje para completar los datos de la transacción
      let tripInfo = null;
      let origen = "Origen no especificado";
      let destino = "Destino no especificado";
      let isSubTrip = false;
      
      const tripId = requestData.trip_details?.tripId;
      if (tripId) {
        try {
          // Extraer recordId y subTripId del tripId (formato: "recordId_subTripIndex")
          const [recordIdStr, subTripIndex] = tripId.split('_');
          const recordId = parseInt(recordIdStr);
          
          if (!isNaN(recordId)) {
            // Buscar el viaje en la base de datos
            const tripResult = await db
              .select()
              .from(schema.trips)
              .where(eq(schema.trips.id, recordId))
              .limit(1);
            
            if (tripResult.length > 0) {
              const trip = tripResult[0];
              const tripData = trip.tripData as any;
              
              if (tripData && Array.isArray(tripData)) {
                // Si hay subTripIndex, es un sub-viaje
                if (subTripIndex && subTripIndex !== '0') {
                  isSubTrip = true;
                  const subTripIdx = parseInt(subTripIndex);
                  if (subTripIdx < tripData.length) {
                    const subTrip = tripData[subTripIdx];
                    origen = subTrip.origin || "Origen no especificado";
                    destino = subTrip.destination || "Destino no especificado";
                  }
                } else {
                  // Es el viaje principal
                  const mainTrip = tripData[0];
                  if (mainTrip) {
                    origen = mainTrip.origin || "Origen no especificado";
                    destino = mainTrip.destination || "Destino no especificado";
                  }
                }
              }
            }
          }
        } catch (tripError) {
          console.error(`Error al obtener información del viaje ${tripId}:`, tripError);
        }
      }
      
      // Preparar nombres de pasajeros
      const passengerNames = requestData.passengers?.map((p: any) => 
        `${p.firstName || ''} ${p.lastName || ''}`.trim()
      ).join(', ') || 'Sin especificar';
      
      const transactionData: schema.InsertTransaccion = {
        reservationId: reservationId,
        companyId: requestData.company_id,
        user_id: approvedBy, // CRÍTICO: Asociar al aprobador, no al comisionista
        amount: transactionAmount,
        type: transactionType,
        paymentMethod: paymentMethod,
        notes: `Transacción creada automáticamente por aprobación de solicitud de comisionista`,
        details: {
          type: "reservation",
          details: {
            id: reservationId,
            monto: transactionAmount,
            notas: requestData.notes || null,
            origen: origen,
            tripId: tripId,
            destino: destino,
            contacto: {
              email: requestData.email || null,
              telefono: requestData.phone || null
            },
            companyId: requestData.company_id,
            isSubTrip: isSubTrip,
            pasajeros: passengerNames,
            metodoPago: paymentMethod,
            dateCreated: new Date().toISOString()
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 6. Crear la transacción en la base de datos
      const [createdTransaction] = await tx
        .insert(schema.transacciones)
        .values(transactionData)
        .returning();
      
      console.log(`DB Storage: [createTransactionFromReservation] ✅ Transacción creada exitosamente:`);
      console.log(`  - ID: ${createdTransaction.id}`);
      console.log(`  - Tipo: ${transactionType}`);
      console.log(`  - Monto: ${transactionAmount}`);
      console.log(`  - Método: ${paymentMethod}`);
      console.log(`  - Asociada a aprobador: ${approvedBy}`);
      console.log(`  - Reservación: ${reservationId}`);
      
    } catch (error) {
      console.error(`DB Storage: [createTransactionFromReservation] Error al crear transacción:`, error);
      throw error;
    }
  }

  // Métodos para presupuestos de viajes
  async getTripBudget(tripId: number): Promise<any> {
    try {
      console.log(`DB Storage: Consultando presupuesto para viaje ${tripId}`);
      
      const budget = await this.db
        .select()
        .from(schema.tripBudgets)
        .where(eq(schema.tripBudgets.tripId, tripId))
        .limit(1);
      
      if (budget.length === 0) {
        console.log(`DB Storage: No se encontró presupuesto para viaje ${tripId}`);
        return undefined;
      }
      
      console.log(`DB Storage: Presupuesto encontrado para viaje ${tripId}: ${budget[0].amount}`);
      return budget[0];
    } catch (error) {
      console.error(`DB Storage: Error al obtener presupuesto del viaje ${tripId}:`, error);
      throw error;
    }
  }

  async createTripBudget(budget: any): Promise<any> {
    try {
      console.log(`DB Storage: Creando presupuesto para viaje ${budget.tripId}`);
      
      const [newBudget] = await this.db
        .insert(schema.tripBudgets)
        .values(budget)
        .returning();
      
      console.log(`DB Storage: Presupuesto creado exitosamente para viaje ${budget.tripId}`);
      return newBudget;
    } catch (error) {
      console.error(`DB Storage: Error al crear presupuesto:`, error);
      throw error;
    }
  }

  async updateTripBudget(tripId: number, amount: number): Promise<any> {
    try {
      console.log(`DB Storage: Actualizando presupuesto para viaje ${tripId} con monto ${amount}`);
      
      const [updatedBudget] = await this.db
        .update(schema.tripBudgets)
        .set({ 
          amount: amount,
          updatedAt: new Date()
        })
        .where(eq(schema.tripBudgets.tripId, tripId))
        .returning();
      
      console.log(`DB Storage: Presupuesto actualizado exitosamente para viaje ${tripId}`);
      return updatedBudget;
    } catch (error) {
      console.error(`DB Storage: Error al actualizar presupuesto:`, error);
      throw error;
    }
  }

  // Métodos para gastos de viajes
  async getTripExpenses(tripId: number): Promise<any[]> {
    try {
      console.log(`DB Storage: Consultando gastos para viaje ${tripId}`);
      
      const expenses = await this.db
        .select()
        .from(schema.tripExpenses)
        .where(eq(schema.tripExpenses.tripId, tripId));
      
      console.log(`DB Storage: Encontrados ${expenses.length} gastos para viaje ${tripId}`);
      return expenses;
    } catch (error) {
      console.error(`DB Storage: Error al obtener gastos del viaje ${tripId}:`, error);
      throw error;
    }
  }

  async createTripExpense(expense: any): Promise<any> {
    try {
      console.log(`DB Storage: Creando gasto para viaje ${expense.tripId}`);
      
      const [newExpense] = await this.db
        .insert(schema.tripExpenses)
        .values(expense)
        .returning();
      
      console.log(`DB Storage: Gasto creado exitosamente para viaje ${expense.tripId}`);
      return newExpense;
    } catch (error) {
      console.error(`DB Storage: Error al crear gasto:`, error);
      throw error;
    }
  }

  // Package methods
  async getPackages(filters?: { companyId?: string; tripId?: number }): Promise<schema.Package[]> {
    try {
      let query = this.db.select().from(schema.packages);

      if (filters?.companyId) {
        query = query.where(eq(schema.packages.companyId, filters.companyId));
      }

      if (filters?.tripId) {
        query = query.where(eq(schema.packages.tripId, filters.tripId.toString()));
      }

      const packages = await query;
      console.log(`DB Storage: Encontrados ${packages.length} paquetes`);
      return packages;
    } catch (error) {
      console.error(`DB Storage: Error al obtener paquetes:`, error);
      throw error;
    }
  }

  async getPackagesWithTripInfo(filters?: { 
    companyId?: string; 
    companyIds?: string[]; 
    tripId?: number; 
    tripIds?: number[] 
  }, currentUserId?: number, userRole?: string): Promise<any[]> {
    try {
      let query = this.db.select().from(schema.packages);
      let conditions: any[] = [];

      // Filtro por compañía única
      if (filters?.companyId) {
        conditions.push(eq(schema.packages.companyId, filters.companyId));
      }

      // Filtro por múltiples compañías (para taquilleros)
      if (filters?.companyIds && filters.companyIds.length > 0) {
        conditions.push(inArray(schema.packages.companyId, filters.companyIds));
      }

      // Filtro por viaje único
      if (filters?.tripId) {
        const tripDetails = sql`JSON_EXTRACT(${schema.packages.tripDetails}, '$.tripId')`;
        conditions.push(eq(tripDetails, filters.tripId.toString()));
      }

      // Filtro por múltiples viajes (para conductores)
      if (filters?.tripIds && filters.tripIds.length > 0) {
        const tripIdStrings = filters.tripIds.map(id => id.toString());
        const tripDetails = sql`${schema.packages.tripDetails}->>'tripId'`;
        conditions.push(inArray(tripDetails, tripIdStrings));
      }

      // Aplicar condiciones si existen
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const rawPackages = await query;

      // Implementar filtrado por conductor si es necesario
      let filteredPackages = rawPackages;
      
      if (userRole === 'chofer' && currentUserId) {
        console.log(`DB Storage: Aplicando filtro de conductor para usuario ${currentUserId}`);
        console.log(`DB Storage: Total de paquetes a filtrar: ${rawPackages.length}`);
        
        filteredPackages = [];
        for (const pkg of rawPackages) {
          const tripDetails = typeof pkg.tripDetails === 'string' 
            ? JSON.parse(pkg.tripDetails) 
            : pkg.tripDetails;
          
          console.log(`DB Storage: Evaluando paquete ${pkg.id} con tripDetails:`, tripDetails);
          
          if (tripDetails?.tripId) {
            // Extraer recordId del tripId (ej: "31_0" -> recordId = 31)
            const tripIdParts = tripDetails.tripId.split('_');
            const recordId = parseInt(tripIdParts[0]);
            
            console.log(`DB Storage: Paquete ${pkg.id} - Extrayendo recordId ${recordId} de tripId ${tripDetails.tripId}`);
            
            if (!isNaN(recordId)) {
              // Verificar directamente en la tabla trips si este viaje está asignado al conductor
              const tripRecord = await this.getTrip(recordId);
              
              console.log(`DB Storage: Trip record ${recordId}:`, tripRecord ? {
                id: tripRecord.id,
                driverId: tripRecord.driverId,
                companyId: tripRecord.companyId
              } : 'No encontrado');
              
              if (tripRecord && tripRecord.driverId === currentUserId) {
                console.log(`DB Storage: ✓ Incluyendo paquete ${pkg.id} - conductor ${currentUserId} asignado al viaje ${recordId}`);
                filteredPackages.push(pkg);
              } else {
                console.log(`DB Storage: ✗ Omitiendo paquete ${pkg.id} - conductor ${currentUserId} NO asignado al viaje ${recordId} (driverId: ${tripRecord?.driverId})`);
              }
            } else {
              console.log(`DB Storage: ✗ Omitiendo paquete ${pkg.id} - no se pudo extraer recordId válido de tripId ${tripDetails.tripId}`);
            }
          } else {
            console.log(`DB Storage: ✗ Omitiendo paquete ${pkg.id} - sin tripId en tripDetails`);
          }
        }
        
        console.log(`DB Storage: Filtrados ${filteredPackages.length} de ${rawPackages.length} paquetes para conductor ${currentUserId}`);
      }

      // Mapear los datos para incluir información del viaje desde trip_details
      const packagesWithTripInfo = filteredPackages.map(pkg => {
        const tripDetails = typeof pkg.tripDetails === 'string' 
          ? JSON.parse(pkg.tripDetails) 
          : pkg.tripDetails;

        return {
          ...pkg,
          // Mapear campos para compatibilidad con el frontend
          tripOrigin: tripDetails?.origin || '',
          tripDestination: tripDetails?.destination || '',
          tripDepartureDate: tripDetails?.departureDate || '',
          tripDepartureTime: tripDetails?.departureTime || '',
          tripArrivalTime: tripDetails?.arrivalTime || '',
          tripId: tripDetails?.tripId || null,
          // Mantener tripDetails original para compatibilidad
          tripDetails: tripDetails
        };
      });

      console.log(`DB Storage: Encontrados ${packagesWithTripInfo.length} paquetes con información de viaje`);
      return packagesWithTripInfo;
    } catch (error) {
      console.error(`DB Storage: Error al obtener paquetes con información de viaje:`, error);
      throw error;
    }
  }

  async getPackage(id: number): Promise<schema.Package | undefined> {
    try {
      const packages = await this.db
        .select()
        .from(schema.packages)
        .where(eq(schema.packages.id, id))
        .limit(1);

      return packages[0];
    } catch (error) {
      console.error(`DB Storage: Error al obtener paquete ${id}:`, error);
      throw error;
    }
  }

  async getPackageWithTripInfo(id: number): Promise<schema.Package & { trip?: TripWithRouteInfo } | undefined> {
    try {
      const packageData = await this.getPackage(id);
      if (!packageData) return undefined;

      // Si el paquete tiene tripId, obtener información del viaje
      let trip: TripWithRouteInfo | undefined;
      if (packageData.tripId) {
        const tripId = parseInt(packageData.tripId.toString().split('_')[0]);
        trip = await this.getTripWithRouteInfo(tripId);
      }

      return { ...packageData, trip };
    } catch (error) {
      console.error(`DB Storage: Error al obtener paquete con información del viaje ${id}:`, error);
      throw error;
    }
  }

  async createPackage(packageData: schema.InsertPackage): Promise<schema.Package> {
    try {
      console.log(`DB Storage: Creando paquete:`, packageData);
      
      const [newPackage] = await this.db
        .insert(schema.packages)
        .values(packageData)
        .returning();
      
      console.log(`DB Storage: Paquete creado exitosamente con ID ${newPackage.id}`);
      return newPackage;
    } catch (error) {
      console.error(`DB Storage: Error al crear paquete:`, error);
      throw error;
    }
  }

  async updatePackage(id: number, packageData: Partial<schema.Package>): Promise<schema.Package | undefined> {
    try {
      const [updatedPackage] = await this.db
        .update(schema.packages)
        .set({ ...packageData, updatedAt: new Date() })
        .where(eq(schema.packages.id, id))
        .returning();

      return updatedPackage;
    } catch (error) {
      console.error(`DB Storage: Error al actualizar paquete ${id}:`, error);
      throw error;
    }
  }

  async deletePackage(id: number): Promise<boolean> {
    try {
      await this.db.delete(schema.packages).where(eq(schema.packages.id, id));
      return true;
    } catch (error) {
      console.error(`DB Storage: Error al eliminar paquete ${id}:`, error);
      return false;
    }
  }

  async getUserCashBoxes(currentUserId: number, companyId: string): Promise<any[]> {
    try {
      console.log(`DB Storage: Consultando cajas de usuarios para compañía ${companyId}, excluyendo usuario ${currentUserId}`);
      
      // Obtener transacciones que cumplan los criterios:
      // 1. cutoff_id sea null (no pertenecen a un corte)
      // 2. companyId igual al del usuario actual
      // 3. user_id diferente al usuario actual
      const transactions = await this.db
        .select({
          id: schema.transacciones.id,
          details: schema.transacciones.details,
          user_id: schema.transacciones.user_id,
          createdAt: schema.transacciones.createdAt,
          // Información del usuario
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          role: schema.users.role
        })
        .from(schema.transacciones)
        .innerJoin(schema.users, eq(schema.transacciones.user_id, schema.users.id))
        .where(
          and(
            isNull(schema.transacciones.cutoff_id), // cutoff es null
            eq(schema.transacciones.companyId, companyId), // mismo company_id
            ne(schema.transacciones.user_id, currentUserId) // diferente user_id
          )
        )
        .orderBy(desc(schema.transacciones.createdAt));

      console.log(`DB Storage: Encontradas ${transactions.length} transacciones sin corte de otros usuarios`);

      // Agrupar transacciones por usuario
      const groupedByUser = transactions.reduce((acc: any, transaction: any) => {
        const userId = transaction.user_id;
        
        if (!acc[userId]) {
          acc[userId] = {
            userId: userId,
            firstName: transaction.firstName,
            lastName: transaction.lastName,
            email: transaction.email,
            role: transaction.role,
            transactions: [],
            totalAmount: 0,
            totalReservations: 0,
            totalPackages: 0
          };
        }

        // Agregar la transacción al usuario
        acc[userId].transactions.push({
          id: transaction.id,
          details: transaction.details,
          createdAt: transaction.createdAt
        });

        // Calcular totales según el tipo de transacción
        if (transaction.details && typeof transaction.details === 'object') {
          const details = transaction.details as any;
          
          if (details.type === 'reservation') {
            acc[userId].totalReservations += details.amount || 0;
            acc[userId].totalAmount += details.amount || 0;
          } else if (details.type === 'package') {
            acc[userId].totalPackages += details.amount || 0;
            acc[userId].totalAmount += details.amount || 0;
          }
        }

        return acc;
      }, {});

      // Convertir el objeto agrupado en un array
      const result = Object.values(groupedByUser);
      
      console.log(`DB Storage: Transacciones agrupadas por ${result.length} usuarios diferentes`);
      
      return result;
    } catch (error) {
      console.error(`DB Storage: Error al obtener cajas de usuarios:`, error);
      throw error;
    }
  }
}