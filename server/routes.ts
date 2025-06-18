import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { eq, inArray, isNull, isNotNull, desc, gte, lte } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { WebSocketServer, WebSocket } from 'ws';
import { 
  insertRouteSchema, 
  insertTripSchema, 
  insertReservationSchema, 
  insertPassengerSchema,
  createRouteValidationSchema,
  publishTripValidationSchema,
  createReservationValidationSchema,
  RouteWithSegments,
  SegmentPrice,
  locationData,
  TripVisibility,
  UserRole,
  PaymentStatus,
  PaymentMethod,
  userCompanies,
  companies,
  insertTripBudgetSchema,
  insertTripExpenseSchema,
  TransactionSource,
  TransactionType
} from "@shared/schema";


import { setupAuthRoutes } from "./auth"; // Mantenemos para compatibilidad
import { setupAuthentication } from "./auth-session";
// Utility function to check if two locations are in the same city
function isSameCity(location1: string, location2: string): boolean {
  // Validar que ambas ubicaciones tienen el formato esperado
  if (!location1.includes(' - ') || !location2.includes(' - ')) {
    console.warn(`Formato de ubicación inesperado: "${location1}" o "${location2}"`);
    return false;
  }
  
  // Extract city name (assuming format "City, State - Location")
  const city1 = location1.split(' - ')[0].trim();
  const city2 = location2.split(' - ')[0].trim();
  
  // Debugging
  console.log(`Comparando ciudades: "${city1}" y "${city2}" => ${city1 === city2}`);
  
  return city1 === city2;
}
import { populateLocationData } from "./populate-locations";
import { db } from "./db";
import { setupFinancialRoutes } from "./financial-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const apiRouter = (path: string) => `/api${path}`;

  // Setup session-based auth system
  const { isAuthenticated, hasRole } = setupAuthentication(app);
  
  // Setup authentication routes (both old and new)
  // Pasamos el middleware de autenticación al setup de rutas de autenticación
  setupAuthRoutes(app, isAuthenticated);
  
  // Populate location data on server start
  try {
    await populateLocationData();
    // Location data loaded successfully
  } catch (error) {
    // Error loading location data
  }

  // LOCATION DATA ENDPOINT
  app.get(apiRouter("/locations"), async (req: Request, res: Response) => {
    try {
      const locations = await db.select().from(locationData);
      res.json(locations);
    } catch (error) {
      // Error fetching location data
      res.status(500).json({ error: "Failed to fetch location data" });
    }
  });

  // ROUTES ENDPOINTS
  app.get(apiRouter("/routes"), async (req: Request, res: Response) => {
    try {
      // Obtener usuario autenticado y su compañía
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        // User access logged
        
        // ACCESO TOTAL solo para superAdmin y developer - sin restricciones
        if (user.role === UserRole.SUPER_ADMIN || 
            user.role === UserRole.DEVELOPER) {
          // Full access granted
          // No establecer companyId para estos roles para ver TODAS las rutas
        } 
        // ACCESO PARA ADMIN - solo ver rutas de su compañía
        else if (user.role === UserRole.ADMIN) {
          // Admin access with company filter
          if (user.companyId || user.company) {
            companyId = user.companyId || user.company;
          } else {
            // Admin without company defined
          }
        } else {
          // USUARIOS NORMALES - Filtrar por su compañía
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            // User without company - no routes shown
            return res.json([]);
          }
          
          // Querying routes for company
        }
      } else {
        // Usuario no autenticado
        // Anonymous access - showing public routes
      }
      
      // Usar la función actualizada que filtra directamente en la base de datos
      const routes = await storage.getRoutes(companyId || undefined);
      // Routes found
      
      res.json(routes);
    } catch (error) {
      // Error fetching routes
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get(apiRouter("/routes/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const route = await storage.getRoute(id);
      
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Obtener usuario autenticado y su compañía
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        companyId = user.companyId || user.company;
      }
      
      // Verificar acceso a la ruta
      // Los usuarios ADMIN también deben tener restricción por compañía
      if (companyId && 
          user.role !== UserRole.SUPER_ADMIN && 
          user.role !== UserRole.DEVELOPER &&
          route.companyId !== companyId) {
        return res.status(403).json({ error: "No tiene permiso para acceder a esta ruta" });
      }
      
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.get(apiRouter("/routes/:id/segments"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const routeWithSegments = await storage.getRouteWithSegments(id);
      
      if (!routeWithSegments) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Check for same-city segments and filter them out
      const validSegments = routeWithSegments.segments.filter(
        segment => !isSameCity(segment.origin, segment.destination)
      );
      
      res.json({
        ...routeWithSegments,
        segments: validSegments
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route segments" });
    }
  });

  app.post(apiRouter("/routes"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Request received
      
      // Primero verificamos si los campos requeridos están presentes
      if (!req.body.name || !req.body.origin || !req.body.destination) {
        // Missing required data
        return res.status(400).json({ 
          error: "Datos incompletos", 
          details: "Se requieren los campos name, origin y destination" 
        });
      }
      
      // Obtener datos del usuario autenticado
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        // CRÍTICO: Obtener correctamente la compañía del usuario
        companyId = user.companyId || user.company;
        // User creating route
        
        // Verificar explícitamente si tenemos un valor de companyId
        if (!companyId) {
          // Alert: User without company
          
          // Para superAdmin, dueño y developer, asignar una compañía predeterminada
          if (user.role === UserRole.SUPER_ADMIN) {
            companyId = "viaja-facil-123";
            // Assigning default company for superAdmin
          } else if (user.role === UserRole.OWNER || user.role === UserRole.DEVELOPER) {
            companyId = "bamo-456";
            // Assigning default company
          } else {
            // Para otros roles, rechazar la solicitud
            // Warning: User without company trying to create route
            return res.status(400).json({
              error: "No se puede crear la ruta",
              details: "El usuario no tiene una compañía asignada"
            });
          }
        }
        
        console.log(`[POST /routes] COMPAÑÍA FINAL ASIGNADA: ${companyId} para usuario ${user.firstName} ${user.lastName}`);
      }
      
      // Asegurarse de que stops sea un array
      const stops = Array.isArray(req.body.stops) ? req.body.stops : [];
      
      // Crear un objeto con los datos seguros
      const safeRouteData = {
        name: req.body.name,
        origin: req.body.origin,
        destination: req.body.destination,
        stops: stops,
        companyId: companyId // Asignar compañía del usuario a la ruta
      };
      
      // Ahora validar (nota: validamos solo los campos obligatorios, companyId no necesita validación)
      const validationResult = createRouteValidationSchema.safeParse(safeRouteData);
      
      if (!validationResult.success) {
        console.log("Validación fallida:", validationResult.error.format());
        return res.status(400).json({ 
          error: "Datos de ruta inválidos", 
          details: validationResult.error.format() 
        });
      }
      
      console.log("Datos validados correctamente:", safeRouteData);
      const route = await storage.createRoute(safeRouteData);
      console.log("Ruta creada con éxito:", route);
      res.status(201).json(route);
    } catch (error: any) {
      console.error("Error al crear ruta:", error?.message || error);
      res.status(500).json({ error: "Error al crear ruta", details: error?.message || "Error desconocido" });
    }
  });

  app.put(apiRouter("/routes/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const validationResult = insertRouteSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid route data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // SEGURIDAD: Verificar que el usuario tiene permisos para editar esta ruta
      // Primero, obtener la ruta para verificar la compañía
      const existingRoute = await storage.getRoute(id);
      
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Si no es superAdmin, verificar que la ruta pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (existingRoute.companyId && existingRoute.companyId !== userCompany) {
          // Access denied: route belongs to different company
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para editar rutas de otra compañía" 
          });
        }
      }
      
      // Preservar el ID de compañía original si el usuario no es superAdmin
      const routeData = validationResult.data;
      if (user.role !== UserRole.SUPER_ADMIN) {
        routeData.companyId = existingRoute.companyId;
      }

      // Verificar si tenemos stops definidos en la solicitud
      if (routeData.stops === undefined) {
        // No stops received in update, keeping existing ones
        // Si no se especificaron stops en la actualización, mantener los existentes
        routeData.stops = existingRoute.stops;
      } else {
        // Stops received for update
      }
      
      // Route update data prepared
      
      const updatedRoute = await storage.updateRoute(id, routeData);
      
      res.json(updatedRoute);
    } catch (error) {
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete(apiRouter("/routes/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // SEGURIDAD: Verificar que el usuario tiene permisos para eliminar esta ruta
      // Primero, obtener la ruta para verificar la compañía
      const existingRoute = await storage.getRoute(id);
      
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Si no es superAdmin, verificar que la ruta pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (existingRoute.companyId && existingRoute.companyId !== userCompany) {
          // Access denied: route belongs to different company
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para eliminar rutas de otra compañía" 
          });
        }
      }
      
      const success = await storage.deleteRoute(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete route" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // TRIPS ENDPOINTS
  
  // Ruta optimizada para obtener todos los viajes administrativos
  app.get(apiRouter("/admin-trips"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[GET /api/admin-trips] ENDPOINT OPTIMIZADO INICIADO - Usuario: ${user?.firstName || 'No auth'}`);
      
      // Verificar autenticación
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Simplificar lógica de autorización
      const userCompanyId = user.companyId || user.company || null;
      const hasFullAccess = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.TICKET_OFFICE;
      const isDriver = user.role === UserRole.DRIVER || user.role === 'CHOFER';
      
      // Parámetros de búsqueda desde la query
      const { origin, destination, date, seats, driverId } = req.query;
      const searchParams: any = {
        includeAllVisibilities: true,
        optimizedResponse: true, // Flag para respuesta optimizada sin duplicaciones
      };
      
      console.log(`[GET /api/admin-trips] searchParams con optimizedResponse:`, searchParams);
      
      // Aplicar filtros de búsqueda
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      if (date) searchParams.date = date as string;
      if (seats && !isNaN(parseInt(seats as string, 10))) {
        searchParams.seats = parseInt(seats as string, 10);
      }
      
      // Aplicar filtros de autorización consolidados
      if (isDriver) {
        // Para conductores: filtrar por su ID o el driverId especificado
        searchParams.driverId = driverId ? parseInt(driverId as string, 10) : user.id;
      } else if (!hasFullAccess) {
        // Para usuarios sin acceso completo: filtrar por compañía
        if (!userCompanyId) {
          return res.json([]);
        }
        searchParams.companyId = userCompanyId;
      }
      // Para usuarios con acceso completo, no aplicar filtros adicionales
      
      // Ejecutar búsqueda optimizada
      const trips = await storage.searchTrips(searchParams);
      
      // Respuesta optimizada sin datos redundantes
      const optimizedTrips = trips.map(trip => ({
        id: trip.id,
        routeId: trip.routeId,
        companyId: trip.companyId,
        departureDate: trip.departureDate,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        origin: trip.origin,
        destination: trip.destination,
        price: trip.price,
        availableSeats: trip.availableSeats,
        capacity: trip.capacity,
        visibility: trip.visibility,
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        // Solo metadatos esenciales
        routeName: trip.routeName || '',
        companyName: trip.companyName || ''
      }));
      
      res.json(optimizedTrips);
    } catch (error: any) {
      console.error("Error al obtener viajes administrativos:", error.message);
      res.status(500).json({ error: "Error al obtener viajes" });
    }
  });

  // Ruta estándar para buscar viajes (solo muestra los publicados por defecto) - OPTIMIZADA
  app.get(apiRouter("/trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /trips] ENDPOINT OPTIMIZADO INICIADO - Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Parámetros de búsqueda desde la query
      const { origin, destination, date, dateRange, seats, driverId, visibility } = req.query;
      const searchParams: any = {
        optimizedResponse: true, // Flag para respuesta optimizada sin duplicaciones
      };
      
      // Agregar parámetros de búsqueda si existen
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      
      // Manejar fecha o rango de fechas
      if (dateRange) {
        searchParams.dateRange = (dateRange as string).split(',');
        console.log(`[GET /trips] Usando rango de fechas optimizado:`, searchParams.dateRange);
      } else if (date) {
        searchParams.date = date as string;
      }
      
      // Agregar filtro de visibilidad si se especifica
      if (visibility) {
        searchParams.visibility = visibility as string;
      }
      
      if (seats && !isNaN(parseInt(seats as string, 10))) {
        searchParams.seats = parseInt(seats as string, 10);
      }
      
      // Agregar filtro por conductor (driverId) si existe
      if (driverId && !isNaN(parseInt(driverId as string, 10))) {
        searchParams.driverId = parseInt(driverId as string, 10);
        console.log(`[GET /trips] Filtro por conductor ID: ${searchParams.driverId}`);
      }
      
      // APLICAR FILTRO DE COMPAÑÍA - PARTE CRÍTICA
      if (user) {
        // CASO ESPECIAL PARA CONDUCTORES: Filtrar por su ID de usuario cuando son role=DRIVER
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          console.log(`[GET /trips] Usuario es CONDUCTOR (ID: ${user.id}), filtrando viajes asignados`);
          
          if (!searchParams.driverId) {
            searchParams.driverId = user.id;
            console.log(`[GET /trips] Asignando driverId=${user.id} automáticamente para conductor`);
          }
          
          const userCompanyId = user.companyId || user.company || null;
          if (userCompanyId) {
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía para conductor: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Conductor sin compañía asignada, aplicando solo filtro por driverId`);
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          console.log(`[GET /trips] Usuario es TAQUILLERO (ID: ${user.id}), obteniendo empresas asociadas`);
          
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            console.log(`[GET /trips] Taquillero sin empresas asociadas, no verá ningún viaje`);
            return res.json({ trips: [], companies: {} });
          }
          
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          console.log(`[GET /trips] Taquillero con ${companyIds.length} empresas asociadas: ${companyIds.join(', ')}`);
          
          searchParams.companyIds = companyIds;
          
        } else if (user.role !== UserRole.SUPER_ADMIN) {
          const userCompanyId = user.companyId || user.company || null;
          
          if (userCompanyId) {
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía aplicado: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Usuario sin compañía asignada, no verá ningún viaje`);
            return res.json({ trips: [], companies: {} });
          }
        } else {
          console.log(`[GET /trips] Usuario ${user.firstName} con rol ${user.role} - ACCESO TOTAL (sin filtrar compañía)`);
          searchParams.companyId = 'ALL'; 
        } 
      } else {
        console.log(`[GET /trips] Usuario no autenticado - mostrando solo viajes públicos`);
        searchParams.visibility = 'publicado';
        searchParams.companyId = 'ALL';
      }
      
      console.log(`[GET /trips] Parámetros de búsqueda finales con optimizedResponse:`, searchParams);
      const trips = await storage.searchTrips(searchParams);
      
      console.log(`[GET /trips] Encontrados ${trips.length} viajes`);
      
      // APLICAR OPTIMIZACIÓN: Eliminar duplicaciones y estructurar respuesta
      const tripsMap = new Map();
      const companiesMap = new Map();
      
      for (const trip of trips) {
        const recordId = trip.recordId || trip.id;
        
        // Si ya procesamos este recordId, saltar
        if (tripsMap.has(recordId)) {
          continue;
        }
        
        // Agregar viaje al mapa
        tripsMap.set(recordId, {
          id: recordId,
          recordId: recordId,
          capacity: trip.capacity,
          vehicleId: trip.vehicleId,
          driverId: trip.driverId,
          visibility: trip.visibility,
          routeId: trip.routeId,
          companyId: trip.companyId,
          tripData: trip.tripData,
          route: trip.route,
          numStops: trip.numStops
        });
        
        // Agregar información de compañía si existe
        if (trip.companyId && trip.companyName) {
          companiesMap.set(trip.companyId, {
            name: trip.companyName,
            logo: trip.companyLogo
          });
        }
      }
      
      // Convertir mapas a arrays y objeto
      const optimizedTrips = Array.from(tripsMap.values());
      const companies = Object.fromEntries(companiesMap);
      
      console.log(`[GET /trips] OPTIMIZACIÓN COMPLETADA: ${trips.length} elementos -> ${optimizedTrips.length} viajes únicos`);
      console.log(`[GET /trips] Información de ${Object.keys(companies).length} compañías incluida`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      if (user && user.role !== UserRole.SUPER_ADMIN) {
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          const viajesNoAsignados = optimizedTrips.filter(t => t.driverId !== user.id);
          
          if (viajesNoAsignados.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesNoAsignados.length} viajes no asignados al conductor!`);
            const viajesFiltrados = optimizedTrips.filter(t => t.driverId === user.id);
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes asignados al conductor ${user.id}`);
            
            return res.json({ trips: viajesFiltrados, companies });
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            return res.json({ trips: [], companies: {} });
          }
          
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          const viajesDeOtrasCompanias = optimizedTrips.filter(t => 
            t.companyId && !companyIds.includes(t.companyId)
          );
          
          if (viajesDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de compañías no asignadas al taquillero!`);
            const viajesFiltrados = optimizedTrips.filter(t => 
              t.companyId && companyIds.includes(t.companyId)
            );
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de las compañías asignadas`);
            
            return res.json({ trips: viajesFiltrados, companies });
          }
        } else {
          const userCompany = user.companyId || user.company || null;
          
          if (userCompany) {
            const viajesDeOtrasCompanias = optimizedTrips.filter(t => t.companyId && t.companyId !== userCompany);
            
            if (viajesDeOtrasCompanias.length > 0) {
              console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de otras compañías!`);
              const viajesFiltrados = optimizedTrips.filter(t => t.companyId === userCompany);
              console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de compañía ${userCompany}`);
              
              return res.json({ trips: viajesFiltrados, companies });
            }
          }
        }
      }
      
      return res.json({ trips: optimizedTrips, companies });
    } catch (error: any) {
      console.error("[GET /trips] Error al obtener viajes:", error);
      console.error("[GET /trips] Stack trace:", error.stack);
      res.status(500).json({ error: "Error al obtener viajes", details: error.message });
    }
  });

  app.get(apiRouter("/trips/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Primero obtenemos el viaje
      const trip = await storage.getTripWithRouteInfo(id);
      
      if (!trip) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }
      
      console.log(`[GET /trips/${id}] Viaje encontrado - companyId: ${trip.companyId || 'No definido'}`);
      
      // SEGURIDAD: Verificar permisos según el rol y compañía del usuario
      if (user) {
        // Los usuarios con rol superAdmin y taquilla (ticket_office) pueden ver todos los viajes
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.TICKET_OFFICE) {
          // CASO ESPECIAL: Verificar que los conductores solo vean los viajes asignados a ellos
          // CONDUCTOR (CHOFER): Permitimos acceso simplificado para fines de depuración
          if (user.role === UserRole.DRIVER || user.role === 'CHOFER' || user.role === 'chofer') {
            console.log(`[GET /trips/${id}] VERIFICACIÓN CONDUCTOR: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
            
            // SOLUCIÓN TEMPORAL: Permitir acceso a TODOS los viajes para los conductores
            // Esto es necesario para que puedan ver las reservaciones y pasajeros asignados a su compañía
            console.log(`[GET /trips/${id}] ACCESO TEMPORAL HABILITADO: Permitiendo al conductor ver todos los viajes de su compañía`);
            
            // Devolver el viaje directamente
            return res.json(trip);
          }
          
          // Para todos los roles, verificar también que el viaje pertenezca a su compañía
          const userCompanyId = user.companyId || user.company || null;
          
          if (!userCompanyId) {
            console.log(`[GET /trips/${id}] Usuario sin compañía asignada intenta acceder a un viaje`);
            return res.status(403).json({ 
              error: "No tiene permiso para ver este viaje",
              details: "Usuario sin compañía asignada" 
            });
          }
          
          if (trip.companyId && trip.companyId !== userCompanyId) {
            console.log(`[GET /trips/${id}] ACCESO DENEGADO: Viaje pertenece a compañía ${trip.companyId} pero usuario es de ${userCompanyId}`);
            return res.status(403).json({ 
              error: "No tiene permiso para ver este viaje",
              details: "El viaje pertenece a otra compañía" 
            });
          }
          
          console.log(`[GET /trips/${id}] Acceso permitido: El viaje pertenece a la misma compañía del usuario (${userCompanyId})`);
        } else {
          console.log(`[GET /trips/${id}] Acceso permitido: Usuario con rol ${user.role} puede ver todos los viajes`);
        }
      } else {
        // Para usuarios no autenticados, verificar si el viaje es público
        // Por ahora, permitir ver el viaje pero se podría ajustar según necesidades
        console.log(`[GET /trips/${id}] Usuario no autenticado accediendo al viaje`);
      }
      
      // Si llegamos aquí, el usuario tiene permiso para ver el viaje
      res.json(trip);
    } catch (error) {
      console.error(`Error al obtener viaje por ID: ${error}`);
      res.status(500).json({ error: "Error al obtener información del viaje" });
    }
  });

  app.post(apiRouter("/trips"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validationResult = publishTripValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Datos de viaje inválidos", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener los datos del usuario autenticado
      const { user } = req as any;
      
      console.log(`[POST /trips] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // SEGURIDAD: Verificar que el usuario tenga una compañía asignada
      let companyId = user.companyId || user.company || null;
      
      if (!companyId) {
        console.log(`[POST /trips] ERROR: Usuario sin companyId intenta crear un viaje`);
        return res.status(403).json({
          error: "No puede crear viajes",
          details: "El usuario no tiene una compañía asignada"
        });
      }
      
      console.log(`[POST /trips] CREANDO VIAJE PARA COMPAÑÍA: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
      
      // Verificar que el usuario tenga permisos para crear viajes
      // En este caso, solo los roles superAdmin, admin, owner y developer
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(user.role)) {
        console.log(`[POST /trips] DENEGADO: Usuario con rol ${user.role} no tiene permisos para crear viajes`);
        return res.status(403).json({
          error: "Acceso denegado",
          details: "No tiene permisos para crear viajes"
        });
      }
      
      const tripData = validationResult.data;
      
      // Calculate departure/arrival time from stopTimes
      let departureTime = "";
      let arrivalTime = "";
      
      if (tripData.stopTimes && tripData.stopTimes.length > 0) {
        const stopTimes = tripData.stopTimes;
        // El primer tiempo de parada es la salida
        if (stopTimes[0] && stopTimes[0].hour && stopTimes[0].minute && stopTimes[0].ampm) {
          departureTime = `${stopTimes[0].hour.padStart(2, '0')}:${stopTimes[0].minute.padStart(2, '0')} ${stopTimes[0].ampm}`;
        }
        
        // El último tiempo de parada es la llegada
        if (stopTimes.length > 1) {
          const lastStop = stopTimes[stopTimes.length - 1];
          if (lastStop && lastStop.hour && lastStop.minute && lastStop.ampm) {
            arrivalTime = `${lastStop.hour.padStart(2, '0')}:${lastStop.minute.padStart(2, '0')} ${lastStop.ampm}`;
          }
        }
      }
      
      // Si no pudimos extraer los tiempos, usar valores predeterminados
      if (!departureTime) departureTime = "12:00 PM";
      if (!arrivalTime) arrivalTime = "01:00 PM";
      
      // Get the route details to generate all possible sub-trips
      const route = await storage.getRouteWithSegments(tripData.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Create a trip for each date in the range
      const startDate = new Date(tripData.startDate);
      const endDate = new Date(tripData.endDate);
      const createdTrips = [];
      
      // Generate all possible segments (direct and intermediate segments)
      const allSegments = generateAllPossibleSegments(route);
      
      // Si hay stopTimes en la petición, agregarlo a los segmentos para usar tiempos personalizados
      const tripDataWithStopTimes = tripData as any;
      if (tripDataWithStopTimes.stopTimes && Array.isArray(tripDataWithStopTimes.stopTimes)) {
        console.log("stopTimes recibidos en la petición:", tripDataWithStopTimes.stopTimes);
        // Añadir stopTimes a todos los segmentos para que estén disponibles en calculateSegmentTimes
        allSegments.forEach(segment => {
          (segment as any).stopTimes = tripDataWithStopTimes.stopTimes;
        });
      }

      // Calculate segment times based on total journey time
      const segmentTimes = calculateSegmentTimes(
        allSegments, 
        departureTime, 
        arrivalTime,
        route
      );
      
      // Iterar por cada fecha del rango para crear viajes independientes
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const currentDateStr = date.toISOString().split('T')[0];
        console.log(`\n=== CREANDO VIAJE PARA FECHA: ${currentDateStr} ===`);
        
        // Crear el array de combinaciones para trip_data de esta fecha específica
        const tripCombinations = [];
        
        // Agregar el viaje principal (origen a destino)
        const mainSegmentPrice = tripData.segmentPrices.find(
          (sp: any) => sp.origin === route.origin && sp.destination === route.destination
        );
        
        // Calcular departureDate para el viaje principal
        const mainDayOffset = extractDayIndicator(departureTime);
        const mainDepartureDate = new Date(date);
        if (mainDayOffset > 0) {
          mainDepartureDate.setDate(mainDepartureDate.getDate() + mainDayOffset);
        }
        
        tripCombinations.push({
          tripId: Date.now(),
          origin: route.origin,
          destination: route.destination,
          departureDate: mainDepartureDate.toISOString().split('T')[0],
          departureTime: departureTime.replace(/\s*\+\d+d$/, ''),
          arrivalTime: arrivalTime.replace(/\s*\+\d+d$/, ''),
          price: mainSegmentPrice?.price || 450,
          availableSeats: tripData.capacity,
          isMainTrip: true
        });
        
        console.log(`Viaje principal: ${route.origin} → ${route.destination}`);
        console.log(`  departureDate: ${mainDepartureDate.toISOString().split('T')[0]} (offset: +${mainDayOffset}d)`);
        
        // Agregar todos los segmentos parciales
        for (const segment of allSegments) {
          // Saltar el viaje principal ya que ya lo agregamos arriba
          if (segment.origin === route.origin && segment.destination === route.destination) {
            continue;
          }
          
          const segmentData = tripData.segmentPrices.find(
            (sp: any) => sp.origin === segment.origin && sp.destination === segment.destination
          );
          
          let segmentPrice = segmentData?.price || calculateProportionalPrice(segment, route, tripData.price || 0);
          let segmentDepartureTime = segmentTimes[`${segment.origin}-${segment.destination}`]?.departureTime || departureTime;
          let segmentArrivalTime = segmentTimes[`${segment.origin}-${segment.destination}`]?.arrivalTime || arrivalTime;
          
          // Calcular departureDate para este segmento basándose en la fecha del viaje actual + offset
          const segmentDayOffset = extractDayIndicator(segmentDepartureTime);
          const segmentDepartureDate = new Date(date);
          if (segmentDayOffset > 0) {
            segmentDepartureDate.setDate(segmentDepartureDate.getDate() + segmentDayOffset);
          }
          
          tripCombinations.push({
            tripId: Math.floor(Date.now() + Math.random() * 1000),
            origin: segment.origin,
            destination: segment.destination,
            departureDate: segmentDepartureDate.toISOString().split('T')[0],
            departureTime: segmentDepartureTime.replace(/\s*\+\d+d$/, ''),
            arrivalTime: segmentArrivalTime.replace(/\s*\+\d+d$/, ''),
            price: segmentPrice,
            availableSeats: tripData.capacity,
            isMainTrip: false
          });
          
          console.log(`Segmento: ${segment.origin} → ${segment.destination}`);
          console.log(`  departureDate: ${segmentDepartureDate.toISOString().split('T')[0]} (offset: +${segmentDayOffset}d)`);
        }
        
        console.log(`\nCreando viaje para ${currentDateStr} con ${tripCombinations.length} segmentos`);
        console.log("DEBUG: tripCombinations:", JSON.stringify(tripCombinations, null, 2));
        
        const mainTripToCreate = {
          tripData: tripCombinations,
          capacity: tripData.capacity,
          vehicleId: null,
          driverId: null,
          visibility: tripData.visibility || "publicado",
          routeId: tripData.routeId,
          companyId: companyId
        };
        
        const mainTrip = await storage.createTrip(mainTripToCreate);
        console.log(`✅ Viaje creado para ${currentDateStr} con ID: ${mainTrip.id}`);
        createdTrips.push(mainTrip);
      }
      
      res.status(201).json(createdTrips);
    } catch (error) {
      console.error("Error creating trips:", error);
      res.status(500).json({ error: "Failed to create trip" });
    }
  });
  
  // Función para detectar si un segmento de viaje cruza la medianoche
  function isCrossingMidnight(departureTime: string, arrivalTime: string): boolean {
    if (!departureTime || !arrivalTime) {
      console.log(`[isCrossingMidnight] Tiempos inválidos: ${departureTime} -> ${arrivalTime}`);
      return false;
    }
    
    try {
      // Extraer el tiempo sin posibles indicadores de día
      const cleanDeparture = departureTime.replace(/\s*\+\d+d$/, '').trim();
      const cleanArrival = arrivalTime.replace(/\s*\+\d+d$/, '').trim();
      
      // Extraer componentes de tiempo
      const deptParts = cleanDeparture.split(' ');
      const arrParts = cleanArrival.split(' ');
      
      // Si no tiene formato de 12 horas (AM/PM), no podemos determinar
      if (deptParts.length < 2 || arrParts.length < 2) {
        console.log(`[isCrossingMidnight] Formato inválido sin AM/PM: ${departureTime} -> ${arrivalTime}`);
        return false;
      }
      
      const deptTimeStr = deptParts[0];
      const deptAmPm = deptParts[1].toUpperCase(); // Normalizar a mayúsculas
      
      const arrTimeStr = arrParts[0];
      const arrAmPm = arrParts[1].toUpperCase(); // Normalizar a mayúsculas
      
      if (!deptTimeStr || !deptAmPm || !arrTimeStr || !arrAmPm) {
        console.log(`[isCrossingMidnight] Error en formato: ${departureTime} -> ${arrivalTime}`);
        return false;
      }
      
      // Validar que PM/AM son válidos
      if (!['AM', 'PM'].includes(deptAmPm) || !['AM', 'PM'].includes(arrAmPm)) {
        console.log(`[isCrossingMidnight] AM/PM inválido: ${deptAmPm}, ${arrAmPm}`);
        return false;
      }
      
      const [deptHourStr, deptMinuteStr] = deptTimeStr.split(':');
      const [arrHourStr, arrMinuteStr] = arrTimeStr.split(':');
      
      if (!deptHourStr || !deptMinuteStr || !arrHourStr || !arrMinuteStr) {
        console.log(`[isCrossingMidnight] Formato de hora:minuto inválido: ${departureTime} -> ${arrivalTime}`);
        return false;
      }
      
      const deptHour = parseInt(deptHourStr, 10);
      const deptMinute = parseInt(deptMinuteStr, 10);
      const arrHour = parseInt(arrHourStr, 10);
      const arrMinute = parseInt(arrMinuteStr, 10);
      
      // Validar rangos de horas/minutos
      if (isNaN(deptHour) || isNaN(deptMinute) || isNaN(arrHour) || isNaN(arrMinute) ||
          deptHour < 1 || deptHour > 12 || deptMinute < 0 || deptMinute > 59 ||
          arrHour < 1 || arrHour > 12 || arrMinute < 0 || arrMinute > 59) {
        console.log(`[isCrossingMidnight] Valores de hora/minuto inválidos: ${departureTime} -> ${arrivalTime}`);
        return false;
      }
      
      // Convertir a formato 24 horas para comparación
      let deptHour24 = deptHour;
      if (deptAmPm === 'PM' && deptHour !== 12) deptHour24 += 12;
      if (deptAmPm === 'AM' && deptHour === 12) deptHour24 = 0;
      
      let arrHour24 = arrHour;
      if (arrAmPm === 'PM' && arrHour !== 12) arrHour24 += 12;
      if (arrAmPm === 'AM' && arrHour === 12) arrHour24 = 0;
      
      // Convertir a minutos totales para una comparación más simple
      const deptMinTotal = deptHour24 * 60 + deptMinute;
      const arrMinTotal = arrHour24 * 60 + arrMinute;
      
      // Si son exactamente la misma hora, no cruza la medianoche
      if (deptMinTotal === arrMinTotal) {
        return false;
      }
      
      // Si el tiempo de llegada es menor que el de salida, significa que cruza la medianoche
      const isCrossing = arrMinTotal < deptMinTotal;
      console.log(`[isCrossingMidnight] ${departureTime} -> ${arrivalTime}: ${isCrossing ? 'SÍ cruza medianoche' : 'NO cruza medianoche'}`);
      return isCrossing;
    } catch (error) {
      console.error(`[isCrossingMidnight] Error analizando tiempos ${departureTime} -> ${arrivalTime}:`, error);
      return false;
    }
  }
  
  // Función para extraer el indicador de día de una cadena de tiempo
  function extractDayIndicator(timeString: string): number {
    if (!timeString) return 0;
    
    const dayIndicatorMatch = timeString.match(/\+(\d+)d$/);
    return dayIndicatorMatch ? parseInt(dayIndicatorMatch[1], 10) : 0;
  }
  
  // Función para agregar el indicador de día a un horario
  function addDayIndicator(timeString: string, days: number): string {
    // Si ya tiene un indicador, reemplazarlo
    const cleanedTime = timeString.replace(/\s*\+\d+d$/, '');
    return days > 0 ? `${cleanedTime} +${days}d` : cleanedTime;
  }
  
  // Helper function to generate all possible segments between stops
  function generateAllPossibleSegments(route: RouteWithSegments) {
    const allPoints = [route.origin, ...route.stops, route.destination];
    const allSegments = [];
    
    console.log(`Generando todos los segmentos para la ruta ${route.id}`);
    console.log(`Puntos en la ruta: ${allPoints.join(' -> ')}`);
    
    // Approach 1: Generate all possible combinations (not just consecutive stops)
    for (let i = 0; i < allPoints.length - 1; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        // Skip the main route (origin to destination) as it's already created separately
        if (i === 0 && j === allPoints.length - 1) {
          console.log(`Saltando ruta principal: ${allPoints[i]} -> ${allPoints[j]} (se crea por separado)`);
          continue;
        }
        
        // Skip segments where origin and destination are in the same city
        if (isSameCity(allPoints[i], allPoints[j])) {
          console.log(`Saltando segmento en misma ciudad: ${allPoints[i]} -> ${allPoints[j]}`);
          continue;
        }
        
        // ACTUALIZACIÓN: Eliminamos el filtro de segmentos cortos no significativos
        // para generar los mismos segmentos que se muestran en la interfaz de usuario
        
        allSegments.push({
          origin: allPoints[i],
          destination: allPoints[j],
          price: 0
        });
        
        console.log(`  + Segmento: ${allPoints[i]} -> ${allPoints[j]}`);
      }
    }
    
    console.log(`Generados ${allSegments.length} segmentos válidos para la ruta ${route.id} (coincidiendo con la cantidad mostrada en la interfaz)`);
    
    return allSegments;
  }
  
  // Helper function to calculate segment departure and arrival times
  function calculateSegmentTimes(
    segments: { origin: string; destination: string; price: number; stopTimes?: any[]; segmentPrices?: any[] }[],
    mainDepartureTime: string,
    mainArrivalTime: string,
    route: RouteWithSegments
  ) {
    const allPoints = [route.origin, ...route.stops, route.destination];
    const totalPoints = allPoints.length;
    const totalSegments = totalPoints - 1;
    
    // Resultado final: mapa de tiempos para cada segmento
    const segmentTimes: Record<string, { departureTime: string; arrivalTime: string; dayOffset?: number }> = {};
    console.log("Iniciando cálculo de tiempos para segmentos");
    
    // Analizar si el viaje principal cruza la medianoche
    const mainTripCrossesMidnight = isCrossingMidnight(mainDepartureTime, mainArrivalTime);
    console.log(`Viaje principal: ${mainDepartureTime} - ${mainArrivalTime}, cruza medianoche: ${mainTripCrossesMidnight}`);
    
    // Primero intentamos usar los tiempos definidos en segmentPrices (con mayor prioridad)
    const segmentPrices = segments[0]?.segmentPrices;
    if (segmentPrices && Array.isArray(segmentPrices) && segmentPrices.length > 0) {
      console.log("Verificando tiempos en segmentPrices", segmentPrices);
      
      // Recorrer cada segmentPrice para extraer los tiempos explícitamente configurados
      segments.forEach(segment => {
        const segmentData = segmentPrices.find(
          (sp: any) => sp.origin === segment.origin && sp.destination === segment.destination
        );
        
        if (segmentData) {
          let departureTime, arrivalTime;
          
          // Obtener tiempo de salida (dar prioridad al formato completo)
          if (segmentData.departureTime) {
            departureTime = segmentData.departureTime;
            console.log(`Usando tiempo de salida explícito: ${segment.origin} -> ${departureTime}`);
          } else if (segmentData.departureHour && segmentData.departureMinute && segmentData.departureAmPm) {
            departureTime = `${segmentData.departureHour}:${segmentData.departureMinute} ${segmentData.departureAmPm}`;
            console.log(`Componiendo tiempo de salida: ${segment.origin} -> ${departureTime}`);
          }
          
          // Obtener tiempo de llegada (dar prioridad al formato completo)
          if (segmentData.arrivalTime) {
            arrivalTime = segmentData.arrivalTime;
            console.log(`Usando tiempo de llegada explícito: ${segment.destination} -> ${arrivalTime}`);
          } else if (segmentData.arrivalHour && segmentData.arrivalMinute && segmentData.arrivalAmPm) {
            arrivalTime = `${segmentData.arrivalHour}:${segmentData.arrivalMinute} ${segmentData.arrivalAmPm}`;
            console.log(`Componiendo tiempo de llegada: ${segment.destination} -> ${arrivalTime}`);
          }
          
          // Si tenemos ambos tiempos configurados para este segmento, guardarlos
          if (departureTime && arrivalTime) {
            const key = `${segment.origin}-${segment.destination}`;
            segmentTimes[key] = { departureTime, arrivalTime };
            console.log(`✓ Configurados tiempos para segmento: ${segment.origin} -> ${segment.destination}`);
          }
        }
      });
      
      // Si tenemos tiempos para todos los segmentos, retornar directamente
      if (Object.keys(segmentTimes).length === segments.length) {
        console.log("✅ Usando tiempos configurados para todos los segmentos");
        return segmentTimes;
      } else {
        console.log(`Encontrados ${Object.keys(segmentTimes).length}/${segments.length} segmentos con tiempos configurados`);
      }
    }
    
    // Verificar si hay stopTimes personalizados en los datos de entrada
    const stopTimes = segments[0]?.stopTimes;
    const hasStopTimes = Array.isArray(stopTimes) && stopTimes.length > 0;
    
    if (hasStopTimes) {
      console.log("Usando tiempos de parada personalizados", stopTimes);
      
      // Crear un mapa de ubicaciones a tiempos
      const locationTimeMap: Record<string, string> = {};
      
      // Asignamos los tiempos a cada ubicación, asegurando que las paradas estén en el orden correcto
      const orderedStopTimes = [...stopTimes].sort((a, b) => {
        if (!a || !a.location || !b || !b.location) return 0;
        const indexA = allPoints.indexOf(a.location);
        const indexB = allPoints.indexOf(b.location);
        if (indexA === -1 || indexB === -1) return 0;
        return indexA - indexB;
      });
      
      orderedStopTimes.forEach((stopTime: any) => {
        if (stopTime && stopTime.location && stopTime.hour && stopTime.minute && stopTime.ampm) {
          // Asegurarnos de preservar exactamente el formato AM/PM como está en el input
          // y evitar que se convierta incorrectamente a AM
          const ampm = stopTime.ampm.toUpperCase(); // Normalizar a mayúsculas para evitar errores
          const timeString = `${stopTime.hour}:${stopTime.minute} ${ampm}`;
          locationTimeMap[stopTime.location] = timeString;
          console.log(`Estableciendo tiempo para ${stopTime.location}: ${timeString}`);
        }
      });
      
      // Si tenemos tiempos personalizados, usémoslos directamente
      const segmentTimes: Record<string, { departureTime: string; arrivalTime: string; dayOffset?: number }> = {};
      
      // Asegurarse de que los tiempos de origen y destino principal estén configurados correctamente
      if (!locationTimeMap[route.origin]) {
        locationTimeMap[route.origin] = mainDepartureTime;
        console.log(`Forzando tiempo de salida principal para ${route.origin}: ${mainDepartureTime}`);
      }
      
      if (!locationTimeMap[route.destination]) {
        locationTimeMap[route.destination] = mainArrivalTime;
        console.log(`Forzando tiempo de llegada principal para ${route.destination}: ${mainArrivalTime}`);
      }
      
      // Si tenemos suficientes tiempos personalizados, calcular segmentos basados en ellos
      if (Object.keys(locationTimeMap).length >= 2) {
        // Calcular los desplazamientos de día para cada ubicación
        const locationDayOffsets: Record<string, number> = {};
        
        // Inicializar todas las ubicaciones con desplazamiento 0
        allPoints.forEach(point => {
          locationDayOffsets[point] = 0;
        });
        
        // Recorrer puntos secuencialmente y detectar cruces de medianoche
        for (let i = 1; i < allPoints.length; i++) {
          const prevPoint = allPoints[i-1];
          const currPoint = allPoints[i];
          
          if (prevPoint && currPoint && locationTimeMap[prevPoint] && locationTimeMap[currPoint]) {
            // Verificar si este segmento cruza la medianoche
            const crossesMidnight = isCrossingMidnight(locationTimeMap[prevPoint], locationTimeMap[currPoint]);
            
            if (crossesMidnight) {
              // Todas las ubicaciones desde este punto en adelante están en el día siguiente
              console.log(`⚠️ Detectado cruce de medianoche entre ${prevPoint} y ${currPoint}`);
              
              // El desplazamiento de la ubicación actual es el de la anterior + 1
              locationDayOffsets[currPoint] = locationDayOffsets[prevPoint] + 1;
              
              // Actualizar todas las ubicaciones posteriores con el mismo desplazamiento
              for (let j = i + 1; j < allPoints.length; j++) {
                locationDayOffsets[allPoints[j]] = locationDayOffsets[currPoint];
              }
            } else {
              // Sin cruce de medianoche, heredar el mismo desplazamiento de la ubicación anterior
              locationDayOffsets[currPoint] = locationDayOffsets[prevPoint];
            }
          }
        }
        
        // Registrar los desplazamientos de día calculados
        allPoints.forEach(point => {
          if (locationDayOffsets[point] > 0) {
            console.log(`📆 Ubicación ${point} está en el día +${locationDayOffsets[point]}d`);
          }
        });
        
        // Primero, procesamos los segmentos directos entre paradas adyacentes
        for (let i = 0; i < allPoints.length - 1; i++) {
          const origin = allPoints[i];
          const destination = allPoints[i + 1];
          
          if (origin && destination && locationTimeMap[origin] && locationTimeMap[destination]) {
            const key = `${origin}-${destination}`;
            
            // Obtener los tiempos básicos
            let departureTime = locationTimeMap[origin];
            let arrivalTime = locationTimeMap[destination];
            
            // Añadir indicadores de día si es necesario
            if (locationDayOffsets[origin] > 0) {
              departureTime = addDayIndicator(departureTime, locationDayOffsets[origin]);
            }
            
            if (locationDayOffsets[destination] > 0) {
              arrivalTime = addDayIndicator(arrivalTime, locationDayOffsets[destination]);
            }
            
            segmentTimes[key] = {
              departureTime,
              arrivalTime,
              dayOffset: locationDayOffsets[destination] - locationDayOffsets[origin]
            };
            
            console.log(`Segmento ${origin} -> ${destination}: ${departureTime} - ${arrivalTime} (dayOffset: ${segmentTimes[key].dayOffset})`);
          }
        }
        
        // Luego, procesamos todos los segmentos no adyacentes
        segments.forEach(segment => {
          const key = `${segment.origin}-${segment.destination}`;
          
          // Solo procesar segmentos que no se hayan procesado aún
          if (!segmentTimes[key] && locationTimeMap[segment.origin] && locationTimeMap[segment.destination]) {
            // Obtener los tiempos básicos
            let departureTime = locationTimeMap[segment.origin];
            let arrivalTime = locationTimeMap[segment.destination];
            
            // Añadir indicadores de día si es necesario
            if (locationDayOffsets[segment.origin] > 0) {
              departureTime = addDayIndicator(departureTime, locationDayOffsets[segment.origin]);
            }
            
            if (locationDayOffsets[segment.destination] > 0) {
              arrivalTime = addDayIndicator(arrivalTime, locationDayOffsets[segment.destination]);
            }
            
            segmentTimes[key] = {
              departureTime,
              arrivalTime,
              dayOffset: locationDayOffsets[segment.destination] - locationDayOffsets[segment.origin]
            };
            
            console.log(`Segmento (no adyacente) ${segment.origin} -> ${segment.destination}: ${departureTime} - ${arrivalTime} (dayOffset: ${segmentTimes[key].dayOffset})`);
          }
        });
        
        // Si hemos podido calcular todos los segmentos usando tiempos personalizados, devolvemos esos
        if (Object.keys(segmentTimes).length === segments.length) {
          console.log("Usando exclusivamente tiempos personalizados para todos los segmentos");
          return segmentTimes;
        }
      }
    }
    
    // Si no hay suficientes tiempos personalizados o si faltan algunos segmentos, caemos al cálculo proporcional
    console.log("Usando cálculo proporcional para los tiempos de segmentos");
    
    // Calculate the total duration in minutes
    const departureTimeParts = mainDepartureTime.split(' ')[0].split(':');
    const departureHour = parseInt(departureTimeParts[0], 10);
    const departureMinute = parseInt(departureTimeParts[1], 10);
    const departureAmPm = mainDepartureTime.split(' ')[1];
    
    const arrivalTimeParts = mainArrivalTime.split(' ')[0].split(':');
    const arrivalHour = parseInt(arrivalTimeParts[0], 10);
    const arrivalMinute = parseInt(arrivalTimeParts[1], 10);
    const arrivalAmPm = mainArrivalTime.split(' ')[1];
    
    // Convert to 24-hour format
    let departure24Hour = departureHour;
    if (departureAmPm === 'PM' && departureHour < 12) departure24Hour += 12;
    if (departureAmPm === 'AM' && departureHour === 12) departure24Hour = 0;
    
    let arrival24Hour = arrivalHour;
    if (arrivalAmPm === 'PM' && arrivalHour < 12) arrival24Hour += 12;
    if (arrivalAmPm === 'AM' && arrivalHour === 12) arrival24Hour = 0;
    
    // Calculate total minutes
    const departureMinutes = departure24Hour * 60 + departureMinute;
    let arrivalMinutes = arrival24Hour * 60 + arrivalMinute;
    
    // Handle case where arrival is the next day
    if (arrivalMinutes < departureMinutes) {
      arrivalMinutes += 24 * 60; // Add 24 hours
    }
    
    const totalMinutes = arrivalMinutes - departureMinutes;
    
    // Allocate time proportionally to segments
    const minutesPerSegment = totalMinutes / totalSegments;
    
    // Create a map to store segment indices
    const pointIndices: Record<string, number> = {};
    allPoints.forEach((point, index) => {
      pointIndices[point] = index;
    });
    
    // Calculate times for each segment
    const calculatedSegmentTimes: Record<string, { departureTime: string; arrivalTime: string; dayOffset?: number }> = {};
    
    // Variable para rastrear cuando cruzamos la medianoche
    let crossesMidnight = arrivalMinutes > departureMinutes + (24 * 60 - departureMinutes);
    console.log(`[calculateSegmentTimes] ¿El viaje cruza la medianoche? ${crossesMidnight ? 'SÍ' : 'NO'}`);
    
    // Calcular a partir de qué minuto se cruza la medianoche (en caso de que aplique)
    const midnightCrossingMinute = crossesMidnight ? 
      departureMinutes + ((24 * 60 - departureMinutes) % (24 * 60)) : null;
    
    if (midnightCrossingMinute !== null) {
      console.log(`[calculateSegmentTimes] El viaje cruza la medianoche después de ${midnightCrossingMinute - departureMinutes} minutos del inicio`);
    }
    
    segments.forEach(segment => {
      const startIdx = pointIndices[segment.origin] as number;
      const endIdx = pointIndices[segment.destination] as number;
      
      // Calculate the proportional time
      const segmentStartMinutes = departureMinutes + (startIdx * minutesPerSegment);
      const segmentEndMinutes = departureMinutes + (endIdx * minutesPerSegment);
      
      // Determinar si este segmento cruza la medianoche o está completamente en el día siguiente
      const segmentIsAfterMidnight = midnightCrossingMinute !== null && 
        ((segmentStartMinutes >= midnightCrossingMinute) || 
         (segmentStartMinutes < midnightCrossingMinute && segmentEndMinutes >= midnightCrossingMinute));
      
      if (segmentIsAfterMidnight) {
        console.log(`[calculateSegmentTimes] Segmento ${segment.origin} -> ${segment.destination} ocurre después de la medianoche`);
      }
      
      // Convert back to 12-hour format, considerando el cambio de día
      // Para la hora de salida del segmento
      const segmentStartHour = Math.floor(segmentStartMinutes / 60) % 24;
      const segmentStartMinute = Math.floor(segmentStartMinutes % 60);
      const segmentStartAmPm = segmentStartHour >= 12 ? 'PM' : 'AM';
      const displayStartHour = segmentStartHour > 12 ? segmentStartHour - 12 : (segmentStartHour === 0 ? 12 : segmentStartHour);
      
      // Para la hora de llegada del segmento
      const segmentEndHour = Math.floor(segmentEndMinutes / 60) % 24;
      const segmentEndMinute = Math.floor(segmentEndMinutes % 60);
      const segmentEndAmPm = segmentEndHour >= 12 ? 'PM' : 'AM';
      const displayEndHour = segmentEndHour > 12 ? segmentEndHour - 12 : (segmentEndHour === 0 ? 12 : segmentEndHour);
      
      // Calcular días de desplazamiento (0 = mismo día, 1 = día siguiente, etc.)
      const startDayOffset = Math.floor(segmentStartMinutes / (24 * 60));
      const endDayOffset = Math.floor(segmentEndMinutes / (24 * 60));
      
      // Formatear tiempos incluyendo indicador de día siguiente si es necesario
      let segmentDepartureTime = `${String(displayStartHour).padStart(2, '0')}:${String(segmentStartMinute).padStart(2, '0')} ${segmentStartAmPm}`;
      let segmentArrivalTime = `${String(displayEndHour).padStart(2, '0')}:${String(segmentEndMinute).padStart(2, '0')} ${segmentEndAmPm}`;
      
      // Agregar indicador de día siguiente si corresponde
      if (startDayOffset > 0) {
        segmentDepartureTime += ` +${startDayOffset}d`;
        console.log(`[calculateSegmentTimes] Tiempo de salida para ${segment.origin} es ${startDayOffset} día(s) después`);
      }
      
      if (endDayOffset > 0) {
        segmentArrivalTime += ` +${endDayOffset}d`;
        console.log(`[calculateSegmentTimes] Tiempo de llegada para ${segment.destination} es ${endDayOffset} día(s) después`);
      }
      
      const key = `${segment.origin}-${segment.destination}`;
      calculatedSegmentTimes[key] = {
        departureTime: segmentDepartureTime,
        arrivalTime: segmentArrivalTime,
        dayOffset: endDayOffset - startDayOffset // Diferencia de días entre salida y llegada
      };
    });
    
    // Add the main route times
    const mainRouteKey = `${route.origin}-${route.destination}`;
    
    // Check if main trip crosses midnight
    const mainDayOffset = isCrossingMidnight(mainDepartureTime, mainArrivalTime) ? 1 : 0;
    
    calculatedSegmentTimes[mainRouteKey] = {
      departureTime: mainDepartureTime,
      arrivalTime: mainArrivalTime,
      dayOffset: mainDayOffset // 1 si cruza la medianoche, 0 si no
    };
    
    return calculatedSegmentTimes;
  }
  
  // Helper function to calculate proportional prices for segments
  function calculateProportionalPrice(
    segment: { origin: string; destination: string },
    route: RouteWithSegments,
    totalPrice: number | undefined
  ): number {
    // Si no hay precio total, usar valor predeterminado
    if (totalPrice === undefined) totalPrice = 0;
    const allPoints = [route.origin, ...route.stops, route.destination];
    const totalSegments = allPoints.length - 1;
    
    // Find the indices of the origin and destination in the route
    const originIndex = allPoints.indexOf(segment.origin);
    const destinationIndex = allPoints.indexOf(segment.destination);
    
    if (originIndex === -1 || destinationIndex === -1) {
      console.warn(`Ubicación no encontrada en la ruta: ${segment.origin} o ${segment.destination}`);
      return Math.round(totalPrice / 2); // Valor por defecto si no se encuentran los índices
    }
    
    // Calculate the number of segments this covers
    const segmentsCovered = destinationIndex - originIndex;
    
    // Asegurarnos de que el número de segmentos sea siempre positivo
    if (segmentsCovered <= 0) {
      console.warn(`Cálculo de segmentos inválido para ${segment.origin} -> ${segment.destination}`);
      return Math.round(totalPrice / 4); // Valor por defecto para segmentos con cálculo inválido
    }
    
    // Calcular la proporción basada en la distancia entre los puntos (asumiendo distancias iguales)
    const proportion = segmentsCovered / totalSegments;
    
    // Para evitar precios muy bajos, establecemos un mínimo de 1/4 del precio total
    const minProportion = 0.25;
    const effectiveProportion = Math.max(proportion, minProportion);
    
    // Redondear a múltiplos de 25 para precios más "limpios"
    const exactPrice = effectiveProportion * totalPrice;
    return Math.round(exactPrice / 25) * 25;
  }

  app.put(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Log detallado de la solicitud para diagnóstico
      console.log(`⬆️ PUT /trips/${id} - Datos recibidos:`, JSON.stringify(req.body, null, 2));
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
        console.log(`[PUT /trips/${id}] DEBUG - user.companyId: ${user.companyId}, user.company: ${user.company}`);
      }
      
      // Obtener viaje actual antes de actualizar
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Usar companyId (column company_id en la tabla users)
        const userCompanyId = user.companyId;
        
        if (!userCompanyId) {
          console.log(`[PUT /trips/${id}] ACCESO DENEGADO: Usuario sin companyId asignado`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "Usuario sin compañía asignada" 
          });
        }
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompanyId) {
          console.log(`[PUT /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para editar viajes de otra compañía" 
          });
        }
      }
      
      // Procesar la nueva estructura de datos JSON
      const { routeId, startDate, endDate, capacity, segmentPrices, stopTimes, vehicleId, driverId, visibility } = req.body;
      
      console.log(`[PUT /trips/${id}] Procesando actualización con nueva estructura JSON`);
      console.log(`[PUT /trips/${id}] segmentPrices recibidos:`, segmentPrices);
      console.log(`[PUT /trips/${id}] stopTimes recibidos:`, stopTimes);
      
      // Obtener información de la ruta para generar segmentos completos
      const route = await storage.getRoute(routeId || currentTrip.routeId);
      if (!route) {
        return res.status(400).json({ error: "Route not found" });
      }
      
      // Crear un mapa de horarios desde stopTimes
      const timeMap: Record<string, { departureTime: string; arrivalTime: string }> = {};
      
      if (stopTimes && Array.isArray(stopTimes)) {
        stopTimes.forEach((stop: any, index: number) => {
          const time = `${stop.hour}:${stop.minute} ${stop.ampm}`;
          timeMap[stop.location] = {
            departureTime: time,
            arrivalTime: index < stopTimes.length - 1 ? stopTimes[index + 1] ? `${stopTimes[index + 1].hour}:${stopTimes[index + 1].minute} ${stopTimes[index + 1].ampm}` : time : time
          };
        });
      }
      
      // PRESERVAR los tripId existentes del tripData original
      const existingTripData = Array.isArray(currentTrip.tripData) ? currentTrip.tripData : [];
      console.log(`[PUT /trips/${id}] tripData existente:`, existingTripData);
      
      // Crear mapa de tripId existentes por segmento (origin -> destination)
      const existingTripIdMap: Record<string, any> = {};
      existingTripData.forEach((trip: any) => {
        const key = `${trip.origin} -> ${trip.destination}`;
        existingTripIdMap[key] = trip;
      });
      
      // Generar el nuevo tripData PRESERVANDO los tripId existentes
      const newTripData: any[] = [];
      
      if (segmentPrices && Array.isArray(segmentPrices)) {
        let isFirstSegment = true;
        
        segmentPrices.forEach((segment: any) => {
          // Determinar si es el viaje principal (primer segmento completo de origen a destino)
          const isMainTrip = isFirstSegment && segment.origin === route.origin && segment.destination === route.destination;
          
          // Obtener horarios desde el mapa de tiempos
          const originTimes = timeMap[segment.origin] || { departureTime: segment.departureTime || "08:00 AM", arrivalTime: segment.arrivalTime || "12:00 PM" };
          const destinationTimes = timeMap[segment.destination] || { departureTime: segment.departureTime || "08:00 AM", arrivalTime: segment.arrivalTime || "12:00 PM" };
          
          // CRÍTICO: Buscar tripId existente para este segmento
          const segmentKey = `${segment.origin} -> ${segment.destination}`;
          const existingTrip = existingTripIdMap[segmentKey];
          const preservedTripId = existingTrip ? existingTrip.tripId : Date.now() + Math.random(); // Solo generar nuevo ID si no existe
          
          console.log(`[PUT /trips/${id}] Segmento ${segmentKey}: tripId ${existingTrip ? 'PRESERVADO' : 'NUEVO'} = ${preservedTripId}`);
          
          newTripData.push({
            price: segment.price || 0,
            origin: segment.origin,
            destination: segment.destination,
            tripId: preservedTripId, // PRESERVAR el tripId existente
            isMainTrip: isMainTrip,
            departureDate: startDate || currentTrip.tripData?.[0]?.departureDate || new Date().toISOString().split('T')[0],
            departureTime: originTimes.departureTime,
            arrivalTime: destinationTimes.arrivalTime,
            availableSeats: capacity || currentTrip.capacity
          });
          
          if (isFirstSegment) isFirstSegment = false;
        });
      }
      
      // Construir el objeto de actualización con solo las columnas de la tabla
      const updateData = {
        tripData: newTripData,
        capacity: capacity !== undefined ? capacity : currentTrip.capacity,
        vehicleId: vehicleId !== undefined ? vehicleId : currentTrip.vehicleId,
        driverId: driverId !== undefined ? driverId : currentTrip.driverId,
        visibility: visibility || currentTrip.visibility,
        routeId: routeId !== undefined ? routeId : currentTrip.routeId,
        companyId: currentTrip.companyId // Preservar companyId existente
      };
      
      console.log(`[PUT /trips/${id}] Actualizando viaje con datos:`, updateData);
      
      // Actualizar el viaje en la base de datos
      const updatedTrip = await storage.updateTrip(id, updateData);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found or could not be updated" });
      }
      
      console.log(`[PUT /trips/${id}] Viaje actualizado exitosamente`);
      
      // Retornar el viaje actualizado
      res.json(updatedTrip);
    } catch (error: any) {
      console.error(`[PUT /trips] Error al actualizar viaje:`, error.message);
      res.status(500).json({ error: "Error interno del servidor al actualizar el viaje" });
    }
  });

  app.delete(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[DELETE /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[DELETE /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Primero verificar que el viaje existe
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Usar companyId (column company_id en la tabla users)
        const userCompanyId = user.companyId;
        
        if (!userCompanyId) {
          console.log(`[DELETE /trips/${id}] ACCESO DENEGADO: Usuario sin companyId asignado`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "Usuario sin compañía asignada" 
          });
        }
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompanyId) {
          console.log(`[DELETE /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para eliminar viajes de otra compañía" 
          });
        }
      }
      
      const success = await storage.deleteTrip(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete trip" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete trip" });
    }
  });
  
  // Endpoint específico para asignar vehículo o conductor a un viaje (PATCH)
  app.patch(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      console.log(`PATCH /trips/${id} - Datos recibidos:`, req.body);
      
      // Validación de datos
      const validationResult = insertTripSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        console.error(`Validación fallida para PATCH /trips/${id}:`, validationResult.error.format());
        return res.status(400).json({ 
          error: "Invalid trip update data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PATCH /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PATCH /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Obtener viaje actual
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        console.error(`Viaje no encontrado para PATCH /trips/${id}`);
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompany) {
          console.log(`[PATCH /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para modificar viajes de otra compañía" 
          });
        }
      }
      
      // Datos a actualizar - solo permitir vehicleId y driverId en PATCH
      const updateData: Partial<any> = {};
      
      // Procesar vehicleId (si está presente)
      if (req.body.vehicleId !== undefined) {
        console.log(`Asignando vehículo ${req.body.vehicleId} al viaje ${id}`);
        // Convertir a número si viene como string
        updateData.vehicleId = typeof req.body.vehicleId === 'string' 
          ? parseInt(req.body.vehicleId, 10) 
          : req.body.vehicleId;
      }
      
      // Procesar driverId (si está presente)
      if (req.body.driverId !== undefined) {
        console.log(`Asignando conductor ${req.body.driverId} al viaje ${id}`);
        // Convertir a número si viene como string
        updateData.driverId = typeof req.body.driverId === 'string' 
          ? parseInt(req.body.driverId, 10) 
          : req.body.driverId;
      }
      
      // Si no hay datos para actualizar, devolver el trip actual
      if (Object.keys(updateData).length === 0) {
        console.log(`No hay datos para actualizar en PATCH /trips/${id}`);
        return res.json(currentTrip);
      }
      
      // Actualizar el viaje con los nuevos datos
      console.log(`Actualizando viaje ${id} con datos:`, updateData);
      const updatedTrip = await storage.updateTrip(id, updateData);
      
      if (!updatedTrip) {
        console.error(`Error al actualizar viaje ${id}`);
        return res.status(500).json({ error: "Failed to update trip" });
      }
      
      console.log(`Viaje ${id} actualizado correctamente:`, updatedTrip);
      res.json(updatedTrip);
    } catch (error) {
      console.error(`Error al procesar PATCH /trips:`, error);
      res.status(500).json({ error: "Failed to update trip" });
    }
  });

  // Debug endpoint - force extraction test
  app.get(apiRouter("/debug-extraction"), isAuthenticated, async (req, res) => {
    try {
      const reservations = await storage.getReservations("bamo-350045");
      const testReservation = reservations[0];
      
      if (!testReservation) {
        return res.json({ error: "No reservations found" });
      }

      res.json({
        reservationId: testReservation.id,
        tripId: testReservation.trip.id,
        origin: testReservation.trip.origin,
        destination: testReservation.trip.destination,
        departureTime: testReservation.trip.departureTime,
        routeOrigin: testReservation.trip.route?.origin,
        routeDestination: testReservation.trip.route?.destination
      });
    } catch (error) {
      console.error("[DEBUG] Error:", error);
      res.status(500).json({ error: "Debug failed" });
    }
  });

  // Endpoint temporal para diagnosticar extracción de datos
  app.get(apiRouter("/test-trip-extraction/:reservationId"), isAuthenticated, async (req, res) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      const reservation = await storage.getReservation(reservationId);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservación no encontrada" });
      }

      // Extraer tripDetails
      const tripDetails = typeof reservation.tripDetails === 'string' 
        ? JSON.parse(reservation.tripDetails) 
        : reservation.tripDetails;
      
      console.log(`[TEST] Reservación ${reservationId}:`, {
        tripDetails,
        recordId: tripDetails.recordId,
        specificTripId: tripDetails.tripId
      });

      // Obtener el trip con información de ruta
      const trip = await storage.getTripWithRouteInfo(tripDetails.recordId, tripDetails.tripId);
      
      console.log(`[TEST] Trip extraído:`, {
        id: trip?.id,
        origin: trip?.origin,
        destination: trip?.destination,
        departureTime: trip?.departureTime,
        segmentOrigin: trip?.segmentOrigin,
        segmentDestination: trip?.segmentDestination
      });

      res.json({
        reservation: {
          id: reservation.id,
          tripDetails
        },
        trip: trip ? {
          id: trip.id,
          origin: trip.origin,
          destination: trip.destination,
          departureTime: trip.departureTime,
          departureDate: trip.departureDate,
          segmentOrigin: trip.segmentOrigin,
          segmentDestination: trip.segmentDestination,
          isSubTrip: trip.isSubTrip
        } : null
      });
    } catch (error) {
      console.error(`[TEST] Error:`, error);
      res.status(500).json({ error: "Error en extracción de datos" });
    }
  });

  // RESERVATIONS ENDPOINTS
  app.get(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /reservations] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar filtros básicos
      let companyId: string | null = null;
      let tripId: number | null = null;
      let companyIds: string[] | undefined = undefined;
      let dateFilter: string | null = null;
      
      // Verificar si se solicita filtrar por viaje específico
      if (req.query.tripId) {
        tripId = parseInt(req.query.tripId as string, 10);
        console.log(`[GET /reservations] Filtrando por viaje ID: ${tripId}`);
      }
      
      // Verificar si se solicita filtrar por fecha específica
      if (req.query.date) {
        dateFilter = req.query.date as string;
        console.log(`[GET /reservations] Filtrando por fecha: ${dateFilter}`);
      }
      
      // Determinar filtros de seguridad según el rol
      if (user.role === UserRole.TICKET_OFFICE) {
        // Taquilleros: obtener sus compañías asignadas
        const userCompanyAssociations = await db
          .select()
          .from(userCompanies)
          .where(eq(userCompanies.userId, user.id));
        
        if (userCompanyAssociations.length === 0) {
          return res.json([]);
        }
        
        companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
        console.log(`[GET /reservations] Taquillero con ${companyIds.length} empresas asignadas`);
      } 
      else if (user.role === UserRole.DRIVER && tripId) {
        // Conductores: verificar que el viaje esté asignado a ellos
        const trip = await storage.getTrip(tripId);
        if (!trip || trip.driverId !== user.id) {
          return res.status(403).json({ error: "Acceso denegado a este viaje" });
        }
      }
      else if (user.role !== UserRole.SUPER_ADMIN && 
               user.role !== UserRole.ADMIN && 
               user.role !== UserRole.CHECKER) {
        // Otros roles: filtrar por su compañía
        companyId = user.companyId || user.company;
        if (!companyId) {
          return res.json([]);
        }
      }
      
      // Use the updated DatabaseStorage method with tripDetails JSON support
      console.log(`[GET /reservations] Using DatabaseStorage with tripDetails JSON support`);
      
      try {
        // Get reservations using the updated storage method
        const reservations = await storage.getReservations(companyId);
        
        // Apply additional filtering if needed
        let filteredReservations = reservations;
        
        // Filter by date if provided
        if (dateFilter) {
          console.log(`[GET /reservations] Filtering by date: ${dateFilter}`);
          filteredReservations = reservations.filter(reservation => {
            if (!reservation.trip?.departureDate) return false;
            const reservationDate = new Date(reservation.trip.departureDate);
            const targetDate = new Date(dateFilter);
            return reservationDate.toDateString() === targetDate.toDateString();
          });
        } else {
          // Without date filter: return ALL reservations to let frontend handle filtering
          console.log(`[GET /reservations] Returning ALL reservations for frontend filtering`);
          filteredReservations = reservations;
        }
        
        console.log(`[GET /reservations] Returning ${filteredReservations.length} reservations`);
        res.json(filteredReservations);
      } catch (error) {
        console.error(`[GET /reservations] Error:`, error);
        return res.status(500).json({ error: "Error interno al obtener reservaciones" });
      }
    } catch (error: any) {
      console.error("[GET /reservations] Error:", error);
      res.status(500).json({ error: "Error al obtener reservaciones" });
    }
  });

  // Endpoint for archived reservations (past dates only)
  app.get(apiRouter("/reservations/archived"), async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /reservations/archived] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar filtros básicos
      let companyId: string | null = null;
      let tripId: number | null = null;
      let companyIds: string[] | undefined = undefined;
      let dateFilter: string | null = null;
      
      // Verificar si se solicita filtrar por viaje específico
      if (req.query.tripId) {
        tripId = parseInt(req.query.tripId as string, 10);
        console.log(`[GET /reservations/archived] Filtrando por viaje ID: ${tripId}`);
      }
      
      // Verificar si se solicita filtrar por fecha específica
      if (req.query.date) {
        dateFilter = req.query.date as string;
        console.log(`[GET /reservations/archived] Filtrando por fecha: ${dateFilter}`);
      }
      
      // Determinar filtros de seguridad según el rol
      if (user.role === UserRole.TICKET_OFFICE) {
        // Taquilleros: obtener sus compañías asignadas
        const userCompanyAssociations = await db
          .select()
          .from(userCompanies)
          .where(eq(userCompanies.userId, user.id));
        
        if (userCompanyAssociations.length === 0) {
          return res.json([]);
        }
        
        companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
        console.log(`[GET /reservations/archived] Taquillero con ${companyIds.length} empresas asignadas`);
      } 
      else if (user.role === UserRole.DRIVER && tripId) {
        // Conductores: verificar que el viaje esté asignado a ellos
        const trip = await storage.getTrip(tripId);
        if (!trip || trip.driverId !== user.id) {
          return res.status(403).json({ error: "Acceso denegado a este viaje" });
        }
      }
      else if (user.role !== UserRole.SUPER_ADMIN && 
               user.role !== UserRole.ADMIN && 
               user.role !== UserRole.CHECKER) {
        // Otros roles: filtrar por su compañía
        companyId = user.companyId || user.company;
        if (!companyId) {
          return res.json([]);
        }
      }
      
      // Use the updated DatabaseStorage method with tripDetails JSON support
      console.log(`[GET /reservations/archived] Using DatabaseStorage with tripDetails JSON support`);
      
      try {
        // Get reservations using the updated storage method
        const reservations = await storage.getReservations(companyId);
        
        // Apply additional filtering if needed
        let filteredReservations = reservations;
        
        // Filter by date if provided
        if (dateFilter) {
          console.log(`[GET /reservations/archived] Filtering by date: ${dateFilter}`);
          filteredReservations = reservations.filter(reservation => {
            if (!reservation.trip?.departureDate) return false;
            const reservationDate = new Date(reservation.trip.departureDate);
            const targetDate = new Date(dateFilter);
            return reservationDate.toDateString() === targetDate.toDateString();
          });
        } else {
          // Show only archived reservations (past dates)
          console.log(`[GET /reservations/archived] Showing only archived reservations`);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          filteredReservations = reservations.filter(reservation => {
            if (!reservation.trip?.departureDate) return false;
            const reservationDate = new Date(reservation.trip.departureDate);
            reservationDate.setHours(0, 0, 0, 0);
            return reservationDate < today;
          });
        }
        
        console.log(`[GET /reservations/archived] Returning ${filteredReservations.length} archived reservations`);
        res.json(filteredReservations);
      } catch (error) {
        console.error(`[GET /reservations/archived] Error:`, error);
        return res.status(500).json({ error: "Error interno al obtener reservaciones archivadas" });
      }
    } catch (error: any) {
      console.error("[GET /reservations/archived] Error:", error);
      res.status(500).json({ error: "Error al obtener reservaciones archivadas" });
    }
  });

  app.get(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /reservations/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /reservations/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Control de acceso a datos por compañía
      let companyId: string | null = null;
      
      // Para simplificar el acceso, temporalmente permitimos acceso si el usuario está autenticado
      const isTransferredToUser = false;
      
      console.log(`[GET /reservations/${id}] Verificando acceso para usuario autenticado`);
      
      // REGLAS DE ACCESO:
      // 1. superAdmin, admin, checador y taquilla pueden ver TODAS las reservaciones (sin filtro)
      // 2. Si la reservación ha sido transferida al usuario o su compañía, puede verla
      // 3. Todos los demás roles solo pueden ver reservaciones de SU COMPAÑÍA
      if (user) {
        if (user.role !== UserRole.SUPER_ADMIN && 
            user.role !== UserRole.ADMIN && 
            user.role !== UserRole.TICKET_OFFICE && 
            user.role !== UserRole.CHECKER) {
              
          // Si ha sido transferida al usuario, se permite el acceso sin verificar compañía
          if (isTransferredToUser) {
            console.log(`[GET /reservations/${id}] Acceso permitido: Reservación transferida al usuario`);
          } else {
            // Obtener la compañía del usuario para verificación normal
            companyId = user.companyId || user.company;
            
            if (!companyId) {
              console.log(`[GET /reservations/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
              return res.status(403).json({ 
                error: "Acceso denegado", 
                details: "Usuario sin compañía asignada" 
              });
            }
            
            console.log(`[GET /reservations/${id}] Verificando permisos para compañía: ${companyId}`);
          }
        } else {
          console.log(`[GET /reservations/${id}] Usuario con rol ${user.role} puede ver todas las reservaciones`);
        }
      } else {
        console.log(`[GET /reservations/${id}] Acceso no autenticado denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener la reservación con filtrado por compañía
      const reservation = await storage.getReservationWithDetails(id, companyId || undefined);
      
      if (!reservation) {
        console.log(`[GET /reservations/${id}] No encontrada o acceso denegado`);
        return res.status(404).json({ error: "Reservación no encontrada" });
      }
      
      console.log(`[GET /reservations/${id}] Acceso concedido`);
      res.json(reservation);
    } catch (error) {
      console.error(`[GET /reservations/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener la reservación" });
    }
  });

  app.post(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      console.log("[POST /reservations] Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));
      
      // Asegurarnos de que el método de pago está definido (para usuarios que no tengan una versión actualizada del formulario)
      const formData = {
        ...req.body,
        paymentMethod: req.body.paymentMethod || "cash"
      };
      
      console.log("[POST /reservations] FormData después del procesamiento:", JSON.stringify(formData, null, 2));
      
      const validationResult = createReservationValidationSchema.safeParse(formData);
      
      if (!validationResult.success) {
        console.log("[POST /reservations] Validación fallida:");
        console.log("Datos recibidos:", JSON.stringify(formData, null, 2));
        console.log("Errores de validación:", JSON.stringify(validationResult.error.format(), null, 2));
        return res.status(400).json({ 
          error: "Invalid reservation data", 
          details: validationResult.error.format() 
        });
      }
      
      const reservationData = validationResult.data;
      
      // Get the trip using recordId from tripDetails
      const trip = await storage.getTrip(reservationData.tripDetails.recordId);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip record not found" });
      }
      
      console.log(`[POST /reservations] Verificando tripDetails: recordId=${reservationData.tripDetails.recordId}, tripId=${reservationData.tripDetails.tripId}, seats=${reservationData.tripDetails.seats}`);
      
      const passengerCount = reservationData.passengers.length;
      
      console.log(`[POST /reservations] Procesando reservación para ${passengerCount} pasajeros en viaje ${trip.id}`);
      
      // TODO: Adaptar validación de asientos para nuevo enfoque tripData JSON
      // Temporalmente comentado hasta implementar lógica específica del tripId
      /*
      console.log(`[POST /reservations] Asientos disponibles antes de la reservación: ${trip.availableSeats}`);
      
      if (trip.availableSeats < passengerCount) {
        return res.status(400).json({ 
          error: "Not enough available seats",
          available: trip.availableSeats,
          requested: passengerCount
        });
      }
      */
      
      // Create the reservation - usar tripDetails.seats para calcular precio
      const seatsRequested = reservationData.tripDetails.seats;
      const totalAmount = (reservationData.totalAmount || 0); // Ya viene calculado del frontend
      
      // Obtener el companyId del viaje para asignarlo a la reservación (aislamiento de datos)
      const companyId = trip.companyId;
      console.log(`Asignando companyId: ${companyId || 'null'} a la nueva reservación (heredado del viaje ${trip.id})`);
      
      // Obtener el usuario autenticado, si existe
      const { user } = req as any;
      
      // Si el frontend no envió createdBy pero hay un usuario autenticado, usamos su ID
      const createdByUserId = reservationData.createdBy || (user ? user.id : null);
      
      if (createdByUserId) {
        console.log(`Registrando usuario creador de la reservación: ID ${createdByUserId}`);
      }
      
      // Verificar si hay un cupón y manejar el descuento
      let finalAmount = totalAmount;
      let discountAmount = 0;
      let couponCode = reservationData.couponCode || null;
      
      // Si se proporciona un código de cupón, verificar su validez y calcular el descuento
      if (couponCode) {
        try {
          console.log(`[POST /reservations] Verificando cupón: ${couponCode}`);
          const couponValidity = await storage.verifyCouponValidity(couponCode);
          
          if (couponValidity.valid && couponValidity.coupon) {
            const coupon = couponValidity.coupon;
            
            // Calcular descuento según el tipo
            if (coupon.discountType === 'percentage') {
              discountAmount = Math.round((totalAmount * coupon.discountValue) / 100);
            } else {
              discountAmount = Math.min(coupon.discountValue, totalAmount);
            }
            
            finalAmount = totalAmount - discountAmount;
            
            console.log(`[POST /reservations] Cupón válido: ${couponCode}, descuento: ${discountAmount}, monto final: ${finalAmount}`);
            
            // Incrementar el contador de uso del cupón
            await storage.incrementCouponUsage(coupon.id);
          } else {
            console.log(`[POST /reservations] Cupón inválido: ${couponCode}, mensaje: ${couponValidity.message}`);
            couponCode = null; // Si el cupón no es válido, no lo guardamos
          }
        } catch (error) {
          console.error(`[POST /reservations] Error al verificar cupón: ${error}`);
          couponCode = null;
        }
      }
      
      // Recalcular el estado de pago basado en el monto final con descuento aplicado
      let paymentStatus = "pendiente";
      if (reservationData.advanceAmount && reservationData.advanceAmount >= finalAmount) {
        paymentStatus = "pagado";
        console.log(`[POST /reservations] Marcando como PAGADO: anticipo ${reservationData.advanceAmount} cubre el monto final ${finalAmount}`);
      }
      
      const reservation = await storage.createReservation({
        tripDetails: reservationData.tripDetails,
        totalAmount: finalAmount, // Usamos el monto final con descuento
        email: reservationData.email,
        phone: reservationData.phone,
        paymentMethod: reservationData.paymentMethod || "cash", // Método de pago desde el formulario
        notes: reservationData.notes || null, // Incluir notas desde el formulario
        status: "confirmed",
        createdAt: new Date(),
        companyId: companyId || null,  // Heredar el companyId del viaje
        advanceAmount: reservationData.advanceAmount || 0, // Añadir campo de anticipo
        advancePaymentMethod: reservationData.advancePaymentMethod || "efectivo", // Añadir método de pago del anticipo
        paymentStatus: paymentStatus, // Estado del pago basado en el anticipo
        createdBy: createdByUserId, // ID del usuario que crea la reservación (para comisiones)
        couponCode: couponCode, // Guardar el código del cupón aplicado
        discountAmount: discountAmount, // Guardar el monto del descuento
        originalAmount: discountAmount > 0 ? totalAmount : null // Guardar el monto original si hay descuento
      });
      
      // Create the passengers
      const passengers = [];
      for (const passengerData of reservationData.passengers) {
        const passenger = await storage.createPassenger({
          firstName: passengerData.firstName,
          lastName: passengerData.lastName,
          reservationId: reservation.id
        });
        passengers.push(passenger);
      }
      
      // Actualizar asientos disponibles usando la nueva función con tripDetails
      try {
        const { recordId, tripId } = reservationData.tripDetails as { recordId: number, tripId: string };
        console.log(`[POST /reservations] Actualizando registro ${recordId}, segmento ${tripId} y viajes relacionados con cambio de -${passengerCount} asientos`);
        
        await storage.updateRelatedTripsAvailability(recordId, tripId, -passengerCount);
        console.log(`[POST /reservations] Asientos actualizados exitosamente para el registro ${recordId}, segmento ${tripId}`);
      } catch (e) {
        console.error("[POST /reservations] Error al actualizar viajes relacionados:", e);
        // No fallamos si esto falla, podemos seguir con la operación principal
      }
      
      // Crear transacción si hay anticipo (advanceAmount > 0)
      if (reservationData.advanceAmount && reservationData.advanceAmount > 0) {
        try {
          console.log(`[POST /reservations] DEPURACIÓN - Información completa de la reservación creada:`, JSON.stringify(reservation, null, 2));
          console.log(`[POST /reservations] DEPURACIÓN - Datos de pasajeros:`, JSON.stringify(passengers, null, 2));
          console.log(`[POST /reservations] DEPURACIÓN - Usuario creador:`, createdByUserId || (user ? user.id : null));
          console.log(`[POST /reservations] Creando transacción para anticipo de $${reservationData.advanceAmount}`);
          
          // Obtener información del viaje usando el recordId y tripId específicos
          const { recordId, tripId } = reservationData.tripDetails as { recordId: number, tripId: string };
          console.log(`[POST /reservations] DEPURACIÓN - Obteniendo información para recordId=${recordId}, tripId=${tripId}`);
          
          // Obtener la información específica del segmento del viaje
          const tripWithRouteInfo = await storage.getTripWithRouteInfo(recordId);
          console.log(`[POST /reservations] DEPURACIÓN - Información del viaje obtenida:`, JSON.stringify(tripWithRouteInfo, null, 2));
          
          // Extraer origen y destino del segmento específico usando tripId
          let origen = "";
          let destino = "";
          
          // Parsear tripData para obtener información del segmento específico
          if (tripWithRouteInfo && tripWithRouteInfo.tripData) {
            try {
              const tripDataArray = Array.isArray(tripWithRouteInfo.tripData) 
                ? tripWithRouteInfo.tripData 
                : JSON.parse(tripWithRouteInfo.tripData as string);
              
              console.log(`[POST /reservations] DEPURACIÓN - tripData parseado:`, JSON.stringify(tripDataArray, null, 2));
              
              // Buscar el segmento específico usando el índice del tripId sintético
              const tripIndex = parseInt(tripId.split("_")[1], 10);
              const targetSegment = tripDataArray[tripIndex];
              
              if (targetSegment) {
                console.log(`[POST /reservations] DEPURACIÓN - Segmento encontrado:`, JSON.stringify(targetSegment, null, 2));
                origen = targetSegment.origin || "";
                destino = targetSegment.destination || "";
                console.log(`[POST /reservations] Usando origen="${origen}" y destino="${destino}" del segmento ${tripId}`);
              } else {
                console.log(`[POST /reservations] ADVERTENCIA - No se encontró el segmento ${tripId} en tripData`);
                // Fallback a la información de la ruta si no se encuentra el segmento
                if (tripWithRouteInfo.route) {
                  origen = tripWithRouteInfo.route.origin;
                  destino = tripWithRouteInfo.route.destination;
                  console.log(`[POST /reservations] Usando fallback de ruta: origen="${origen}", destino="${destino}"`);
                }
              }
            } catch (parseError) {
              console.error(`[POST /reservations] Error al parsear tripData:`, parseError);
              // Fallback a la información de la ruta
              if (tripWithRouteInfo.route) {
                origen = tripWithRouteInfo.route.origin;
                destino = tripWithRouteInfo.route.destination;
                console.log(`[POST /reservations] Usando fallback de ruta por error de parseo: origen="${origen}", destino="${destino}"`);
              }
            }
          } else if (tripWithRouteInfo && tripWithRouteInfo.route) {
            // Fallback directo a información de ruta si no hay tripData
            origen = tripWithRouteInfo.route.origin;
            destino = tripWithRouteInfo.route.destination;
            console.log(`[POST /reservations] Usando información de ruta directa: origen="${origen}", destino="${destino}"`);
          }
          
          if ((tripWithRouteInfo && tripWithRouteInfo.route) || (tripWithRouteInfo.isSubTrip && origen && destino)) {
            // Obtener el companyId del viaje
            const tripCompanyId = tripWithRouteInfo.companyId || trip.companyId;
            
            // Crear los detalles de la transacción en formato JSON
            const detallesTransaccion = {
              type: "reservation",
              details: {
                id: reservation.id,
                tripId: (reservation.tripDetails as any)?.tripId || 'unknown', // Extraer tripId de tripDetails
                isSubTrip: tripWithRouteInfo.isSubTrip || false, // Indicar si es sub-viaje
                pasajeros: passengers.map(p => `${p.firstName} ${p.lastName}`).join(", "),
                contacto: {
                  email: reservation.email,
                  telefono: reservation.phone
                },
                origen: origen,
                destino: destino,
                monto: reservationData.advanceAmount,
                metodoPago: reservationData.advancePaymentMethod || "efectivo",
                notas: reservation.notes,
                companyId: tripCompanyId, // Añadimos el ID de la compañía del viaje
                dateCreated: new Date().toISOString() // Fecha exacta de creación
              }
            };
            
            console.log(`[POST /reservations] DEPURACIÓN - Detalles de la transacción a crear:`, JSON.stringify(detallesTransaccion, null, 2));
            
            // Crear la transacción en la base de datos
            const transaccionData = {
              details: detallesTransaccion, // Campo correcto que coincide con la BD
              user_id: createdByUserId || (user ? user.id : null), // Campo correcto que coincide con la BD
              cutoff_id: null, // Campo correcto que coincide con la BD
              companyId: tripCompanyId // Añadimos el ID de la compañía a la transacción
            };
            
            console.log(`[POST /reservations] DEPURACIÓN - Datos para crear transacción:`, JSON.stringify(transaccionData, null, 2));
            
            const transaccion = await storage.createTransaccion(transaccionData);
            
            console.log(`[POST /reservations] Transacción creada exitosamente con ID: ${transaccion.id}`);
            console.log(`[POST /reservations] DEPURACIÓN - Transacción creada:`, JSON.stringify(transaccion, null, 2));
          } else {
            console.log(`[POST /reservations] No se pudo obtener información completa del viaje para crear la transacción`);
          }
        } catch (error) {
          console.error(`[POST /reservations] Error al crear transacción:`, error);
          console.error(`[POST /reservations] DEPURACIÓN - Stack de error:`, error instanceof Error ? error.stack : 'No stack disponible');
          // Continuamos aunque falle la creación de la transacción para no afectar la creación de la reserva
        }
      } else {
        console.log(`[POST /reservations] DEPURACIÓN - No se creó transacción porque no hay anticipo o es 0: ${reservationData.advanceAmount}`);
      }
      
      res.status(201).json({
        ...reservation,
        passengers
      });
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      res.status(500).json({ error: "Failed to create reservation", details: error.message || "Unknown error" });
    }
  });

  app.put(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const validationResult = insertReservationSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid reservation data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      const reservationData = validationResult.data;
      
      // Si está marcando como pagado, incluir el ID del usuario actual y la fecha
      if (reservationData.paymentStatus === "pagado") {
        console.log(`[PUT /reservations/${id}] Marcando como pagado por usuario ${user?.id || 'no autenticado'}`);
        
        // Extender los datos de reservación con el ID del usuario que marca como pagado
        // y la fecha actual para el registro de cuándo se realizó el pago
        reservationData.paidBy = user?.id || null;
        reservationData.markedAsPaidAt = new Date();
        
        // Obtener la reservación completa para calcular el monto restante
        const originalReservation = await storage.getReservationWithDetails(id);
        if (originalReservation) {
          try {
            // Calcular el monto restante (total - anticipo)
            const remainingAmount = originalReservation.totalAmount - (originalReservation.advanceAmount || 0);
            
            if (remainingAmount > 0) {
              console.log(`[PUT /reservations/${id}] Creando transacción para pago restante de $${remainingAmount}`);
              
              // Extraer información del viaje desde tripDetails
              const { recordId, tripId } = originalReservation.tripDetails as { recordId: number, tripId: string };
              
              if (!recordId) {
                console.log(`[PUT /reservations/${id}] No se encontró recordId en tripDetails`);
                // Continuamos con la actualización aunque no se pueda crear la transacción
              } else {
                // Obtener información del viaje usando recordId
                const trip = await storage.getTrip(recordId);
                if (!trip) {
                  console.log(`[PUT /reservations/${id}] No se encontró el viaje ${recordId}`);
                  // Continuamos con la actualización aunque no se pueda crear la transacción
                } else {
                const tripWithRouteInfo = await storage.getTripWithRouteInfo(recordId);
                console.log(`[PUT /reservations/${id}] DEPURACIÓN - Información del viaje obtenida:`, JSON.stringify(tripWithRouteInfo, null, 2));
                
                // Extraer origen y destino del segmento específico usando tripId
                let origen = "";
                let destino = "";
                
                // Parsear tripData para obtener información del segmento específico
                if (tripWithRouteInfo && tripWithRouteInfo.tripData) {
                  try {
                    const tripDataArray = Array.isArray(tripWithRouteInfo.tripData) 
                      ? tripWithRouteInfo.tripData 
                      : JSON.parse(tripWithRouteInfo.tripData as string);
                    
                    console.log(`[PUT /reservations/${id}] DEPURACIÓN - tripData parseado:`, JSON.stringify(tripDataArray, null, 2));
                    
                    // Buscar el segmento específico usando el índice del tripId sintético
                    const tripIndex = parseInt(tripId.split("_")[1], 10);
                    const targetSegment = tripDataArray[tripIndex];
                    
                    if (targetSegment) {
                      console.log(`[PUT /reservations/${id}] DEPURACIÓN - Segmento encontrado:`, JSON.stringify(targetSegment, null, 2));
                      origen = targetSegment.origin || "";
                      destino = targetSegment.destination || "";
                      console.log(`[PUT /reservations/${id}] Usando origen="${origen}" y destino="${destino}" del segmento ${tripId}`);
                    } else {
                      console.log(`[PUT /reservations/${id}] ADVERTENCIA - No se encontró el segmento ${tripId} en tripData`);
                      // Fallback a la información de la ruta
                      if (tripWithRouteInfo.route) {
                        origen = tripWithRouteInfo.route.origin;
                        destino = tripWithRouteInfo.route.destination;
                        console.log(`[PUT /reservations/${id}] Usando fallback de ruta: origen="${origen}", destino="${destino}"`);
                      }
                    }
                  } catch (parseError) {
                    console.error(`[PUT /reservations/${id}] Error al parsear tripData:`, parseError);
                    // Fallback a la información de la ruta
                    if (tripWithRouteInfo.route) {
                      origen = tripWithRouteInfo.route.origin;
                      destino = tripWithRouteInfo.route.destination;
                      console.log(`[PUT /reservations/${id}] Usando fallback de ruta por error de parseo: origen="${origen}", destino="${destino}"`);
                    }
                  }
                } else if (tripWithRouteInfo && tripWithRouteInfo.route) {
                  // Fallback directo a información de ruta si no hay tripData
                  origen = tripWithRouteInfo.route.origin;
                  destino = tripWithRouteInfo.route.destination;
                  console.log(`[PUT /reservations/${id}] Usando información de ruta directa: origen="${origen}", destino="${destino}"`);
                }
                
                // Obtener los pasajeros de la reservación
                const passengers = await storage.getPassengers(id);
                
                if ((tripWithRouteInfo && tripWithRouteInfo.route) || (tripWithRouteInfo.isSubTrip && origen && destino)) {
                  // Obtener el companyId del viaje
                  const companyId = tripWithRouteInfo.companyId || trip.companyId;
                  
                  // Crear los detalles de la transacción en formato JSON
                  const detallesTransaccion = {
                    type: "reservation",
                    details: {
                      id: originalReservation.id,
                      tripId: tripId, // Usar el tripId extraído de tripDetails
                      isSubTrip: tripWithRouteInfo.isSubTrip || false,
                      pasajeros: passengers.map(p => `${p.firstName} ${p.lastName}`).join(", "),
                      contacto: {
                        email: originalReservation.email,
                        telefono: originalReservation.phone
                      },
                      origen: origen,
                      destino: destino,
                      monto: remainingAmount,
                      metodoPago: originalReservation.paymentMethod || "efectivo",
                      notas: `Pago final - Reservación #${originalReservation.id}`,
                      companyId: companyId // Añadimos el ID de la compañía del viaje
                    }
                  };
                  
                  console.log(`[PUT /reservations/${id}] DEPURACIÓN - Detalles de la transacción a crear:`, JSON.stringify(detallesTransaccion, null, 2));
                  
                  // Crear la transacción en la base de datos
                  const transaccionData = {
                    details: detallesTransaccion, // Campo correcto que coincide con la BD
                    user_id: user?.id || null, // Campo correcto que coincide con la BD
                    cutoff_id: null, // Campo correcto que coincide con la BD
                    companyId: companyId // Añadimos el ID de la compañía a la transacción
                  };
                  
                  const transaccion = await storage.createTransaccion(transaccionData);
                  console.log(`[PUT /reservations/${id}] Transacción de pago final creada exitosamente con ID: ${transaccion.id}`);
                  }
                }
              }
            } else {
              console.log(`[PUT /reservations/${id}] No se creó transacción porque no hay monto restante por pagar`);
            }
          } catch (error) {
            console.error(`[PUT /reservations/${id}] Error al crear transacción de pago final:`, error);
            console.error(`[PUT /reservations/${id}] DEPURACIÓN - Stack de error:`, error instanceof Error ? error.stack : 'No stack disponible');
            // Continuamos con la actualización aunque falle la creación de la transacción
          }
        }
      }
      
      const updatedReservation = await storage.updateReservation(id, reservationData);
      
      if (!updatedReservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      res.json(updatedReservation);
    } catch (error) {
      console.error("[PUT /reservations/:id] Error:", error);
      res.status(500).json({ error: "Failed to update reservation" });
    }
  });

  // Endpoint para cancelar reservación (sin eliminarla)
  app.post(apiRouter("/reservations/:id/cancel"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener los datos de la reservación
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Verificar si la reservación ya está cancelada
      if (reservation.status === "canceled") {
        return res.status(400).json({ error: "Esta reservación ya ha sido cancelada" });
      }
      
      // Extraer información del viaje desde tripDetails
      const { recordId, tripId } = reservation.tripDetails as { recordId: number, tripId: string };
      
      if (!recordId || !tripId) {
        return res.status(400).json({ error: "Invalid trip details in reservation" });
      }
      
      // Obtener el viaje asociado
      const trip = await storage.getTrip(recordId);
      
      if (!trip) {
        console.error(`Error al cancelar reservación: No se encontró el viaje ${recordId}`);
        return res.status(500).json({ error: "Failed to find associated trip" });
      }
      
      // Obtener los pasajeros para contar cuántos asientos liberar
      const passengers = await storage.getPassengers(id);
      const passengerCount = passengers.length;
      
      console.log(`[POST /reservations/${id}/cancel] Liberando ${passengerCount} asientos del viaje recordId: ${recordId}, tripId: ${tripId}`);
      
      // Actualizar el status de la reservación a cancelada
      const updatedReservation = await storage.updateReservation(id, {
        status: "canceled"
      });
      
      if (!updatedReservation) {
        return res.status(404).json({ error: "Failed to update reservation status" });
      }
      
      // Liberar asientos: actualizar viajes relacionados si hay pasajeros
      if (passengerCount > 0) {
        try {
          // Usar la función existente para actualizar asientos en viajes relacionados
          await storage.updateRelatedTripsAvailability(recordId, tripId, passengerCount);
          console.log(`[POST /reservations/${id}/cancel] Asientos liberados exitosamente para recordId: ${recordId}, tripId: ${tripId}`);
        } catch (e) {
          console.error("Error al liberar asientos en viajes relacionados:", e);
          // No fallar la operación principal si esto falla
        }
      }
      
      // Enviar respuesta
      res.json({ 
        success: true, 
        message: "Reservación cancelada exitosamente",
        reservation: updatedReservation
      });
    } catch (error) {
      console.error("Error al cancelar reservación:", error);
      res.status(500).json({ error: "Failed to cancel reservation" });
    }
  });

  // Endpoint para eliminar reservaciones completamente
  app.delete(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Primero obtenemos los datos de la reservación básica
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Obtener el viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      
      if (!trip) {
        console.error(`Error al eliminar reservación: No se encontró el viaje ${reservation.tripId}`);
        return res.status(500).json({ error: "Failed to find associated trip" });
      }
      
      // Obtener los pasajeros para contar cuántos son
      const passengers = await storage.getPassengers(id);
      const passengerCount = passengers.length;
      console.log(`Liberando ${passengerCount} asientos del viaje ${trip.id}`);
      
      // Eliminar la reservación
      const success = await storage.deleteReservation(id);
      
      if (!success) {
        return res.status(404).json({ error: "Failed to delete reservation" });
      }
      
      // Actualizar asientos disponibles en el viaje y en viajes relacionados
      if (passengerCount > 0) {
        // Obtener información detallada del viaje para conocer su capacidad original
        const tripDetails = await storage.getTripWithRouteInfo(trip.id);
        const capacityLimit = tripDetails?.capacity || trip.capacity;
        
        console.log(`[DELETE /reservations/${id}] Capacidad máxima del viaje: ${capacityLimit}, asientos actuales: ${trip.availableSeats}, asientos a liberar: ${passengerCount}`);
        
        try {
          // Actualizar todos los viajes afectados usando la nueva función con tripDetails
          const { recordId, tripId } = reservation.tripDetails as { recordId: number, tripId: string };
          await storage.updateRelatedTripsAvailability(recordId, tripId, passengerCount);
          
          console.log(`Asientos actualizados para el registro ${recordId}, segmento ${tripId} y viajes relacionados.`);
        } catch (e) {
          console.error("Error al actualizar viajes relacionados:", e);
          // No fallamos si esto falla, podemos seguir con la operación principal
        }
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar reservación:", error);
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  // Endpoint para cancelar reservación con reembolso
  app.post(apiRouter("/reservations/:id/cancel-refund"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { user } = req as any;

      console.log(`[POST /reservations/${id}/cancel-refund] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);

      // 1. Verificar que la reservación existe y pertenece al usuario/empresa
      const reservation = await storage.getReservationWithDetails(id, user.companyId);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservación no encontrada" });
      }

      // Verificar permisos de empresa
      if (user.role !== 'superAdmin' && reservation.companyId !== user.companyId) {
        return res.status(403).json({ error: "No tienes permisos para cancelar esta reservación" });
      }

      // 2. Verificar que la reservación no esté ya cancelada
      if (reservation.status === 'canceled') {
        return res.status(400).json({ error: "La reservación ya está cancelada" });
      }

      // 3. Buscar TODAS las transacciones asociadas a esta reservación
      const associatedTransactions = await storage.getTransaccionesByReservation(id);
      console.log(`[POST /reservations/${id}/cancel-refund] Encontradas ${associatedTransactions.length} transacciones para reservación ${id}`);

      if (associatedTransactions.length === 0) {
        return res.status(400).json({ 
          error: "No se encontraron transacciones asociadas a esta reservación" 
        });
      }

      // Filtrar solo transacciones sin corte (las que pueden ser reembolsadas)
      const refundableTransactions = associatedTransactions.filter(t => t.cutoff_id === null);
      console.log(`[POST /reservations/${id}/cancel-refund] ${refundableTransactions.length} transacciones pueden ser reembolsadas`);

      if (refundableTransactions.length === 0) {
        return res.status(400).json({ 
          error: "No se encontraron transacciones sin corte que puedan ser reembolsadas" 
        });
      }

      // Cancelar reservación (igual que cancelación normal)
      const updatedReservation = await storage.updateReservation(id, {
        status: 'canceledAndRefund',
        updatedAt: new Date()
      });

      if (!updatedReservation) {
        return res.status(500).json({ error: "Error al cancelar la reservación" });
      }

      // Liberar asientos
      const passengers = await storage.getPassengers(id);
      const passengerCount = passengers.length;

      if (passengerCount > 0) {
        try {
          const tripDetails = reservation.tripDetails as any;
          const { recordId, tripId } = tripDetails;
          
          await storage.updateRelatedTripsAvailability(recordId, tripId, passengerCount);
          console.log(`[POST /reservations/${id}/cancel-refund] Asientos liberados: ${passengerCount}`);
        } catch (e) {
          console.error("Error al liberar asientos:", e);
        }
      }

      // Eliminar TODAS las transacciones reembolsables
      let totalRefundAmount = 0;
      let deletedCount = 0;

      for (const transaction of refundableTransactions) {
        try {
          const transactionDeleted = await storage.deleteTransaccion(transaction.id);
          
          if (transactionDeleted) {
            deletedCount++;
            // Calcular monto total del reembolso
            const transactionAmount = (transaction.details as any)?.details?.monto || 0;
            totalRefundAmount += transactionAmount;
            console.log(`[POST /reservations/${id}/cancel-refund] Transacción ${transaction.id} eliminada exitosamente (${transactionAmount})`);
          } else {
            console.error(`[POST /reservations/${id}/cancel-refund] Error al eliminar transacción ${transaction.id}`);
          }
        } catch (error) {
          console.error(`[POST /reservations/${id}/cancel-refund] Error al procesar transacción ${transaction.id}:`, error);
        }
      }

      if (deletedCount === 0) {
        return res.status(500).json({ error: "Error al procesar el reembolso - no se pudo eliminar ninguna transacción" });
      }

      console.log(`[POST /reservations/${id}/cancel-refund] ${deletedCount}/${refundableTransactions.length} transacciones eliminadas exitosamente. Reembolso total: ${totalRefundAmount}`);

      res.json({ 
        success: true, 
        message: "Reservación cancelada con reembolso exitosamente",
        reservation: updatedReservation,
        refundAmount: totalRefundAmount,
        deletedTransactions: deletedCount
      });

    } catch (error) {
      console.error("Error al cancelar reservación con reembolso:", error);
      res.status(500).json({ error: "Error interno al procesar la cancelación con reembolso" });
    }
  });

  // Rutas de API para vehículos (unidades)
  app.get(apiRouter("/vehicles"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /vehicles] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /vehicles] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Filtrado de datos por compañía
      let companyId: string | null = null;
      
      // REGLAS DE ACCESO:
      // 1. Solo superAdmin puede ver TODOS los vehículos
      // 2. El resto de roles (incluyendo admin) solo pueden ver vehículos de SU COMPAÑÍA
      if (user) {
        // Los roles que NO son superAdmin tienen acceso restringido
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /vehicles] ADVERTENCIA: Usuario sin compañía asignada`);
            // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
            return res.json([]);
          }
          
          console.log(`[GET /vehicles] FILTRO CRÍTICO: Aplicando filtro por compañía "${companyId}"`);
        } else {
          console.log(`[GET /vehicles] Usuario con rol ${user.role} puede ver TODOS los vehículos`);
        }
      } else {
        console.log(`[GET /vehicles] Usuario no autenticado`);
        // Usuarios no autenticados no deberían poder ver vehículos
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Ejecutar la consulta con el filtro de compañía si aplica
      const vehicles = await storage.getVehicles(companyId || undefined);
      console.log(`[GET /vehicles] Encontrados ${vehicles.length} vehículos`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      if (user && user.role !== UserRole.SUPER_ADMIN) {
        // Obtener la compañía del usuario
        const userCompany = user.companyId || user.company || null;
        
        if (userCompany) {
          // Verificar que todos los vehículos sean realmente de la compañía del usuario
          const vehiculosDeOtrasCompanias = vehicles.filter(v => 
            v.companyId && v.companyId !== userCompany
          );
          
          if (vehiculosDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${vehiculosDeOtrasCompanias.length} vehículos de otras compañías!`);
            
            // CRÍTICO: Filtrar y devolver SOLO los vehículos de la compañía del usuario
            const vehiculosFiltrados = vehicles.filter(v => v.companyId === userCompany);
            console.log(`[CORRECCIÓN] Devolviendo solo ${vehiculosFiltrados.length} vehículos de compañía ${userCompany}`);
            
            // Reemplazar los resultados
            return res.json(vehiculosFiltrados);
          }
        }
      }
      
      res.json(vehicles);
    } catch (error) {
      console.error("[GET /vehicles] Error:", error);
      res.status(500).json({ error: "Error al obtener vehículos" });
    }
  });

  app.get(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Control de acceso a datos por compañía
      let companyId: string | null = null;
      
      // REGLAS DE ACCESO:
      // 1. Solo superAdmin puede ver TODOS los vehículos
      // 2. El resto de roles (incluyendo admin) solo pueden ver vehículos de SU COMPAÑÍA
      if (user) {
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
            return res.status(403).json({ 
              error: "Acceso denegado", 
              details: "Usuario sin compañía asignada" 
            });
          }
          
          console.log(`[GET /vehicles/${id}] Verificando permisos para compañía: ${companyId}`);
        } else {
          console.log(`[GET /vehicles/${id}] Usuario con rol ${user.role} puede ver cualquier vehículo`);
        }
      } else {
        console.log(`[GET /vehicles/${id}] Acceso no autenticado denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener vehículo
      const vehicle = await storage.getVehicle(id);
      
      if (!vehicle) {
        console.log(`[GET /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // VERIFICACIÓN DE SEGURIDAD: Comprobar que el usuario tiene acceso a este vehículo
      // Los administradores también deben tener restricciones por compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Si el vehículo tiene companyId y no coincide con la del usuario
        if (vehicle.companyId && vehicle.companyId !== companyId) {
          console.log(`[GET /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${vehicle.companyId} pero el usuario es de ${companyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para acceder a este vehículo" 
          });
        }
      }
      
      console.log(`[GET /vehicles/${id}] Acceso concedido`);
      res.json(vehicle);
    } catch (error) {
      console.error(`[GET /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener el vehículo" });
    }
  });

  app.post(apiRouter("/vehicles"), async (req: Request, res: Response) => {
    try {
      // Validación básica
      if (!req.body.plates || !req.body.brand || !req.body.model || !req.body.economicNumber) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "plates, brand, model, and economicNumber are required" 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[POST /vehicles] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[POST /vehicles] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[POST /vehicles] Intento de creación sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener companyId del usuario
      let companyId = user.companyId || user.company;
      
      // SEGURIDAD: Verificar asignación de compañía
      if (!companyId && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        console.log(`[POST /vehicles] ADVERTENCIA: Usuario sin compañía asignada intentando crear vehículo`);
        return res.status(400).json({ 
          error: "Datos incompletos", 
          details: "No se puede crear un vehículo sin asignar una compañía" 
        });
      }
      
      // SEGURIDAD: Preservar companyId si el usuario es superAdmin o admin
      if (!companyId && (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN)) {
        console.log(`[POST /vehicles] Usuario ${user.role} creando vehículo sin asignar compañía específica`);
        companyId = req.body.companyId || null;
      }
      
      console.log(`[POST /vehicles] Asignando vehículo a compañía: ${companyId || 'ninguna'}`);
      
      // Crear objeto con datos del vehículo más el companyId
      const vehicleData = {
        ...req.body,
        companyId: companyId
      };
      
      const vehicle = await storage.createVehicle(vehicleData);
      console.log(`[POST /vehicles] Vehículo creado con ID ${vehicle.id}`);
      
      res.status(201).json(vehicle);
    } catch (error) {
      console.error(`[POST /vehicles] Error: ${error}`);
      
      // Comprobar si es un error de placas duplicadas
      if (error.toString().includes("vehicles_plates_unique")) {
        return res.status(400).json({ 
          error: "Error al crear el vehículo", 
          details: "Ya existe un vehículo con esas placas. Las placas deben ser únicas."
        });
      }
      
      // Comprobar si es un error de número económico duplicado
      if (error.toString().includes("vehicles_economicnumber_unique")) {
        return res.status(400).json({ 
          error: "Error al crear el vehículo", 
          details: "Ya existe un vehículo con ese número económico. El número económico debe ser único."
        });
      }
      
      res.status(500).json({ error: "Error al crear el vehículo" });
    }
  });

  app.put(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[PUT /vehicles/${id}] Intento de actualización sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // SEGURIDAD: Verificar existencia del vehículo y permisos
      const existingVehicle = await storage.getVehicle(id);
      
      if (!existingVehicle) {
        console.log(`[PUT /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // Verificar permisos (solo los superAdmin y admin pueden editar cualquier vehículo)
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        // Si no tiene compañía asignada, no puede editar
        if (!userCompanyId) {
          console.log(`[PUT /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para editar este vehículo" 
          });
        }
        
        // Si el vehículo pertenece a otra compañía, no puede editarlo
        if (existingVehicle.companyId && existingVehicle.companyId !== userCompanyId) {
          console.log(`[PUT /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${existingVehicle.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para editar vehículos de otra compañía" 
          });
        }
      }
      
      // SEGURIDAD: Preservar el companyId original a menos que sea superAdmin/admin
      let vehicleData = { ...req.body };
      
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        // Usuarios normales no pueden cambiar la compañía del vehículo
        vehicleData.companyId = existingVehicle.companyId;
        console.log(`[PUT /vehicles/${id}] Preservando companyId original: ${existingVehicle.companyId || 'ninguna'}`);
      } else if (vehicleData.companyId !== existingVehicle.companyId) {
        // Permitir a superAdmin/admin cambiar la compañía
        console.log(`[PUT /vehicles/${id}] Usuario ${user.role} cambiando companyId de ${existingVehicle.companyId || 'ninguna'} a ${vehicleData.companyId || 'ninguna'}`);
      }
      
      const updatedVehicle = await storage.updateVehicle(id, vehicleData);
      
      console.log(`[PUT /vehicles/${id}] Vehículo actualizado correctamente`);
      res.json(updatedVehicle);
    } catch (error) {
      console.error(`[PUT /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el vehículo" });
    }
  });

  app.delete(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[DELETE /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[DELETE /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[DELETE /vehicles/${id}] Intento de eliminación sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // SEGURIDAD: Verificar existencia del vehículo y permisos
      const existingVehicle = await storage.getVehicle(id);
      
      if (!existingVehicle) {
        console.log(`[DELETE /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // Verificar permisos (solo los superAdmin, admin y owner pueden eliminar un vehículo)
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
        console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: El rol ${user.role} no tiene permisos para eliminar vehículos`);
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "No tiene permisos para eliminar vehículos" 
        });
      }
      
      // Si es owner, verificar que el vehículo pertenece a su compañía
      if (user.role === UserRole.OWNER) {
        const userCompanyId = user.companyId || user.company;
        
        if (!userCompanyId) {
          console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para eliminar este vehículo" 
          });
        }
        
        // Si el vehículo pertenece a otra compañía, no puede eliminarlo
        if (existingVehicle.companyId && existingVehicle.companyId !== userCompanyId) {
          console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${existingVehicle.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para eliminar vehículos de otra compañía" 
          });
        }
      }
      
      // Eliminar el vehículo
      const success = await storage.deleteVehicle(id);
      
      if (!success) {
        console.log(`[DELETE /vehicles/${id}] Error al eliminar el vehículo`);
        return res.status(500).json({ error: "Error al eliminar el vehículo" });
      }
      
      console.log(`[DELETE /vehicles/${id}] Vehículo eliminado correctamente`);
      res.status(204).end();
    } catch (error) {
      console.error(`[DELETE /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al eliminar el vehículo" });
    }
  });

  // Nuevo endpoint público para acceder a los detalles de una reservación (para escaneo de QR)
  app.get(apiRouter("/public/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      console.log(`[GET /public/reservations/${id}] Acceso público solicitado`);
      
      // Obtener la reservación sin filtrado por compañía (es acceso público)
      const reservation = await storage.getReservationWithDetails(id, undefined);
      
      if (!reservation) {
        console.log(`[GET /public/reservations/${id}] Reservación no encontrada`);
        return res.status(404).json({ error: "Reservación no encontrada" });
      }
      
      console.log(`[GET /public/reservations/${id}] Acceso público concedido`);
      res.json(reservation);
    } catch (error) {
      console.error(`[GET /public/reservations/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener la reservación" });
    }
  });
  


  const httpServer = createServer(app);
  
  // Configuración del servidor WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Mantener un registro de conexiones activas
  const clients = new Map<string, WebSocket>();
  
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] Nueva conexión establecida');
    
    // Manejar mensajes entrantes
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.userId) {
          clients.set(data.userId, ws);
          console.log(`[WebSocket] Cliente autenticado: ${data.userId}`);
          
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Autenticación exitosa'
          }));
        }
      } catch (error) {
        console.error('[WebSocket] Error al procesar mensaje:', error);
      }
    });
    
    // Manejar desconexión
    ws.on('close', () => {
      // Buscar y eliminar la conexión del registro
      for (const [userId, connection] of clients.entries()) {
        if (connection === ws) {
          clients.delete(userId);
          console.log(`[WebSocket] Cliente desconectado: ${userId}`);
          break;
        }
      }
    });
  });

  return httpServer;
}
