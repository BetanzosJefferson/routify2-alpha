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
import { eq, and, gte, lt, like, or, sql } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
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
  
  async getTripWithRouteInfo(id: number, tripId?: string): Promise<TripWithRouteInfo | undefined> {
    console.log(`[getTripWithRouteInfo] INICIO - id: ${id}, tripId: ${tripId}`);
    const trip = await this.getTrip(id);
    if (!trip) {
      console.log(`[getTripWithRouteInfo] No se encontró trip con id: ${id}`);
      return undefined;
    }
    
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

    // Si se proporciona tripId, extraer datos del segmento específico del tripData JSON
    let segmentData = null;
    if (tripId && trip.tripData) {
      try {
        const tripDataArray = Array.isArray(trip.tripData) ? trip.tripData : JSON.parse(trip.tripData as string);
        
        // El tripId viene en formato "recordId_segmentIndex"
        const segmentIndex = parseInt(tripId.split('_')[1]);
        if (segmentIndex >= 0 && segmentIndex < tripDataArray.length) {
          segmentData = tripDataArray[segmentIndex];
          console.log(`[getTripWithRouteInfo] Extraído segmento ${segmentIndex} para tripId ${tripId}:`, segmentData);
        }
      } catch (error) {
        console.warn(`[getTripWithRouteInfo] Error al procesar tripData para trip ${id}:`, error);
      }
    }
    
    // Si tenemos datos del segmento específico, usarlos; sino, usar datos de la ruta general
    const finalTripData = {
      ...trip,
      route,
      numStops: route.stops.length,
      companyName,
      companyLogo,
      // Datos específicos del segmento si están disponibles
      origin: segmentData?.origin || route.origin,
      destination: segmentData?.destination || route.destination,
      departureDate: segmentData?.departureDate,
      departureTime: segmentData?.departureTime,
      arrivalTime: segmentData?.arrivalTime,
      price: segmentData?.price,
      isSubTrip: segmentData ? !segmentData.isMainTrip : false,
      segmentOrigin: segmentData?.origin,
      segmentDestination: segmentData?.destination
    };

    console.log(`[getTripWithRouteInfo] Resultado final:`, {
      id: finalTripData.id,
      origin: finalTripData.origin,
      destination: finalTripData.destination,
      departureTime: finalTripData.departureTime,
      isSubTrip: finalTripData.isSubTrip
    });

    return finalTripData;
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
      // Buscar la fecha en cualquier segmento del array tripData
      condiciones.push(sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${schema.trips.tripData}) AS segment
        WHERE DATE(segment->>'departureDate') = ${params.date}
      )`);
    }
    
    // Aplicar filtro por conductor (driverId)
    if (params.driverId) {
      console.log(`[searchTrips] Filtro por conductor ID: ${params.driverId}`);
      condiciones.push(eq(schema.trips.driverId, params.driverId));
    }
    
    // Aplicar filtro de asientos - removido porque availableSeats no está en el esquema trips
    // El filtro de asientos se aplicará después en el procesamiento de los resultados
    
    // Ejecutar consulta con todas las condiciones
    let trips;
    
    if (condiciones.length > 0) {
      const whereClause = condiciones.length === 1 ? condiciones[0] : and(...condiciones);
      console.log(`[searchTrips] Ejecutando consulta con ${condiciones.length} filtros`);
      
      const query = db.select().from(schema.trips).where(whereClause);
      console.log(`[searchTrips] SQL Query:`, query.toSQL());
      
      trips = await query;
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
        
        // Parse tripData para obtener información del primer segmento como representativo
        let tripDataArray = [];
        try {
          tripDataArray = Array.isArray(trip.tripData) ? trip.tripData : JSON.parse(trip.tripData as string);
        } catch (error) {
          console.warn(`[searchTrips] Error parsing tripData for trip ${trip.id}:`, error);
          continue;
        }
        
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
        // PARA BÚSQUEDA ESPECÍFICA: Expandir segmentos individuales
        console.log(`[searchTrips] Modo búsqueda: Expandiendo segmentos para viaje ${trip.id}`);
        
        // Parse tripData JSON array
        let tripDataArray = [];
        try {
          tripDataArray = Array.isArray(trip.tripData) ? trip.tripData : JSON.parse(trip.tripData as string);
          console.log(`[searchTrips] Trip ${trip.id} has ${tripDataArray.length} segments in tripData`);
        } catch (error) {
          console.warn(`[searchTrips] Error parsing tripData for trip ${trip.id}:`, error);
          continue;
        }
        
        // Process each segment in the tripData array
        for (let segmentIndex = 0; segmentIndex < tripDataArray.length; segmentIndex++) {
          const segment = tripDataArray[segmentIndex];
          
          // Check origin and destination filters
          let originMatch = !params.origin;
          let destMatch = !params.destination;
          
          if (params.origin) {
            const searchOrigin = params.origin.toLowerCase();
            originMatch = segment.origin?.toLowerCase().includes(searchOrigin);
            console.log(`[searchTrips] Origin filter: "${params.origin}" vs "${segment.origin}" => ${originMatch}`);
          }
          
          if (params.destination) {
            const searchDest = params.destination.toLowerCase();
            destMatch = segment.destination?.toLowerCase().includes(searchDest);
            console.log(`[searchTrips] Destination filter: "${params.destination}" vs "${segment.destination}" => ${destMatch}`);
          }
          
          // Check seat availability filter
          let seatMatch = !params.seats || (segment.availableSeats >= params.seats);
          
          console.log(`[searchTrips] Segment ${segmentIndex} filters - origin: ${originMatch}, dest: ${destMatch}, seats: ${seatMatch}`);
          console.log(`[searchTrips] Segment ${segmentIndex} data:`, {
            origin: segment.origin,
            destination: segment.destination,
            departureDate: segment.departureDate,
            availableSeats: segment.availableSeats
          });
          
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
            
            tripsWithRouteInfo.push(expandedTrip as TripWithRouteInfo);
          }
        }
      }
    }
    
    return tripsWithRouteInfo;
  }
  
  async updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void> {
    // Get the original trip
    const trip = await this.getTrip(tripId);
    if (!trip) return;
    
    // Update all sub-trips with the same parentTripId, including the main trip
    if (trip.isSubTrip && trip.parentTripId) {
      // If this is a sub-trip, update the parent and all siblings
      const parentId = trip.parentTripId;
      await db
        .update(schema.trips)
        .set({ 
          availableSeats: sql`available_seats + ${seatChange}` 
        })
        .where(
          or(
            eq(schema.trips.id, parentId),
            eq(schema.trips.parentTripId, parentId)
          )
        );
    } else {
      // If this is a main trip, update it and all its sub-trips
      await db
        .update(schema.trips)
        .set({ 
          availableSeats: sql`available_seats + ${seatChange}` 
        })
        .where(
          or(
            eq(schema.trips.id, tripId),
            eq(schema.trips.parentTripId, tripId)
          )
        );
    }
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
    
    // Para cada reservación, obtenemos el viaje relacionado
    for (const reservation of reservations) {
      // Extraer tripId específico del tripDetails JSON para obtener el segmento correcto
      let specificTripId = null;
      let tripDetails = null;
      try {
        tripDetails = typeof reservation.tripDetails === 'string' 
          ? JSON.parse(reservation.tripDetails) 
          : reservation.tripDetails;
        specificTripId = tripDetails?.tripId;
        console.log(`[getReservations] Reservación ${reservation.id}: tripDetails =`, tripDetails, `specificTripId = ${specificTripId}`);
      } catch (error) {
        console.warn(`Error al procesar tripDetails para reservación ${reservation.id}:`, error);
      }

      console.log(`[getReservations] Llamando getTripWithRouteInfo(${tripDetails?.recordId}, "${specificTripId}")`);
      const trip = await this.getTripWithRouteInfo(tripDetails?.recordId, specificTripId);
      if (!trip) continue;
      
      const passengers = await this.getPassengers(reservation.id);
      
      reservationsWithDetails.push({
        ...reservation,
        trip,
        passengers
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
    
    const trip = await this.getTripWithRouteInfo(reservation.tripId);
    if (!trip) return undefined;
    
    // Si se proporciona companyId, verificar que el viaje pertenezca a esa compañía
    if (companyId && trip.companyId !== companyId) {
      console.log(`Acceso denegado: El viaje ${trip.id} pertenece a la compañía ${trip.companyId} pero se solicita acceso desde la compañía ${companyId}`);
      return undefined; // No permitir acceso a reservaciones de otras compañías
    }
    
    const passengers = await this.getPassengers(reservation.id);
    
    return {
      ...reservation,
      trip,
      passengers
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
  
  // Métodos para gestión de cupones
  async verifyCouponValidity(code: string): Promise<{ valid: boolean; message?: string; coupon?: any }> {
    try {
      const [coupon] = await db
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.code, code));

      if (!coupon) {
        return { valid: false, message: 'Cupón no encontrado' };
      }

      // Verificar si el cupón está activo
      if (!coupon.isActive) {
        return { valid: false, message: 'Cupón inactivo' };
      }

      // Verificar si el cupón ha expirado
      const now = new Date();
      if (coupon.expiresAt < now) {
        return { valid: false, message: 'Cupón expirado' };
      }

      // Verificar si el cupón ha alcanzado su límite de uso
      if (coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, message: 'Cupón agotado' };
      }

      return { valid: true, coupon };
    } catch (error) {
      console.error('Error al verificar cupón:', error);
      return { valid: false, message: 'Error al verificar cupón' };
    }
  }

  async incrementCouponUsage(couponId: number): Promise<void> {
    try {
      await db
        .update(schema.coupons)
        .set({ 
          usageCount: sql`${schema.coupons.usageCount} + 1` 
        })
        .where(eq(schema.coupons.id, couponId));
    } catch (error) {
      console.error('Error al incrementar uso de cupón:', error);
      throw error;
    }
  }

  // Notification methods
  async createNotification(notificationData: any): Promise<any> {
    try {
      const [notification] = await db
        .insert(schema.notifications)
        .values(notificationData)
        .returning();
      return notification;
    } catch (error) {
      console.error('Error al crear notificación:', error);
      throw error;
    }
  }

  async getNotifications(userId: number): Promise<any[]> {
    try {
      const notifications = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(sql`${schema.notifications.createdAt} DESC`);
      return notifications;
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      return [];
    }
  }

  async markNotificationAsRead(id: number): Promise<any> {
    try {
      const [notification] = await db
        .update(schema.notifications)
        .set({ read: true })
        .where(eq(schema.notifications.id, id))
        .returning();
      return notification;
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      throw error;
    }
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    try {
      const [result] = await db
        .select({ count: sql`count(*)` })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false)
        ));
      return parseInt(result.count.toString());
    } catch (error) {
      console.error('Error al obtener conteo de notificaciones no leídas:', error);
      return 0;
    }
  }

  async checkTicket(reservationId: number, checkedBy: number): Promise<any> {
    try {
      const [updatedReservation] = await db
        .update(schema.reservations)
        .set({ 
          checkedBy: checkedBy,
          checkedAt: new Date(),
          checkCount: sql`${schema.reservations.checkCount} + 1`
        })
        .where(eq(schema.reservations.id, reservationId))
        .returning();
      
      return updatedReservation;
    } catch (error) {
      console.error('Error al verificar ticket:', error);
      throw error;
    }
  }

  async cancelReservationWithRefund(reservationId: number, canceledBy: number): Promise<any> {
    try {
      // Para cancelar con reembolso, simplemente usamos el status 'canceled' 
      // y podemos agregar una nota en el campo notes para indicar que es con reembolso
      const [updatedReservation] = await db
        .update(schema.reservations)
        .set({ 
          status: 'canceled',
          updatedAt: new Date(),
          notes: sql`CONCAT(COALESCE(${schema.reservations.notes}, ''), ' - CANCELADO CON REEMBOLSO por usuario ID: ${canceledBy}')`
        })
        .where(eq(schema.reservations.id, reservationId))
        .returning();
      
      return updatedReservation;
    } catch (error) {
      console.error('Error al cancelar con reembolso:', error);
      throw error;
    }
  }
}