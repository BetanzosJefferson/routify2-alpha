import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { eq, inArray, isNull, isNotNull, desc, gte, lte, or, like, and } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { WebSocketServer, WebSocket } from 'ws';
import { serverTripCache } from "./lib/trip-cache";
import { 
  insertRouteSchema, 
  insertTripSchema, 
  insertReservationSchema, 
  insertPassengerSchema,
  insertPackageSchema,
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
import { getCurrentLocalDate, formatDateToLocal, normalizeToStartOfDay } from "./utils";
// Constantes para roles y permisos de paqueterías
const PACKAGE_ACCESS_ROLES = [
  UserRole.OWNER, 
  UserRole.ADMIN, 
  UserRole.CALL_CENTER, 
  UserRole.CHECKER, 
  UserRole.DRIVER,
  UserRole.TICKET_OFFICE,
  'superAdmin'
];

const PACKAGE_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.CALL_CENTER,
  UserRole.TICKET_OFFICE,
  UserRole.DRIVER // Añadido para permitir a conductores marcar paquetes como pagados/entregados
];

const PACKAGE_CREATE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.CALL_CENTER,
  UserRole.CHECKER,
  UserRole.TICKET_OFFICE
];

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

  // ROUTE TEMPLATES ENDPOINTS
  app.get(apiRouter("/route-templates"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        companyId = user.companyId || user.company;
      }
      
      const templates = await storage.getRouteTemplates(companyId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching route templates:", error);
      res.status(500).json({ error: "Failed to fetch route templates" });
    }
  });

  app.get(apiRouter("/route-templates/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const templateWithRoute = await storage.getRouteTemplateWithRoute(id);
      
      if (!templateWithRoute) {
        return res.status(404).json({ error: "Route template not found" });
      }
      
      res.json(templateWithRoute);
    } catch (error) {
      console.error("Error fetching route template:", error);
      res.status(500).json({ error: "Failed to fetch route template" });
    }
  });

  app.post(apiRouter("/route-templates"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const companyId = user.companyId || user.company;
      
      const templateData = {
        ...req.body,
        companyId: companyId
      };
      
      const template = await storage.createRouteTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating route template:", error);
      res.status(500).json({ error: "Failed to create route template" });
    }
  });

  app.put(apiRouter("/route-templates/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { user } = req as any;
      
      // Verificar que la plantilla existe y pertenece a la compañía del usuario
      const existingTemplate = await storage.getRouteTemplate(id);
      if (!existingTemplate) {
        return res.status(404).json({ error: "Route template not found" });
      }
      
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        if (existingTemplate.companyId && existingTemplate.companyId !== userCompany) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const updatedTemplate = await storage.updateRouteTemplate(id, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating route template:", error);
      res.status(500).json({ error: "Failed to update route template" });
    }
  });

  app.delete(apiRouter("/route-templates/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { user } = req as any;
      
      // Verificar que la plantilla existe y pertenece a la compañía del usuario
      const existingTemplate = await storage.getRouteTemplate(id);
      if (!existingTemplate) {
        return res.status(404).json({ error: "Route template not found" });
      }
      
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        if (existingTemplate.companyId && existingTemplate.companyId !== userCompany) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const success = await storage.deleteRouteTemplate(id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete route template" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting route template:", error);
      res.status(500).json({ error: "Failed to delete route template" });
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
      
      // OPTIMIZACIÓN: Si no hay filtro de fecha específico, usar fecha actual por defecto
      if (!date && !origin && !destination) {
        // Usar función global para obtener fecha actual sin problemas de zona horaria
        const today = getCurrentLocalDate();
        searchParams.date = today;
        console.log(`[GET /api/admin-trips] Sin filtros específicos - aplicando fecha actual: ${today}`);
      }
      
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

  // Ruta optimizada para buscar viajes (TESTING)
  app.get(apiRouter("/trips-optimized"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Log para depuración
      console.log(`[GET /trips-optimized] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips-optimized] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Parámetros de búsqueda desde la query
      const { origin, destination, date, dateRange, seats, driverId, visibility } = req.query;
      const searchParams: any = {};
      
      // Agregar parámetros de búsqueda si existen
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      
      // Manejar fecha o rango de fechas
      if (dateRange) {
        // Si se especifica un rango de fechas (ayer,hoy,mañana), usar ese rango
        searchParams.dateRange = (dateRange as string).split(',');
        console.log(`[GET /trips-optimized] Usando rango de fechas optimizado:`, searchParams.dateRange);
      } else if (date) {
        // Si se especifica una fecha específica
        searchParams.date = date as string;
        console.log(`[GET /trips-optimized] Usando fecha específica:`, searchParams.date);
      }
      
      // Otros parámetros
      if (seats) searchParams.seats = parseInt(seats as string);
      if (driverId) searchParams.driverId = parseInt(driverId as string);
      if (visibility) searchParams.visibility = visibility as string;
      
      // Configurar visibilidad basada en el rol del usuario
      if (user && ['admin', 'superAdmin', 'dueño'].includes(user.role)) {
        // Admins pueden ver todos los viajes
        searchParams.includeAllVisibilities = true;
      } else {
        // Usuarios normales solo ven viajes publicados
        searchParams.visibility = 'published';
      }
      
      // Configurar filtros por compañía
      if (user) {
        if (user.role === 'superAdmin') {
          // Super admin puede ver todos los viajes
          console.log(`[GET /trips-optimized] Super admin - mostrando todos los viajes`);
        } else if (user.role === 'taquilla') {
          // Taquilla puede ver viajes de múltiples compañías
          const userCompanies = await storage.getUserCompanies(user.id);
          if (userCompanies.length > 0) {
            searchParams.companyIds = userCompanies.map(uc => uc.companyId);
            console.log(`[GET /trips-optimized] Taquilla - mostrando viajes de compañías:`, searchParams.companyIds);
          }
        } else if (user.companyId || user.company) {
          // Otros roles ven solo su compañía
          searchParams.companyId = user.companyId || user.company;
          console.log(`[GET /trips-optimized] Usuario normal - mostrando viajes de compañía:`, searchParams.companyId);
        }
      }
      
      // Usar el método optimizado
      const startTime = Date.now();
      const trips = await storage.searchTripsOptimized(searchParams);
      const queryTime = Date.now() - startTime;
      
      console.log(`[GET /trips-optimized] Encontrados ${trips.length} viajes en ${queryTime}ms`);
      res.json(trips);
    } catch (error: any) {
      console.error("Error al obtener viajes optimizados:", error.message);
      res.status(500).json({ error: "Error al obtener viajes" });
    }
  });

  // Ruta optimizada para obtener reservaciones (TESTING STEP 3)
  app.get(apiRouter("/reservations-optimized"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[GET /reservations-optimized] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const startTime = Date.now();
      let companyId = null;
      
      // Aplicar filtros de compañía según el rol del usuario
      if (user.role === 'superAdmin') {
        // Super admin puede ver todas las reservaciones
        console.log(`[GET /reservations-optimized] Super admin - acceso a todas las reservaciones`);
      } else if (user.role === 'taquilla' && user.company) {
        // Taquilla puede manejar múltiples compañías
        const companyIds = Array.isArray(user.company) ? user.company : [user.company];
        console.log(`[GET /reservations-optimized] Taquilla - acceso a compañías:`, companyIds);
        // Para el método optimizado, usaremos la primera compañía
        companyId = companyIds[0];
      } else if (user.companyId || user.company) {
        // Usuarios normales solo ven su compañía
        companyId = user.companyId || user.company;
        console.log(`[GET /reservations-optimized] Usuario normal - acceso a compañía:`, companyId);
      }
      
      console.log(`[GET /reservations-optimized] Llamando getReservationsOptimized con companyId: ${companyId}`);
      const reservations = await storage.getReservationsOptimized(companyId, user.id, user.role);
      
      const queryTime = Date.now() - startTime;
      console.log(`[GET /reservations-optimized] Obtenidas ${reservations.length} reservaciones en ${queryTime}ms`);
      
      res.json(reservations);
    } catch (error: any) {
      console.error("Error al obtener reservaciones optimizadas:", error.message);
      res.status(500).json({ error: "Error al obtener reservaciones" });
    }
  });

  // Ruta estándar para buscar viajes (solo muestra los publicados por defecto)
  app.get(apiRouter("/trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Log para depuración
      console.log(`[GET /trips] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Parámetros de búsqueda desde la query
      const { origin, destination, date, dateRange, seats, driverId, visibility, isSubTrip } = req.query;
      
      // Crear clave de caché incluyendo compañía del usuario para aislamiento
      const userCompanyId = user?.companyId || user?.company;
      const cacheKey = {
        origin: origin as string,
        destination: destination as string,
        date: date as string,
        dateRange: dateRange as string,
        seats: seats as string,
        driverId: driverId as string,
        visibility: visibility as string,
        isSubTrip: isSubTrip as string,
        companyId: userCompanyId
      };
      
      // CRÍTICO: Asegurar que la fecha SIEMPRE esté presente en la clave del cache
      if (!cacheKey.date && !cacheKey.dateRange) {
        // Si no hay fecha específica, usar fecha actual
        const today = getCurrentLocalDate();
        cacheKey.date = today;
        console.log(`[GET /trips] Fecha no especificada, usando fecha actual: ${today}`);
      }
      
      // OPTIMIZACIÓN: Si no hay filtros específicos, aplicar fecha actual por defecto
      if (!origin && !destination && !date && !dateRange && !isSubTrip) {
        const today = getCurrentLocalDate();
        cacheKey.date = today;
        console.log(`[GET /trips] Sin filtros específicos - aplicando fecha actual: ${today}`);
      }
      
      // Verificar caché del servidor primero (solo para consultas pequeñas)
      const shouldUseCache = origin || destination || date || dateRange || isSubTrip;
      if (shouldUseCache) {
        const cachedData = serverTripCache.get(cacheKey);
        if (cachedData) {
          console.log(`[GET /trips] Cache HIT - devolviendo ${cachedData.length} viajes desde caché`);
          return res.json(cachedData);
        }
      }
      
      const searchParams: any = {};
      
      // Agregar parámetros de búsqueda si existen
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      
      // Manejar fecha o rango de fechas
      if (dateRange) {
        // Si se especifica un rango de fechas (ayer,hoy,mañana), usar ese rango
        searchParams.dateRange = (dateRange as string).split(',');
        console.log(`[GET /trips] Usando rango de fechas optimizado:`, searchParams.dateRange);
      } else if (date) {
        // Si solo se especifica una fecha, usar esa fecha
        searchParams.date = date as string;
      } else if (cacheKey.date) {
        // Usar fecha actual por defecto si no hay filtros específicos
        searchParams.date = cacheKey.date;
      }
      
      // Agregar filtro de visibilidad si se especifica
      if (visibility) {
        searchParams.visibility = visibility as string;
      }
      
      // Agregar filtro para viajes principales/secundarios
      if (isSubTrip) {
        searchParams.isSubTrip = isSubTrip as string;
        console.log(`[GET /trips] Filtro isSubTrip: ${searchParams.isSubTrip}`);
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
      // Solo superAdmin y taquilla pueden ver viajes de todas las compañías
      if (user) {
        // CASO ESPECIAL PARA CONDUCTORES: Filtrar por su ID de usuario cuando son role=DRIVER
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          // Para conductores, filtrar siempre por su ID (que debería coincidir con driverId en viajes)
          console.log(`[GET /trips] Usuario es CONDUCTOR (ID: ${user.id}), filtrando viajes asignados`);
          
          // Si no se envió un driverId explícitamente en la URL, usar el ID del usuario conductor
          if (!searchParams.driverId) {
            searchParams.driverId = user.id;
            console.log(`[GET /trips] Asignando driverId=${user.id} automáticamente para conductor`);
          }
          
          // Aplicar también el filtro de compañía normal
          const userCompanyId = user.companyId || user.company || null;
          if (userCompanyId) {
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía para conductor: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Conductor sin compañía asignada, aplicando solo filtro por driverId`);
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          // CASO ESPECIAL PARA TAQUILLEROS: Obtener las compañías asociadas
          console.log(`[GET /trips] Usuario es TAQUILLERO (ID: ${user.id}), obteniendo empresas asociadas`);
          
          // Obtener las asociaciones del usuario con empresas
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            console.log(`[GET /trips] Taquillero sin empresas asociadas, no verá ningún viaje`);
            return res.json([]);
          }
          
          // Obtener los IDs de las empresas asociadas
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          console.log(`[GET /trips] Taquillero con ${companyIds.length} empresas asociadas: ${companyIds.join(', ')}`);
          
          // Establecer un parámetro especial para manejar múltiples compañías
          searchParams.companyIds = companyIds;
          
        } else if (user.role !== UserRole.SUPER_ADMIN) {
          // Usuarios normales - SIEMPRE FILTRAR POR SU COMPAÑÍA
          // Obtener companyId del usuario (preferimos companyId pero también aceptamos company como respaldo)
          const userCompanyId = user.companyId || user.company || null;
          
          if (userCompanyId) {
            // Aplicar filtro por compañía - OBLIGATORIO para usuarios que no son superAdmin
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía aplicado: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Usuario sin compañía asignada, no verá ningún viaje`);
            // Si el usuario no tiene compañía asignada, devolver lista vacía
            return res.json([]);
          }
        } else {
          // Solo superAdmin tiene ACCESO TOTAL
          console.log(`[GET /trips] Usuario ${user.firstName} con rol ${user.role} - ACCESO TOTAL (sin filtrar compañía)`);
          
          // SOLUCIÓN ESPECIAL: Establecer un valor especial 'ALL' para indicar acceso total
          // Esto es mejor que eliminar el parámetro porque evita que la lógica predeterminada
          // de filtrado por compañía se active en capas inferiores
          searchParams.companyId = 'ALL'; 
          console.log(`[GET /trips] Estableciendo acceso total para rol privilegiado`);
        } 
      } else {
        // Usuario no autenticado - permitir acceso a viajes públicos
        console.log(`[GET /trips] Usuario no autenticado - mostrando solo viajes públicos`);
        searchParams.visibility = 'publicado';
        searchParams.companyId = 'ALL'; // Permitir ver de todas las compañías pero solo públicos
      }
      
      // Ejecutar búsqueda con todos los parámetros
      console.log(`[GET /trips] Parámetros de búsqueda finales:`, searchParams);
      const trips = await storage.searchTrips(searchParams);
      
      console.log(`[GET /trips] Encontrados ${trips.length} viajes`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      // Si el usuario no tiene permisos para ver todos los viajes,
      // realizamos una verificación adicional de seguridad y FILTRAMOS los resultados
      if (user && user.role !== UserRole.SUPER_ADMIN) {
        // Caso especial para conductores - verificar que solo vean sus viajes asignados
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          console.log(`[GET /trips] VERIFICACIÓN CONDUCTOR: Asegurando que el chofer solo vea sus viajes`);
          
          // Verificar que todos los viajes tengan el driverId correcto
          const viajesNoAsignados = trips.filter(t => t.driverId !== user.id);
          
          if (viajesNoAsignados.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesNoAsignados.length} viajes no asignados al conductor!`);
            console.log(`IDs bloqueados: ${viajesNoAsignados.map(t => t.id).join(', ')}`);
            
            // CRÍTICO: Filtrar y devolver SOLO los viajes asignados al conductor
            const viajesFiltradosConductor = trips.filter(t => t.driverId === user.id);
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltradosConductor.length} viajes asignados al conductor ${user.id}`);
            
            // Guardar en caché y devolver resultados filtrados para conductor
            serverTripCache.set(cacheKey, viajesFiltradosConductor);
            return res.json(viajesFiltradosConductor);
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          // VERIFICACIÓN ESPECIAL PARA TAQUILLEROS: asegurar que solo vean viajes de sus compañías asociadas
          console.log(`[GET /trips] VERIFICACIÓN TAQUILLERO: Asegurando que solo vea viajes de sus compañías asociadas`);
          
          // Obtener las compañías asociadas al taquillero
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            console.log(`[GET /trips] Taquillero sin empresas asociadas, no debería ver ningún viaje`);
            return res.json([]);
          }
          
          // Obtener los IDs de las compañías
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          console.log(`[GET /trips] Taquillero tiene acceso a las empresas: [${companyIds.join(', ')}]`);
          
          // Verificar que todos los viajes pertenezcan a las compañías asignadas
          const viajesDeOtrasCompanias = trips.filter(t => 
            t.companyId && !companyIds.includes(t.companyId)
          );
          
          if (viajesDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de compañías no asignadas al taquillero!`);
            console.log(`IDs bloqueados: ${viajesDeOtrasCompanias.map(t => t.id).join(', ')}`);
            
            // CRÍTICO: Filtrar y devolver SOLO los viajes de las compañías asignadas
            const viajesFiltrados = trips.filter(t => 
              t.companyId && companyIds.includes(t.companyId)
            );
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de las compañías asignadas`);
            
            // Guardar en caché y devolver resultados filtrados para taquillero
            serverTripCache.set(cacheKey, viajesFiltrados);
            return res.json(viajesFiltrados);
          }
        } else {
          // Verificación de compañía para usuarios normales
          const userCompany = user.companyId || user.company || null;
          
          if (userCompany) {
            // Filtrar para asegurarnos que solo devolvemos viajes de su compañía
            const viajesDeOtrasCompanias = trips.filter(t => t.companyId && t.companyId !== userCompany);
            
            if (viajesDeOtrasCompanias.length > 0) {
              console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de otras compañías!`);
              console.log(`IDs bloqueados: ${viajesDeOtrasCompanias.map(t => t.id).join(', ')}`);
              
              // CRÍTICO: Filtrar y devolver SOLO los viajes de la compañía del usuario
              const viajesFiltrados = trips.filter(t => t.companyId === userCompany);
              console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de compañía ${userCompany}`);
              
              // Guardar en caché y devolver resultados filtrados por compañía
              serverTripCache.set(cacheKey, viajesFiltrados);
              return res.json(viajesFiltrados);
            }
          }
        }
      }
      
      // Cachear resultado solo si es una consulta específica y el resultado no es demasiado grande
      if (shouldUseCache && trips.length < 1000) {
        serverTripCache.set(cacheKey, trips);
        console.log(`[GET /trips] Datos cacheados - total: ${trips.length} viajes`);
      } else {
        console.log(`[GET /trips] No cacheando - consulta demasiado grande: ${trips.length} viajes`);
      }
      
      return res.json(trips);
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
      
      // Get template information
      const template = await storage.getRouteTemplate(tripData.templateId);
      if (!template) {
        return res.status(400).json({
          error: "Template not found",
          details: "The selected template does not exist"
        });
      }
      
      // Get route information from template
      const templateRoute = await storage.getRoute(template.routeId);
      if (!templateRoute) {
        return res.status(400).json({
          error: "Route not found",
          details: "The route associated with this template does not exist"
        });
      }
      
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
      const route = await storage.getRouteWithSegments(template.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Create a trip for each date in the range
      const startDate = normalizeToStartOfDay(tripData.startDate);
      const endDate = normalizeToStartOfDay(tripData.endDate);
      const createdTrips = [];
      
      // Generate all possible segments (direct and intermediate segments) - filtering now done in frontend
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

      // Calculate segment times with priority: 1) SegmentPrices from frontend, 2) Template config, 3) Proportional
      console.log("\n=== CALCULANDO HORARIOS DE SEGMENTOS ===");
      console.log(`Plantilla ID: ${template.id}, Configuración de tiempo disponible: ${template.timeConfiguration ? 'SÍ' : 'NO'}`);
      console.log(`segmentPrices del frontend disponibles: ${tripData.segmentPrices ? 'SÍ' : 'NO'}`);
      console.log(`stopTimes manuales disponibles: ${tripDataWithStopTimes.stopTimes ? 'SÍ' : 'NO'}`);
      
      let segmentTimes;
      
      // Verificar si hay horarios personalizados en segmentPrices del frontend
      const hasCustomTimes = tripData.segmentPrices?.some(
        (sp: any) => sp.departureTime || sp.arrivalTime
      );
      
      if (hasCustomTimes) {
        // PRIORIDAD 1: Usar horarios personalizados del frontend (segmentPrices)
        console.log("🎯 PRIORIDAD 1: Usando horarios personalizados del frontend (segmentPrices)");
        console.log("segmentPrices con horarios personalizados:", tripData.segmentPrices);
        
        // Crear mapa de horarios directamente de segmentPrices
        segmentTimes = {};
        tripData.segmentPrices.forEach((sp: any) => {
          if (sp.departureTime && sp.arrivalTime) {
            const key = `${sp.origin}-${sp.destination}`;
            segmentTimes[key] = {
              departureTime: sp.departureTime,
              arrivalTime: sp.arrivalTime
            };
            console.log(`✅ Horario personalizado para ${sp.origin} → ${sp.destination}: ${sp.departureTime} - ${sp.arrivalTime}`);
          }
        });
      } else if (template.timeConfiguration && typeof template.timeConfiguration === 'object') {
        // PRIORIDAD 2: Usar configuración automática de la plantilla
        console.log("🔧 PRIORIDAD 2: Usando configuración automática de horarios de la plantilla");
        console.log("Configuración de tiempo:", template.timeConfiguration);
        
        segmentTimes = calculateSegmentTimesFromTemplate(
          allSegments,
          departureTime,
          route,
          template.timeConfiguration
        );
      } else {
        // PRIORIDAD 3: Usar cálculo proporcional como fallback
        console.log("⚠️ PRIORIDAD 3: Usando cálculo proporcional (fallback) - no hay configuración disponible");
        segmentTimes = calculateSegmentTimes(
          allSegments, 
          departureTime, 
          arrivalTime,
          route
        );
      }
      
      // Detectar si el viaje cruza medianoche
      const crossesMidnight = isCrossingMidnight(departureTime, arrivalTime);
      console.log(`\n=== ANÁLISIS DE CRUCE DE MEDIANOCHE ===`);
      console.log(`Viaje ${departureTime} -> ${arrivalTime}: ${crossesMidnight ? 'SÍ cruza medianoche' : 'NO cruza medianoche'}`);
      
      // Si cruza medianoche, solo crear el viaje para la fecha de salida
      const datesToProcess = [];
      if (crossesMidnight) {
        // Solo procesar la fecha de salida para viajes nocturnos
        datesToProcess.push(new Date(startDate));
        console.log(`⚠️ Viaje nocturno detectado: Solo se creará para fecha de salida ${formatDateToLocal(startDate)}`);
      } else {
        // Procesar todas las fechas del rango para viajes diurnos
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          datesToProcess.push(new Date(date));
        }
        console.log(`✅ Viaje diurno: Se creará para ${datesToProcess.length} fechas`);
      }
      
      // Iterar por cada fecha a procesar
      for (const date of datesToProcess) {
        const currentDateStr = formatDateToLocal(date);
        console.log(`\n=== CREANDO VIAJE PARA FECHA: ${currentDateStr} ===`);
        
        // Crear el array de combinaciones para trip_data de esta fecha específica
        const tripCombinations = [];
        
        // Agregar el viaje principal (origen a destino)
        const mainSegmentPrice = tripData.segmentPrices.find(
          (sp: any) => sp.origin === route.origin && sp.destination === route.destination
        );
        
        // LÓGICA MEJORADA: Calcular departureDate real del viaje principal
        const mainDepartureDate = calculateSegmentDate(date, departureTime);
        
        tripCombinations.push({
          tripId: Date.now(),
          origin: route.origin,
          destination: route.destination,
          departureDate: formatDateToLocal(mainDepartureDate),
          departureTime: departureTime.replace(/\s*\+\d+d$/, ''),
          arrivalTime: arrivalTime.replace(/\s*\+\d+d$/, ''),
          price: mainSegmentPrice?.price || 450,
          availableSeats: tripData.capacity,
          isMainTrip: true
        });
        
        console.log(`Viaje principal: ${route.origin} → ${route.destination}`);
        console.log(`  departureTime: ${departureTime} → departureDate: ${formatDateToLocal(mainDepartureDate)}`);
        
        // Agregar solo los segmentos que vienen desde el frontend (ya filtrados por combinaciones habilitadas)
        for (const segmentFromFrontend of tripData.segmentPrices || []) {
          // Saltar el viaje principal ya que ya lo agregamos arriba
          if (segmentFromFrontend.origin === route.origin && segmentFromFrontend.destination === route.destination) {
            continue;
          }
          
          console.log(`🎯 Procesando segmento habilitado desde frontend: ${segmentFromFrontend.origin} → ${segmentFromFrontend.destination}`);
          
          let segmentPrice = segmentFromFrontend.price || 0;
          let segmentDepartureTime = segmentTimes[`${segmentFromFrontend.origin}-${segmentFromFrontend.destination}`]?.departureTime || departureTime;
          let segmentArrivalTime = segmentTimes[`${segmentFromFrontend.origin}-${segmentFromFrontend.destination}`]?.arrivalTime || arrivalTime;
          
          // LÓGICA MEJORADA: Calcular departureDate real del segmento basándose en su horario específico
          const segmentDepartureDate = calculateSegmentDate(date, segmentDepartureTime);
          
          tripCombinations.push({
            tripId: Math.floor(Date.now() + Math.random() * 1000),
            origin: segmentFromFrontend.origin,
            destination: segmentFromFrontend.destination,
            departureDate: formatDateToLocal(segmentDepartureDate),
            departureTime: segmentDepartureTime.replace(/\s*\+\d+d$/, ''),
            arrivalTime: segmentArrivalTime.replace(/\s*\+\d+d$/, ''),
            price: segmentPrice,
            availableSeats: tripData.capacity,
            isMainTrip: false
          });
          
          console.log(`Segmento: ${segmentFromFrontend.origin} → ${segmentFromFrontend.destination}`);
          console.log(`  departureTime: ${segmentDepartureTime} → departureDate: ${formatDateToLocal(segmentDepartureDate)}`);
        }
        
        console.log(`\nCreando viaje para ${currentDateStr} con ${tripCombinations.length} segmentos`);
        console.log("DEBUG: tripCombinations:", JSON.stringify(tripCombinations, null, 2));
        
        const mainTripToCreate = {
          tripData: tripCombinations,
          capacity: tripData.capacity,
          vehicleId: null,
          driverId: null,
          visibility: tripData.visibility || "publicado",
          routeId: template.routeId, // CORREGIDO: Usar routeId del template, no de tripData
          companyId: companyId
        };
        
        const mainTrip = await storage.createTrip(mainTripToCreate);
        console.log(`✅ Viaje creado para ${currentDateStr} con ID: ${mainTrip.id}`);
        createdTrips.push(mainTrip);
      }
      
      // Invalidar todo el caché cuando se crean nuevos viajes
      serverTripCache.invalidateAll();
      console.log(`[POST /trips] Caché invalidado después de crear ${createdTrips.length} viajes`);
      
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
  
  // Función para calcular la fecha real de un segmento basándose en su horario
  function calculateSegmentDate(baseDate: Date, timeString: string): Date {
    console.log(`[calculateSegmentDate] 🔥 FUNCIÓN EJECUTADA: baseDate=${formatDateToLocal(baseDate)}, timeString="${timeString}"`);
    
    if (!timeString) {
      console.log(`[calculateSegmentDate] ❌ timeString vacío, retornando baseDate`);
      return new Date(baseDate);
    }
    
    try {
      // Primero, intentar extraer un indicador de día existente (+1d, +2d, etc.)
      const dayOffset = extractDayIndicator(timeString);
      
      if (dayOffset > 0) {
        // Si ya tiene indicador de día, usarlo directamente
        const resultDate = new Date(baseDate);
        resultDate.setDate(resultDate.getDate() + dayOffset);
        console.log(`  [calculateSegmentDate] Usando indicador existente +${dayOffset}d: ${timeString} → ${formatDateToLocal(resultDate)}`);
        return resultDate;
      }
      
      // Si no tiene indicador, verificar si es un horario nocturno (AM temprano)
      const cleanTime = timeString.replace(/\s*\+\d+d$/, '').trim();
      const timeParts = cleanTime.split(' ');
      
      if (timeParts.length >= 2) {
        const timeStr = timeParts[0];
        const amPm = timeParts[1].toUpperCase();
        
        if (amPm === 'AM' && timeStr) {
          const [hourStr, minuteStr] = timeStr.split(':');
          const hour = parseInt(hourStr, 10);
          const minute = parseInt(minuteStr || '0', 10);
          
          // Convertir a formato 24 horas para verificar si es horario nocturno
          let hour24 = hour;
          if (hour === 12) hour24 = 0; // 12:xx AM = 00:xx en formato 24h
          
          // Si es entre 00:00 AM y 6:59 AM, asumir que es del día siguiente
          if (!isNaN(hour24) && !isNaN(minute) && hour24 >= 0 && hour24 <= 6) {
            const nextDay = new Date(baseDate);
            nextDay.setDate(nextDay.getDate() + 1);
            console.log(`  [calculateSegmentDate] Horario AM temprano detectado: ${timeString} (${hour24}:${minute.toString().padStart(2, '0')}) → ${formatDateToLocal(nextDay)} (+1 día)`);
            return nextDay;
          }
        }
      }
      
      // Para otros casos, usar la fecha base
      console.log(`  [calculateSegmentDate] Horario diurno: ${timeString} → ${formatDateToLocal(baseDate)} (mismo día)`);
      return new Date(baseDate);
      
    } catch (error) {
      console.error(`[calculateSegmentDate] Error procesando tiempo ${timeString}:`, error);
      return new Date(baseDate);
    }
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
    
    console.log(`\n🚀 Generando segmentos para la ruta ${route.id}`);
    console.log(`📍 Puntos en la ruta: ${allPoints.join(' -> ')}`);
    
    // Generate all possible combinations (not just consecutive stops)
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
        
        allSegments.push({
          origin: allPoints[i],
          destination: allPoints[j],
          price: 0
        });
        
        console.log(`  + Segmento incluido: ${allPoints[i]} -> ${allPoints[j]}`);
      }
    }
    
    console.log(`\n✅ Generados ${allSegments.length} segmentos válidos para la ruta ${route.id}`);
    
    return allSegments;
  }
  
  // Helper function to calculate segment times based on template configuration
  function calculateSegmentTimesFromTemplate(
    segments: { origin: string; destination: string }[],
    departureTime: string,
    route: RouteWithSegments,
    timeConfiguration: Record<string, { hours: number; minutes: number }>
  ): Record<string, { departureTime: string; arrivalTime: string; dayOffset?: number }> {
    console.log("🚀 Calculando horarios basados en configuración de plantilla");
    console.log("Configuración de tiempo recibida:", timeConfiguration);
    
    const segmentTimes: Record<string, { departureTime: string; arrivalTime: string; dayOffset?: number }> = {};
    const allPoints = [route.origin, ...route.stops, route.destination];
    
    // Crear un mapa de ubicaciones a tiempos calculados
    const locationTimes: Record<string, { time: string; totalMinutes: number; dayOffset: number }> = {};
    
    // Parsear el tiempo de salida inicial
    const [depTime, depPeriod] = departureTime.split(' ');
    const [depHour, depMinute] = depTime.split(':').map(Number);
    let dep24Hour = depHour;
    if (depPeriod === 'PM' && depHour < 12) dep24Hour += 12;
    if (depPeriod === 'AM' && depHour === 12) dep24Hour = 0;
    
    const startMinutes = dep24Hour * 60 + depMinute;
    
    // Establecer tiempo inicial
    locationTimes[route.origin] = {
      time: departureTime,
      totalMinutes: startMinutes,
      dayOffset: 0
    };
    
    console.log(`Tiempo inicial: ${route.origin} = ${departureTime} (${startMinutes} minutos)`);
    
    // Calcular tiempos acumulativos siguiendo la configuración de la plantilla
    let currentMinutes = startMinutes;
    let currentDayOffset = 0;
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const fromLocation = allPoints[i];
      const toLocation = allPoints[i + 1];
      const segmentKey = `${fromLocation} → ${toLocation}`;
      
      console.log(`\n📍 Procesando segmento: ${segmentKey}`);
      
      // Buscar la configuración de tiempo para este segmento
      const timeConfig = timeConfiguration[segmentKey];
      
      if (timeConfig && typeof timeConfig === 'object') {
        const additionalMinutes = (timeConfig.hours || 0) * 60 + (timeConfig.minutes || 0);
        currentMinutes += additionalMinutes;
        
        // Verificar si cruzamos medianoche
        if (currentMinutes >= 24 * 60) {
          currentDayOffset++;
          currentMinutes = currentMinutes % (24 * 60);
          console.log(`⚠️ Cruzando medianoche: nuevo día offset = ${currentDayOffset}`);
        }
        
        // Convertir minutos a formato 12 horas
        const hour24 = Math.floor(currentMinutes / 60);
        const minute = currentMinutes % 60;
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 > 12 ? hour24 - 12 : (hour24 === 0 ? 12 : hour24);
        
        const timeString = `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
        
        locationTimes[toLocation] = {
          time: timeString,
          totalMinutes: currentMinutes,
          dayOffset: currentDayOffset
        };
        
        console.log(`✅ ${toLocation} = ${timeString} (+${additionalMinutes} min, día +${currentDayOffset})`);
      } else {
        console.log(`⚠️ No se encontró configuración para ${segmentKey}, usando tiempo predeterminado`);
        // Usar un tiempo predeterminado de 30 minutos
        currentMinutes += 30;
        
        if (currentMinutes >= 24 * 60) {
          currentDayOffset++;
          currentMinutes = currentMinutes % (24 * 60);
        }
        
        const hour24 = Math.floor(currentMinutes / 60);
        const minute = currentMinutes % 60;
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 > 12 ? hour24 - 12 : (hour24 === 0 ? 12 : hour24);
        
        const timeString = `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
        
        locationTimes[toLocation] = {
          time: timeString,
          totalMinutes: currentMinutes,
          dayOffset: currentDayOffset
        };
      }
    }
    
    console.log("\n🎯 Tiempos calculados por ubicación:");
    Object.entries(locationTimes).forEach(([location, timeInfo]) => {
      console.log(`  ${location}: ${timeInfo.time} (día +${timeInfo.dayOffset})`);
    });
    
    // Generar tiempos para todos los segmentos solicitados
    segments.forEach(segment => {
      const originTime = locationTimes[segment.origin];
      const destinationTime = locationTimes[segment.destination];
      
      if (originTime && destinationTime) {
        let departureTimeStr = originTime.time;
        let arrivalTimeStr = destinationTime.time;
        
        // Agregar indicador de día si es necesario
        if (originTime.dayOffset > 0) {
          departureTimeStr += ` +${originTime.dayOffset}d`;
        }
        if (destinationTime.dayOffset > 0) {
          arrivalTimeStr += ` +${destinationTime.dayOffset}d`;
        }
        
        const key = `${segment.origin}-${segment.destination}`;
        segmentTimes[key] = {
          departureTime: departureTimeStr,
          arrivalTime: arrivalTimeStr,
          dayOffset: destinationTime.dayOffset - originTime.dayOffset
        };
        
        console.log(`📝 Segmento ${segment.origin} → ${segment.destination}: ${departureTimeStr} - ${arrivalTimeStr}`);
      } else {
        console.log(`❌ No se pudieron calcular tiempos para ${segment.origin} → ${segment.destination}`);
      }
    });
    
    return segmentTimes;
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
      
      console.log(`[PUT /trips/${id}] ========== DIAGNÓSTICO DE FECHAS Y CAPACIDAD ==========`);
      console.log(`[PUT /trips/${id}] startDate recibido del frontend:`, startDate);
      console.log(`[PUT /trips/${id}] endDate recibido del frontend:`, endDate);
      console.log(`[PUT /trips/${id}] currentTrip.departureDate:`, currentTrip.departureDate);
      console.log(`[PUT /trips/${id}] getCurrentLocalDate():`, getCurrentLocalDate());
      console.log(`[PUT /trips/${id}] ========== DIAGNÓSTICO DE CAPACIDAD Y ASIENTOS ==========`);
      console.log(`[PUT /trips/${id}] segmentPrices recibidos:`, segmentPrices ? segmentPrices.length : 0);
      console.log(`[PUT /trips/${id}] stopTimes recibidos:`, stopTimes ? stopTimes.length : 0);
      console.log(`[PUT /trips/${id}] capacity recibida del frontend:`, capacity);
      console.log(`[PUT /trips/${id}] capacity actual del viaje:`, currentTrip.capacity);
      console.log(`[PUT /trips/${id}] Primer segmento actual:`, currentTrip.tripData?.[0]);
      console.log(`[PUT /trips/${id}] ===============================================================`);
      
      // Obtener información de la ruta para generar segmentos completos
      const route = await storage.getRoute(routeId || currentTrip.routeId);
      if (!route) {
        return res.status(400).json({ error: "Route not found" });
      }
      
      // NO usar timeMap - solo horarios explícitos del frontend
      console.log(`[PUT /trips/${id}] Usando solo horarios explícitos del frontend, ignorando timeMap`);
      
      // PRESERVAR los tripId existentes del tripData original
      const existingTripData = Array.isArray(currentTrip.tripData) ? currentTrip.tripData : [];
      console.log(`[PUT /trips/${id}] tripData existente:`, existingTripData);
      
      // Crear mapa de tripId existentes por segmento (origin -> destination)
      const existingTripIdMap: Record<string, any> = {};
      existingTripData.forEach((trip: any) => {
        const key = `${trip.origin} -> ${trip.destination}`;
        existingTripIdMap[key] = trip;
      });
      
      // CRÍTICO: Preservar TODOS los segmentos existentes y solo actualizar los que vienen en segmentPrices
      const newTripData: any[] = [];
      
      // Crear mapa de segmentos que vienen del frontend para actualizar
      const frontendSegmentMap: Record<string, any> = {};
      if (segmentPrices && Array.isArray(segmentPrices)) {
        segmentPrices.forEach((segment: any) => {
          const key = `${segment.origin} -> ${segment.destination}`;
          frontendSegmentMap[key] = segment;
        });
      }
      
      console.log(`[PUT /trips/${id}] Frontend enviará actualizaciones para ${Object.keys(frontendSegmentMap).length} segmentos de ${existingTripData.length} existentes`);
      
      // Procesar todos los segmentos existentes
      existingTripData.forEach((existingTrip: any) => {
        const segmentKey = `${existingTrip.origin} -> ${existingTrip.destination}`;
        const frontendUpdate = frontendSegmentMap[segmentKey];
        
        if (frontendUpdate) {
          // Este segmento se está actualizando desde el frontend
          console.log(`[PUT /trips/${id}] ACTUALIZANDO segmento: ${segmentKey}`);
          
          // Solo usar horarios del timeMap si se enviaron específicamente en el frontend
          let finalDepartureTime = existingTrip.departureTime;
          let finalArrivalTime = existingTrip.arrivalTime;
          
          // Solo actualizar horarios si vienen explícitamente en el frontendUpdate
          if (frontendUpdate.departureTime !== undefined) {
            finalDepartureTime = frontendUpdate.departureTime;
          }
          
          if (frontendUpdate.arrivalTime !== undefined) {
            finalArrivalTime = frontendUpdate.arrivalTime;
          }
          
          // ELIMINAR completamente el uso de timeMap - solo usar horarios explícitos del frontend
          
          console.log(`[PUT /trips/${id}] Horarios para ${segmentKey}: departure=${finalDepartureTime} (original: ${existingTrip.departureTime}), arrival=${finalArrivalTime} (original: ${existingTrip.arrivalTime})`);
          
          // CRÍTICO: NO tocar availableSeats a menos que se cambie capacity explícitamente
          let calculatedAvailableSeats = existingTrip.availableSeats;
          
          // SOLO recalcular si la capacidad realmente cambió (no solo fue enviada)
          // CRÍTICO: Comparar con currentTrip.capacity (nivel de viaje) NO con existingTrip.capacity (nivel de segmento)
          if (capacity !== undefined && capacity !== currentTrip.capacity) {
            const currentOccupancy = (existingTrip.capacity || 0) - (existingTrip.availableSeats || 0);
            calculatedAvailableSeats = Math.max(0, capacity - currentOccupancy);
            console.log(`[PUT /trips/${id}] RECALCULANDO asientos para ${segmentKey}: capacidad ${existingTrip.capacity}→${capacity}, ocupación actual: ${currentOccupancy}, nuevos asientos disponibles: ${calculatedAvailableSeats}`);
          } else {
            console.log(`[PUT /trips/${id}] PRESERVANDO asientos para ${segmentKey}: ${existingTrip.availableSeats} asientos (NO se cambió capacidad - trip: ${currentTrip.capacity}, recibido: ${capacity})`);
          }
          
          // PRESERVAR el tripId existente y actualizar solo campos modificados
          const baseDateStr = startDate || existingTrip.departureDate || getCurrentLocalDate();
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] COMPONENTES: startDate="${startDate}", existingTrip.departureDate="${existingTrip.departureDate}", getCurrentLocalDate()="${getCurrentLocalDate()}"`);
          const baseDateObj = normalizeToStartOfDay(baseDateStr);
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] INPUT: baseDateStr="${baseDateStr}", finalDepartureTime="${finalDepartureTime}"`);
          const calculatedDepartureDate = formatDateToLocal(
            calculateSegmentDate(baseDateObj, finalDepartureTime)
          );
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] OUTPUT: calculatedDepartureDate="${calculatedDepartureDate}"`)
          
          newTripData.push({
            price: frontendUpdate.price !== undefined ? frontendUpdate.price : existingTrip.price,
            origin: existingTrip.origin,
            destination: existingTrip.destination,
            tripId: existingTrip.tripId, // PRESERVAR tripId existente
            isMainTrip: existingTrip.isMainTrip,
            departureDate: calculatedDepartureDate,
            departureTime: finalDepartureTime,
            arrivalTime: finalArrivalTime,
            availableSeats: calculatedAvailableSeats,
            capacity: capacity !== undefined ? capacity : existingTrip.capacity
          });
          
          console.log(`[PUT /trips/${id}] Fecha calculada para ${segmentKey}: ${calculatedDepartureDate} (basada en ${finalDepartureTime})`);
        } else {
          // Este segmento NO se está actualizando, preservar completamente
          console.log(`[PUT /trips/${id}] PRESERVANDO segmento: ${segmentKey} (tripId: ${existingTrip.tripId})`);
          
          // CRÍTICO: NO tocar availableSeats a menos que se cambie capacity explícitamente
          let calculatedAvailableSeats = existingTrip.availableSeats;
          
          // SOLO recalcular si la capacidad realmente cambió (no solo fue enviada)
          // CRÍTICO: Comparar con currentTrip.capacity (nivel de viaje) NO con existingTrip.capacity (nivel de segmento)
          if (capacity !== undefined && capacity !== currentTrip.capacity) {
            const currentOccupancy = (existingTrip.capacity || 0) - (existingTrip.availableSeats || 0);
            calculatedAvailableSeats = Math.max(0, capacity - currentOccupancy);
            console.log(`[PUT /trips/${id}] RECALCULANDO asientos para ${segmentKey} (preservado): capacidad ${existingTrip.capacity}→${capacity}, ocupación actual: ${currentOccupancy}, nuevos asientos disponibles: ${calculatedAvailableSeats}`);
          } else {
            console.log(`[PUT /trips/${id}] PRESERVANDO asientos para ${segmentKey} (preservado): ${existingTrip.availableSeats} asientos (NO se cambió capacidad - trip: ${currentTrip.capacity}, recibido: ${capacity})`);
          }
          
          const baseDateStr = startDate || existingTrip.departureDate || getCurrentLocalDate();
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] PRESERVED COMPONENTES: startDate="${startDate}", existingTrip.departureDate="${existingTrip.departureDate}", getCurrentLocalDate()="${getCurrentLocalDate()}"`);
          const baseDateObj = normalizeToStartOfDay(baseDateStr);
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] PRESERVED INPUT: baseDateStr="${baseDateStr}", departureTime="${existingTrip.departureTime}"`);
          const calculatedDepartureDate = formatDateToLocal(
            calculateSegmentDate(baseDateObj, existingTrip.departureTime)
          );
          console.log(`[PUT /trips/${id}] [calculateSegmentDate] PRESERVED OUTPUT: calculatedDepartureDate="${calculatedDepartureDate}"`)
          
          newTripData.push({
            price: existingTrip.price,
            origin: existingTrip.origin,
            destination: existingTrip.destination,
            tripId: existingTrip.tripId, // PRESERVAR tripId existente
            isMainTrip: existingTrip.isMainTrip,
            departureDate: calculatedDepartureDate,
            departureTime: existingTrip.departureTime,
            arrivalTime: existingTrip.arrivalTime,
            availableSeats: calculatedAvailableSeats,
            capacity: capacity !== undefined ? capacity : existingTrip.capacity
          });
          
          console.log(`[PUT /trips/${id}] Fecha calculada para ${segmentKey} (preservado): ${calculatedDepartureDate} (basada en ${existingTrip.departureTime})`);
        }
      });
      
      console.log(`[PUT /trips/${id}] Resultado: ${newTripData.length} segmentos preservados (${existingTripData.length} originales)`);
      
      // Verificar que no se perdieron segmentos
      if (newTripData.length !== existingTripData.length) {
        console.error(`[PUT /trips/${id}] ERROR: Se perdieron ${existingTripData.length - newTripData.length} segmentos durante la actualización`);
      }
      
      // CRÍTICO: Construir el objeto de actualización PRESERVANDO todos los datos críticos
      const updateData = {
        tripData: newTripData,
        capacity: capacity !== undefined ? capacity : currentTrip.capacity,
        vehicleId: vehicleId !== undefined ? vehicleId : currentTrip.vehicleId,
        driverId: driverId !== undefined ? driverId : currentTrip.driverId,
        visibility: visibility || currentTrip.visibility,
        
        // PRESERVAR datos críticos que NO deben cambiar en edición
        routeId: currentTrip.routeId, // NO cambiar routeId en edición
        templateId: currentTrip.templateId, // PRESERVAR templateId
        createdBy: currentTrip.createdBy, // PRESERVAR creador
        companyId: currentTrip.companyId, // PRESERVAR companyId
        tripStatus: currentTrip.tripStatus, // PRESERVAR estado del viaje
        createdAt: currentTrip.createdAt, // PRESERVAR fecha de creación
        updatedAt: new Date().toISOString() // Solo actualizar timestamp
      };
      
      console.log(`[PUT /trips/${id}] DATOS ORIGINALES PRESERVADOS:`, {
        routeId: currentTrip.routeId,
        templateId: currentTrip.templateId,
        createdBy: currentTrip.createdBy,
        companyId: currentTrip.companyId,
        tripStatus: currentTrip.tripStatus
      });
      
      console.log(`[PUT /trips/${id}] Actualizando viaje con datos:`, updateData);
      
      // Actualizar el viaje en la base de datos
      const updatedTrip = await storage.updateTrip(id, updateData);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found or could not be updated" });
      }
      
      console.log(`[PUT /trips/${id}] Viaje actualizado exitosamente`);
      
      // Invalidar caché después de actualizar viaje
      serverTripCache.invalidateAll();
      console.log(`[PUT /trips/${id}] Caché invalidado después de actualizar viaje`);
      
      // Retornar el viaje actualizado
      res.json(updatedTrip);
    } catch (error: any) {
      console.error(`[PUT /trips] Error al actualizar viaje:`, error.message);
      res.status(500).json({ error: "Error interno del servidor al actualizar el viaje" });
    }
  });

  // Endpoint para eliminar viajes por rango de fechas (DEBE IR ANTES de /:id)
  app.delete(apiRouter("/trips/bulk-delete"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, routeId } = req.body;
      
      // Validar datos de entrada
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: "Se requieren fechas de inicio y fin",
          details: "startDate y endDate son requeridos" 
        });
      }

      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[DELETE /trips/bulk-delete] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      console.log(`[DELETE /trips/bulk-delete] Rango de fechas: ${startDate} a ${endDate}`);
      console.log(`[DELETE /trips/bulk-delete] Filtro de ruta: ${routeId || 'Sin filtro'}`);
      
      if (user) {
        console.log(`[DELETE /trips/bulk-delete] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Validar que el usuario tenga permisos para eliminar viajes masivamente
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "No tiene permisos para eliminar viajes masivamente" 
        });
      }
      
      // Normalizar fechas
      const normalizedStartDate = normalizeToStartOfDay(new Date(startDate));
      const normalizedEndDate = normalizeToStartOfDay(new Date(endDate));
      
      console.log(`[DELETE /trips/bulk-delete] Fechas normalizadas: ${normalizedStartDate} a ${normalizedEndDate}`);
      
      // Obtener viajes en el rango de fechas
      const tripsInRange = await storage.getTripsInDateRange(
        formatDateToLocal(normalizedStartDate),
        formatDateToLocal(normalizedEndDate),
        user.companyId || user.company
      );
      
      console.log(`[DELETE /trips/bulk-delete] Encontrados ${tripsInRange.length} viajes en el rango (antes de filtro de ruta)`);
      
      // Filtrar por ruta si se especificó
      let filteredTrips = tripsInRange;
      if (routeId && routeId !== "") {
        const routeIdNumber = parseInt(routeId as string, 10);
        filteredTrips = tripsInRange.filter(trip => trip.routeId === routeIdNumber);
        console.log(`[DELETE /trips/bulk-delete] Después de filtro de ruta ${routeIdNumber}: ${filteredTrips.length} viajes`);
      }
      
      if (filteredTrips.length === 0) {
        return res.json({ 
          message: routeId ? "No se encontraron viajes en el rango especificado para la ruta seleccionada" : "No se encontraron viajes en el rango especificado",
          deletedCount: 0 
        });
      }
      
      // Eliminar viajes uno por uno, cancelando reservaciones primero
      let deletedCount = 0;
      let totalCancelledReservations = 0;
      let errors = [];
      
      for (const trip of filteredTrips) {
        try {
          // Verificar permisos de compañía para cada viaje
          if (user.role !== UserRole.SUPER_ADMIN) {
            const userCompanyId = user.companyId;
            
            if (!userCompanyId) {
              errors.push(`Viaje ${trip.id}: Usuario sin compañía asignada`);
              continue;
            }
            
            if (trip.companyId && trip.companyId !== userCompanyId) {
              errors.push(`Viaje ${trip.id}: No tiene permiso para eliminar viajes de otra compañía`);
              continue;
            }
          }
          
          // Primero cancelar reservaciones asociadas al viaje
          console.log(`[DELETE /trips/bulk-delete] Cancelando reservaciones para viaje ${trip.id}`);
          const cancellationResult = await storage.cancelReservationsByTripId(trip.id);
          
          if (cancellationResult.errors.length > 0) {
            errors.push(...cancellationResult.errors);
          }
          
          totalCancelledReservations += cancellationResult.cancelledCount;
          console.log(`[DELETE /trips/bulk-delete] Canceladas ${cancellationResult.cancelledCount} reservaciones para viaje ${trip.id}`);
          
          // Luego intentar eliminar el viaje
          const success = await storage.deleteTrip(trip.id);
          if (success) {
            deletedCount++;
            console.log(`[DELETE /trips/bulk-delete] Eliminado viaje ${trip.id}`);
          } else {
            errors.push(`Viaje ${trip.id}: Error al eliminar después de cancelar reservaciones`);
          }
        } catch (error) {
          errors.push(`Viaje ${trip.id}: ${error.message}`);
        }
      }
      
      // Invalidar caché después de eliminar viajes
      serverTripCache.invalidateAll();
      console.log(`[DELETE /trips/bulk-delete] Caché invalidado después de eliminar ${deletedCount} viajes`);
      
      const result = {
        message: `Se eliminaron ${deletedCount} viajes de ${filteredTrips.length} encontrados${totalCancelledReservations > 0 ? ` y se cancelaron ${totalCancelledReservations} reservaciones` : ''}`,
        deletedCount,
        totalFound: filteredTrips.length,
        cancelledReservations: totalCancelledReservations,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log(`[DELETE /trips/bulk-delete] Resultado:`, result);
      
      res.json(result);
    } catch (error: any) {
      console.error(`[DELETE /trips/bulk-delete] Error:`, error.message);
      res.status(500).json({ 
        error: "Error interno del servidor al eliminar viajes",
        details: error.message 
      });
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

  // Endpoint para obtener count de eliminación masiva
  app.get(apiRouter("/trips/bulk-delete/count"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, routeId } = req.query;
      
      // Validar datos de entrada
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: "Se requieren fechas de inicio y fin",
          details: "startDate y endDate son requeridos como query parameters" 
        });
      }

      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /trips/bulk-delete/count] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      console.log(`[GET /trips/bulk-delete/count] Rango de fechas: ${startDate} a ${endDate}`);
      console.log(`[GET /trips/bulk-delete/count] Filtro de ruta: ${routeId || 'Sin filtro'}`);
      
      // Validar permisos
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "No tiene permisos para ver el conteo de eliminación masiva" 
        });
      }
      
      // Normalizar fechas
      const normalizedStartDate = normalizeToStartOfDay(new Date(startDate as string));
      const normalizedEndDate = normalizeToStartOfDay(new Date(endDate as string));
      
      console.log(`[GET /trips/bulk-delete/count] Fechas normalizadas: ${normalizedStartDate} a ${normalizedEndDate}`);
      
      // Obtener viajes en el rango de fechas
      const tripsInRange = await storage.getTripsInDateRange(
        formatDateToLocal(normalizedStartDate),
        formatDateToLocal(normalizedEndDate),
        user.companyId || user.company
      );
      
      console.log(`[GET /trips/bulk-delete/count] Encontrados ${tripsInRange.length} viajes en el rango (antes de filtro de ruta)`);
      
      // Filtrar por ruta si se especificó
      let filteredTrips = tripsInRange;
      if (routeId && routeId !== "") {
        const routeIdNumber = parseInt(routeId as string, 10);
        filteredTrips = tripsInRange.filter(trip => trip.routeId === routeIdNumber);
        console.log(`[GET /trips/bulk-delete/count] Después de filtro de ruta ${routeIdNumber}: ${filteredTrips.length} viajes`);
      }
      
      const result = {
        tripsCount: filteredTrips.length
      };
      
      console.log(`[GET /trips/bulk-delete/count] Resultado:`, result);
      
      res.json(result);
    } catch (error: any) {
      console.error(`[GET /trips/bulk-delete/count] Error:`, error.message);
      res.status(500).json({ 
        error: "Error interno del servidor al obtener conteo",
        details: error.message 
      });
    }
  });


  
  // Endpoint específico para asignar vehículo o conductor a un viaje (PATCH)
  app.patch(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      console.log(`PATCH /trips/${id} - Datos recibidos:`, JSON.stringify(req.body, null, 2));
      
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
      
      // Datos a actualizar - permitir múltiples campos en PATCH
      const updateData: Partial<any> = {};
      
      // Procesar vehicleId (si está presente)
      if (req.body.vehicleId !== undefined) {
        console.log(`Asignando vehículo ${req.body.vehicleId} al viaje ${id}`);
        // Convertir a número si viene como string, null para "0" o valores falsy
        updateData.vehicleId = (req.body.vehicleId === "0" || req.body.vehicleId === 0) 
          ? null 
          : (typeof req.body.vehicleId === 'string' 
            ? parseInt(req.body.vehicleId, 10) 
            : req.body.vehicleId);
      }
      
      // Procesar driverId (si está presente)
      if (req.body.driverId !== undefined) {
        console.log(`Asignando conductor ${req.body.driverId} al viaje ${id}`);
        // Convertir a número si viene como string, null para "0" o valores falsy
        updateData.driverId = (req.body.driverId === "0" || req.body.driverId === 0) 
          ? null 
          : (typeof req.body.driverId === 'string' 
            ? parseInt(req.body.driverId, 10) 
            : req.body.driverId);
      }
      
      // Procesar capacity (si está presente)
      if (req.body.capacity !== undefined) {
        console.log(`Actualizando capacidad a ${req.body.capacity} para viaje ${id}`);
        const newCapacity = typeof req.body.capacity === 'string' 
          ? parseInt(req.body.capacity, 10) 
          : req.body.capacity;
        
        // CRÍTICO: Solo actualizar disponibilidad si la capacidad realmente cambió
        if (newCapacity !== currentTrip.capacity) {
          console.log(`🔄 CAPACIDAD CAMBIADA: ${currentTrip.capacity} → ${newCapacity}`);
          
          updateData.capacity = newCapacity;
          
          // IMPORTANTE: Recalcular availableSeats basado en reservas existentes
          if (currentTrip.tripData && Array.isArray(currentTrip.tripData)) {
            console.log(`Recalculando availableSeats para ${currentTrip.tripData.length} segmentos`);
            
            // Obtener reservas existentes para este viaje
            const existingReservations = await storage.getReservations(currentTrip.companyId);
            const tripReservations = existingReservations.filter(r => 
              r.tripDetails?.recordId === currentTrip.id && 
              r.status !== 'cancelled'
            );
            
            console.log(`📊 Reservas activas encontradas: ${tripReservations.length}`);
            
            const updatedTripData = currentTrip.tripData.map((segment: any, index: number) => {
              // Para debugging solo en los primeros 3 segmentos
              const shouldLog = index < 3;
              
              // Contar reservas para este segmento específico
              const segmentReservations = tripReservations.filter(r => {
                // Comparar tanto con tripId del segmento como con recordId
                const reservationTripId = r.tripDetails?.tripId;
                const reservationRecordId = r.tripDetails?.recordId;
                
                // Extraer ID base del segmento (antes del guión bajo si existe)
                const segmentBaseId = segment.tripId.toString().split('_')[0];
                
                const matches = reservationTripId === segment.tripId || 
                       reservationRecordId === segment.tripId ||
                       reservationTripId === segmentBaseId ||
                       reservationRecordId === segmentBaseId ||
                       reservationTripId === id ||
                       reservationRecordId === id;
                
                if (shouldLog) {
                  console.log(`[PATCH ${id}] Seg${index} (${segment.tripId}): Reserva ${r.id} - tripId:${reservationTripId}, recordId:${reservationRecordId}, segmentBaseId:${segmentBaseId}, matches:${matches}`);
                }
                
                return matches;
              });
              
              const occupiedSeats = segmentReservations.reduce((sum, r) => {
                // CORRECCIÓN CRÍTICA: Usar el campo correcto según la estructura de datos
                const reservedSeats = r.tripDetails?.seats || r.tripDetails?.seatCount || r.tripDetails?.passengersData?.length || 0;
                console.log(`[PATCH ${id}] 📋 Reserva ${r.id} en segmento ${segment.tripId}: ${reservedSeats} asientos (status: ${r.status}, seats: ${r.tripDetails?.seats}, seatCount: ${r.tripDetails?.seatCount}, passengers: ${r.tripDetails?.passengersData?.length || 0})`);
                return sum + reservedSeats;
              }, 0);
              
              const availableSeats = newCapacity - occupiedSeats;
              
              // VALIDACIÓN DE INTEGRIDAD: Verificar que el cálculo sea válido
              if (availableSeats < 0) {
                console.warn(`⚠️  ADVERTENCIA: Segmento ${segment.tripId} tendría asientos negativos (${availableSeats}). Ocupados: ${occupiedSeats}, Capacidad: ${newCapacity}`);
              }
              if (occupiedSeats > newCapacity) {
                console.warn(`⚠️  ADVERTENCIA: Segmento ${segment.tripId} tiene más asientos ocupados (${occupiedSeats}) que capacidad (${newCapacity})`);
              }
              
              console.log(`📍 Segmento ${segment.tripId}: ${occupiedSeats} ocupados, ${availableSeats} disponibles (capacidad: ${newCapacity})`);
              
              return {
                ...segment,
                capacity: newCapacity,
                availableSeats: Math.max(0, Math.min(availableSeats, newCapacity)) // Asegurar que availableSeats esté en rango válido
              };
            });
            
            updateData.tripData = updatedTripData;
            console.log(`Trip data actualizado con nueva capacidad y disponibilidad recalculada`);
          }
        } else {
          console.log(`⚠️  CAPACIDAD NO CAMBIÓ: ${currentTrip.capacity} (no se actualizará availableSeats)`);
        }
      }
      
      // Procesar visibility (si está presente)
      if (req.body.visibility !== undefined) {
        console.log(`Actualizando visibilidad a ${req.body.visibility} para viaje ${id}`);
        updateData.visibility = req.body.visibility;
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
      
      // Limpiar caché de viajes si se actualizó la capacidad
      if (req.body.capacity !== undefined) {
        console.log(`Limpiando caché de viajes después de actualizar capacidad del viaje ${id}`);
        serverTripCache.invalidateAll();
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
      const reservations = await storage.getReservations({ companyId: "bamo-350045" });
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
      
      // OPTIMIZACIÓN: Filtrar por fecha específica si se proporciona
      if (req.query.date) {
        dateFilter = req.query.date as string;
        console.log(`[GET /reservations] Filtrando por fecha especificada: ${dateFilter}`);
      } else {
        // Sin filtro por defecto - esto permite incluir reservaciones de viajes que cruzan medianoche
        console.log(`[GET /reservations] Sin filtro de fecha - incluir reservaciones de viajes que cruzan medianoche`);
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
      
      // Use the OPTIMIZED DatabaseStorage method with tripDetails JSON support
      console.log(`[GET /reservations] Using OPTIMIZED DatabaseStorage with tripDetails JSON support`);
      
      try {
        // Get reservations using the OPTIMIZED storage method
        const reservations = await storage.getReservations({
          companyId: companyId,
          currentUserId: user.id,
          userRole: user.role
        });
        
        // Apply additional filtering if needed
        let filteredReservations = reservations;
        
        // Filter by date if provided (group by recordId and use parent trip date)
        if (dateFilter) {
          console.log(`[GET /reservations] Filtering by date with recordId grouping: ${dateFilter}`);
          
          // Agrupar reservaciones por recordId y determinar fecha del viaje padre
          const recordIdGroups = new Map<string, { reservations: any[], parentTripDate: string | null }>();
          
          // Primer paso: agrupar por recordId y obtener fecha del viaje padre
          for (const reservation of reservations) {
            const tripDetails = reservation.tripDetails;
            if (tripDetails && typeof tripDetails === 'object' && tripDetails.recordId) {
              // IMPORTANTE: Usar solo el recordId base, sin sufijos como _122
              let recordId = tripDetails.recordId.toString();
              // Si el recordId contiene un guión bajo, tomar solo la parte antes del guión
              if (recordId.includes('_')) {
                recordId = recordId.split('_')[0];
                console.log(`[GET /reservations] Normalizando recordId de ${tripDetails.recordId} a ${recordId}`);
              }
              
              if (!recordIdGroups.has(recordId)) {
                // Buscar el viaje padre en la base de datos al crear el grupo
                const parentTripId = parseInt(recordId);
                let parentTripDate: string | null = null;
                
                try {
                  const parentTrip = await storage.getTrip(parentTripId);
                  if (parentTrip && parentTrip.tripData && parentTrip.tripData.length > 0) {
                    parentTripDate = parentTrip.tripData[0].departureDate;
                    console.log(`[GET /reservations] Fecha del viaje padre para recordId ${recordId}: ${parentTripDate}`);
                  } else {
                    // Fallback: usar la fecha de la primera reservación
                    parentTripDate = reservation.trip?.departureDate || null;
                    console.log(`[GET /reservations] Usando fecha fallback para recordId ${recordId}: ${parentTripDate}`);
                  }
                } catch (error) {
                  console.error(`[GET /reservations] Error obteniendo viaje padre ${recordId}:`, error);
                  parentTripDate = reservation.trip?.departureDate || null;
                }
                
                recordIdGroups.set(recordId, {
                  reservations: [],
                  parentTripDate: parentTripDate
                });
              }
              
              const group = recordIdGroups.get(recordId)!;
              group.reservations.push(reservation);
            }
          }
          
          // Segundo paso: filtrar grupos por fecha del viaje padre
          const targetDate = new Date(dateFilter);
          filteredReservations = [];
          
          recordIdGroups.forEach((group, recordId) => {
            if (group.parentTripDate) {
              const parentDate = new Date(group.parentTripDate);
              const matchesDate = parentDate.toDateString() === targetDate.toDateString();
              
              if (matchesDate) {
                console.log(`[GET /reservations] ✅ Incluir grupo recordId ${recordId} con fecha padre ${group.parentTripDate} (${group.reservations.length} reservaciones)`);
                filteredReservations.push(...group.reservations);
              } else {
                console.log(`[GET /reservations] ❌ Excluir grupo recordId ${recordId} - fecha padre ${group.parentTripDate} no coincide con ${dateFilter}`);
              }
            } else {
              console.log(`[GET /reservations] ⚠️ Grupo recordId ${recordId} sin fecha padre válida`);
            }
          });
          
          console.log(`[GET /reservations] Resultado: ${filteredReservations.length} reservaciones total para fecha ${dateFilter}`);
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
        const reservations = await storage.getReservations(companyId, user.id, user.role);
        
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

  // Endpoint para buscar reservaciones por código
  app.get(apiRouter("/reservations/search/:code"), async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      const { user } = req as any;
      
      console.log(`[GET /reservations/search/${code}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Verificar permisos para transferencia de pasajeros
      const allowedRoles = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.SUPER_ADMIN];
      if (!allowedRoles.includes(user.role as UserRole)) {
        return res.status(403).json({ error: "No tienes permisos para transferir pasajeros" });
      }
      
      // Buscar reservación por código o ID
      console.log(`[GET /reservations/search] Buscando reservación con código: ${code}`);
      console.log(`[GET /reservations/search] Usuario: ${user.firstName} ${user.lastName}, CompanyId: ${user.companyId}`);
      
      try {
        let reservations = [];
        
        // Limpiar el código de entrada (remover prefijos como "RES")
        let cleanCode = code.toUpperCase().replace(/^RES/i, '').trim();
        console.log(`[GET /reservations/search] Código limpio: ${cleanCode}`);
        
        // Primero intentar buscar por ID numérico (sin filtro de compañía para debug)
        const numericId = parseInt(cleanCode, 10);
        if (!isNaN(numericId)) {
          console.log(`[GET /reservations/search] Buscando por ID numérico: ${numericId}`);
          
          // Búsqueda sin filtro para debug
          const allReservations = await db
            .select()
            .from(schema.reservations)
            .where(eq(schema.reservations.id, numericId));
          
          console.log(`[GET /reservations/search] Sin filtro - Resultados encontrados: ${allReservations.length}`);
          if (allReservations.length > 0) {
            console.log(`[GET /reservations/search] Sin filtro - Reservación: ID=${allReservations[0].id}, CompanyId=${allReservations[0].companyId}`);
          }
          
          // Búsqueda con filtro de compañía
          reservations = await db
            .select()
            .from(schema.reservations)
            .where(
              and(
                eq(schema.reservations.id, numericId),
                eq(schema.reservations.companyId, user.companyId)
              )
            );
          console.log(`[GET /reservations/search] Con filtro companyId=${user.companyId} - Resultados: ${reservations.length}`);
          if (reservations.length > 0) {
            console.log(`[GET /reservations/search] Con filtro - Reservación: ID=${reservations[0].id}, CompanyId=${reservations[0].companyId}`);
          }
        }
        
        // Si no se encuentra por ID y el código original contiene letras, buscar en el campo notes o email
        if (reservations.length === 0 && /[a-zA-Z]/.test(code)) {
          console.log(`[GET /reservations/search] Buscando en campos de texto: ${code}`);
          reservations = await db
            .select()
            .from(schema.reservations)
            .where(
              and(
                or(
                  like(schema.reservations.email, `%${code}%`),
                  like(schema.reservations.notes, `%${code}%`)
                ),
                eq(schema.reservations.companyId, user.companyId)
              )
            );
        }
        
        if (reservations.length === 0) {
          return res.status(404).json({ error: "No se encontró una reservación con ese código" });
        }
        
        const reservation = reservations[0];
        console.log(`[GET /reservations/search] Procesando reservación encontrada: ID=${reservation.id}`);
        
        // Obtener información del viaje desde tripDetails
        const tripDetails = reservation.tripDetails as any;
        console.log(`[GET /reservations/search] TripDetails:`, tripDetails);
        
        if (!tripDetails || (!tripDetails.recordId && !tripDetails.tripId)) {
          return res.status(404).json({ error: "No se encontró información del viaje en la reservación" });
        }
        
        // Usar recordId o tripId como fallback
        const tripIdentifier = tripDetails.recordId || tripDetails.tripId;
        console.log(`[GET /reservations/search] Buscando viaje con ID: ${tripIdentifier}`);
        
        // Manejar tanto viajes principales como sub-viajes
        let trip = null;
        let actualTripId = tripIdentifier;
        
        // Si es un sub-viaje (formato: tripId_segmentIndex), extraer el ID principal
        if (tripIdentifier.toString().includes('_')) {
          const [mainTripId, segmentIndex] = tripIdentifier.toString().split('_');
          actualTripId = parseInt(mainTripId);
          const segmentIdx = parseInt(segmentIndex);
          console.log(`[GET /reservations/search] Sub-viaje detectado: ${tripIdentifier} -> viaje principal: ${actualTripId}, índice segmento: ${segmentIdx}`);
          
          // Buscar el viaje principal
          const mainTrip = await storage.getTripWithRouteInfo(actualTripId);
          if (!mainTrip) {
            console.log(`[GET /reservations/search] No se encontró viaje principal con ID: ${actualTripId}`);
            return res.status(404).json({ error: "No se encontró información del viaje principal" });
          }
          
          // Verificar que el índice del segmento existe en el trip_data
          const tripData = mainTrip.tripData || [];
          if (!Array.isArray(tripData) || segmentIdx >= tripData.length || segmentIdx < 0) {
            console.log(`[GET /reservations/search] Segmento no encontrado: índice ${segmentIdx}, total segmentos: ${tripData.length}`);
            return res.status(404).json({ error: "Segmento de viaje no encontrado" });
          }
          
          const segmentData = tripData[segmentIdx];
          console.log(`[GET /reservations/search] ✅ Segmento encontrado: ${JSON.stringify(segmentData)}`);
          
          // Crear objeto de viaje con información del segmento específico
          trip = {
            ...mainTrip,
            id: tripIdentifier, // Mantener el ID completo del sub-viaje
            origin: segmentData.origin,
            destination: segmentData.destination,
            departureTime: segmentData.departureTime,
            arrivalTime: segmentData.arrivalTime,
            departureDate: segmentData.departureDate, // ¡Agregar la fecha!
            price: segmentData.price,
            availableSeats: segmentData.availableSeats,
            capacity: segmentData.capacity,
            isSubTrip: true,
            segmentOrigin: segmentData.origin,
            segmentDestination: segmentData.destination,
            segmentIndex: segmentIdx
          };
        } else {
          // Es un viaje principal normal
          trip = await storage.getTripWithRouteInfo(tripIdentifier);
          if (!trip) {
            console.log(`[GET /reservations/search] No se encontró viaje con ID: ${tripIdentifier}`);
            return res.status(404).json({ error: "No se encontró información del viaje" });
          }
        }
        
        // Obtener pasajeros de la reservación
        const passengers = await storage.getPassengers(reservation.id);
        console.log(`[GET /reservations/search] Obtenidos ${passengers.length} pasajeros`);
        
        // Obtener nombres de usuarios para mostrar en lugar de IDs
        const userNames = {};
        const userIds = [reservation.createdBy, reservation.paidBy, reservation.checkedBy].filter(Boolean);
        
        for (const userId of userIds) {
          try {
            const user = await storage.getUserById(userId);
            if (user) {
              userNames[userId] = `${user.firstName} ${user.lastName}`;
            }
          } catch (error) {
            console.log(`[GET /reservations/search] No se pudo obtener usuario ${userId}:`, error);
          }
        }
        
        const result = {
          reservation: {
            ...reservation,
            passengers
          },
          trip,
          userNames // Agregar nombres de usuarios
        };
        
        console.log(`[GET /reservations/search] ✅ Reservación procesada exitosamente`);
        res.json(result);
        
      } catch (error) {
        console.error(`[GET /reservations/search] Error en base de datos:`, error);
        return res.status(500).json({ error: "Error al buscar la reservación" });
      }
      
    } catch (error: any) {
      console.error(`[GET /reservations/search] Error:`, error);
      res.status(500).json({ error: "Error al buscar reservación" });
    }
  });

  // Endpoint para transferir pasajeros
  app.post(apiRouter("/reservations/transfer"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Verificar permisos
      const allowedRoles = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, 'superAdmin'];
      if (!allowedRoles.includes(user.role as UserRole)) {
        return res.status(403).json({ error: "No tienes permisos para transferir pasajeros" });
      }

      const { reservationId, newTripId, origin, destination } = req.body;

      if (!reservationId || !newTripId) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }

      // Convertir newTripId a string para manejar tanto números como strings
      const newTripIdStr = String(newTripId);

      console.log(`[POST /reservations/transfer] Usuario: ${user.firstName} ${user.lastName}`);
      console.log(`[POST /reservations/transfer] Transfiriendo reservación ${reservationId} al viaje ${newTripIdStr}`);

      // Obtener la reservación actual
      const reservation = await db
        .select()
        .from(schema.reservations)
        .where(
          and(
            eq(schema.reservations.id, reservationId),
            eq(schema.reservations.companyId, user.companyId)
          )
        )
        .limit(1);

      if (reservation.length === 0) {
        return res.status(404).json({ error: "Reservación no encontrada" });
      }

      const currentReservation = reservation[0];
      const currentTripDetails = currentReservation.tripDetails as any;

      // Verificar que el nuevo viaje existe (manejar tanto viajes principales como sub-viajes)
      let newTrip = null;
      let actualTripId = newTripId;
      
      // Si es un sub-viaje (formato: tripId_segmentIndex), extraer el ID principal
      if (newTripIdStr.includes('_')) {
        const [mainTripId, segmentIndex] = newTripIdStr.split('_');
        actualTripId = parseInt(mainTripId);
        const segmentIdx = parseInt(segmentIndex);
        console.log(`[POST /reservations/transfer] Sub-viaje detectado: ${newTripIdStr} -> viaje principal: ${actualTripId}, índice segmento: ${segmentIdx}`);
        
        // Buscar el viaje principal
        newTrip = await storage.getTripWithRouteInfo(actualTripId);
        if (!newTrip) {
          return res.status(404).json({ error: "Viaje principal no encontrado" });
        }
        
        // Verificar que el índice del segmento existe en el trip_data
        const tripData = newTrip.tripData || [];
        if (!Array.isArray(tripData) || segmentIdx >= tripData.length || segmentIdx < 0) {
          console.log(`[POST /reservations/transfer] Segmento no encontrado: índice ${segmentIdx}, total segmentos: ${tripData.length}`);
          return res.status(404).json({ error: "Segmento de viaje no encontrado" });
        }
        
        console.log(`[POST /reservations/transfer] ✅ Segmento encontrado: ${JSON.stringify(tripData[segmentIdx])}`);
      } else {
        // Es un viaje principal normal
        newTrip = await storage.getTripWithRouteInfo(parseInt(newTripIdStr));
        if (!newTrip) {
          return res.status(404).json({ error: "Viaje destino no encontrado" });
        }
      }

      const oldTripId = currentTripDetails.recordId || currentTripDetails.tripId;
      const seatsToTransfer = currentTripDetails.seats || 1;

      // Actualizar la reservación con el nuevo viaje
      const newTripDetails = {
        ...currentTripDetails,
        recordId: newTripIdStr,
        tripId: newTripIdStr,
        origin: origin || currentTripDetails.origin,
        destination: destination || currentTripDetails.destination
      };

      await db
        .update(schema.reservations)
        .set({
          tripDetails: newTripDetails,
          updatedAt: new Date()
        })
        .where(eq(schema.reservations.id, reservationId));

      // Obtener el ID del viaje anterior (puede ser principal o sub-viaje)
      let oldActualTripId = oldTripId;
      if (oldTripId.toString().includes('_')) {
        const [mainTripId] = oldTripId.toString().split('_');
        oldActualTripId = parseInt(mainTripId);
      }

      // Recalcular asientos para ambos viajes (solo si son diferentes)
      if (oldActualTripId !== actualTripId) {
        console.log(`[POST /reservations/transfer] Recalculando asientos para viajes ${oldActualTripId} y ${actualTripId}`);
        
        // Liberar asientos del viaje origen (sumar asientos)
        await storage.updateRelatedTripsAvailability(oldActualTripId, oldActualTripId.toString(), seatsToTransfer);
        console.log(`[POST /reservations/transfer] ✅ Liberados ${seatsToTransfer} asientos en viaje ${oldActualTripId}`);
        
        // Ocupar asientos en el viaje destino (restar asientos)  
        await storage.updateRelatedTripsAvailability(actualTripId, actualTripId.toString(), -seatsToTransfer);
        console.log(`[POST /reservations/transfer] ✅ Ocupados ${seatsToTransfer} asientos en viaje ${actualTripId}`);
        
        // Obtener los viajes actualizados para verificar los asientos
        const oldTripUpdated = await storage.getTripWithRouteInfo(oldTripId);
        const newTripUpdated = await storage.getTripWithRouteInfo(newTripId);
        
        console.log(`[POST /reservations/transfer] Viaje origen ${oldTripId}: ${oldTripUpdated ? 'encontrado' : 'no encontrado'}`);
        console.log(`[POST /reservations/transfer] Viaje destino ${newTripId}: ${newTripUpdated ? 'encontrado' : 'no encontrado'}`);
      }

      console.log(`[POST /reservations/transfer] ✅ Transferencia completada de viaje ${oldTripId} a ${newTripId}`);
      res.json({ 
        success: true, 
        message: "Pasajero transferido exitosamente",
        oldTripId: oldTripId,
        newTripId: newTripId,
        seatsTransferred: seatsToTransfer
      });

    } catch (error: any) {
      console.error(`[POST /reservations/transfer] Error:`, error);
      res.status(500).json({ error: "Error al transferir pasajero" });
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
      
      // Extraer el recordId numérico del tripDetails.recordId (puede ser "84_118" o 84)
      let numericRecordId: number;
      
      if (typeof reservationData.tripDetails.recordId === 'string') {
        if (reservationData.tripDetails.recordId.includes('_')) {
          numericRecordId = parseInt(reservationData.tripDetails.recordId.split('_')[0]);
        } else {
          numericRecordId = parseInt(reservationData.tripDetails.recordId);
        }
      } else {
        numericRecordId = reservationData.tripDetails.recordId;
      }
      
      console.log(`[POST /reservations] RecordId extraído: ${numericRecordId} (original: ${reservationData.tripDetails.recordId})`);
      
      // Get the trip using recordId from tripDetails
      const trip = await storage.getTrip(numericRecordId);
      
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
        const { tripId } = reservationData.tripDetails;
        console.log(`[POST /reservations] Actualizando registro ${numericRecordId}, segmento ${tripId} y viajes relacionados con cambio de -${passengerCount} asientos`);
        
        await storage.updateRelatedTripsAvailability(numericRecordId, tripId, -passengerCount);
        console.log(`[POST /reservations] Asientos actualizados exitosamente para el registro ${numericRecordId}, segmento ${tripId}`);
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
          const { tripId } = reservationData.tripDetails;
          console.log(`[POST /reservations] DEPURACIÓN - Obteniendo información para recordId=${numericRecordId}, tripId=${tripId}`);
          
          // Obtener la información específica del segmento del viaje
          const tripWithRouteInfo = await storage.getTripWithRouteInfo(numericRecordId);
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
              const { recordId: rawRecordId, tripId } = originalReservation.tripDetails as { recordId: number | string, tripId: string };
              
              // Extraer el recordId numérico si es string (formato "85_118" -> 85)
              let recordId: number | undefined;
              if (rawRecordId) {
                if (typeof rawRecordId === 'string') {
                  if (rawRecordId.includes('_')) {
                    recordId = parseInt(rawRecordId.split('_')[0]);
                  } else {
                    recordId = parseInt(rawRecordId);
                  }
                } else {
                  recordId = rawRecordId;
                }
              }
              
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
      
      // Manejar cambios en la cantidad de asientos
      if (reservationData.tripDetails) {
        console.log(`[PUT /reservations/${id}] Detectado cambio en tripDetails, procesando actualización de asientos`);
        
        // Obtener la reservación original
        const originalReservation = await storage.getReservation(id);
        if (originalReservation) {
          const originalTripDetails = originalReservation.tripDetails as any;
          const newTripDetails = reservationData.tripDetails as any;
          
          const originalSeats = originalTripDetails?.seats || 1;
          const newSeats = newTripDetails?.seats || 1;
          
          if (originalSeats !== newSeats) {
            console.log(`[PUT /reservations/${id}] Cambio de asientos: ${originalSeats} → ${newSeats}`);
            
            // Extraer información del viaje
            const recordId = typeof newTripDetails.recordId === 'string' 
              ? parseInt(newTripDetails.recordId.split('_')[0]) 
              : newTripDetails.recordId;
            
            console.log(`[PUT /reservations/${id}] RecordId extraído: ${recordId} (tipo: ${typeof recordId})`);
            
            if (recordId && !isNaN(recordId) && recordId > 0) {
              // Obtener el viaje
              const trip = await storage.getTrip(recordId);
              if (trip) {
                const tripDataAny = trip.tripData as any;
                const currentAvailableSeats = tripDataAny?.availableSeats || trip.capacity;
                
                console.log(`[PUT /reservations/${id}] Viaje encontrado - capacidad: ${trip.capacity}, disponibles: ${currentAvailableSeats}`);
                
                // Calcular la diferencia de asientos
                const seatDifference = newSeats - originalSeats;
                
                console.log(`[PUT /reservations/${id}] Cambio de asientos: ${originalSeats} → ${newSeats} (diferencia: ${seatDifference})`);
                console.log(`[PUT /reservations/${id}] Disponibilidad actual: ${currentAvailableSeats}, se necesitan ${seatDifference} asientos adicionales`);
                
                // Calcular nueva disponibilidad de asientos
                const newAvailableSeats = currentAvailableSeats - seatDifference;
                
                // Verificar que no se excedan los límites
                if (newAvailableSeats < 0) {
                  return res.status(400).json({ 
                    error: "No hay suficientes asientos disponibles para este cambio",
                    details: `Asientos disponibles: ${currentAvailableSeats}, asientos adicionales solicitados: ${seatDifference}`,
                    currentCapacity: trip.capacity,
                    availableSeats: currentAvailableSeats
                  });
                }
                
                if (newAvailableSeats > trip.capacity) {
                  return res.status(400).json({ 
                    error: "La reducción de asientos excedería la capacidad del viaje",
                    details: `Capacidad máxima: ${trip.capacity}, disponibilidad resultante: ${newAvailableSeats}`
                  });
                }
                
                // Actualizar el trip_data con la nueva disponibilidad
                // Para viajes, necesito actualizar availableSeats en cada segmento del tripData array
                const updatedTripData = Array.isArray(tripDataAny) 
                  ? tripDataAny.map(segment => ({
                      ...segment,
                      availableSeats: newAvailableSeats
                    }))
                  : {
                      ...tripDataAny,
                      availableSeats: newAvailableSeats
                    };
                
                console.log(`[PUT /reservations/${id}] Actualizando availableSeats en trip_data: ${currentAvailableSeats} → ${newAvailableSeats}`);
                
                try {
                  await storage.updateTrip(recordId, { tripData: updatedTripData });
                  console.log(`[PUT /reservations/${id}] Viaje ${recordId} actualizado exitosamente`);
                } catch (updateError) {
                  console.error(`[PUT /reservations/${id}] Error al actualizar viaje ${recordId}:`, updateError);
                  throw updateError;
                }
                
                console.log(`[PUT /reservations/${id}] Validación exitosa - el cambio de asientos es permitido`);
              } else {
                console.warn(`[PUT /reservations/${id}] No se encontró el viaje ${recordId} para actualizar asientos`);
              }
            }
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
      const { recordId: rawRecordId, tripId } = reservation.tripDetails as { recordId: number | string, tripId: string };
      
      if (!rawRecordId || !tripId) {
        return res.status(400).json({ error: "Invalid trip details in reservation" });
      }
      
      // Extraer el recordId numérico si es string (formato "85_118" -> 85)
      let recordId: number;
      if (typeof rawRecordId === 'string') {
        if (rawRecordId.includes('_')) {
          recordId = parseInt(rawRecordId.split('_')[0]);
        } else {
          recordId = parseInt(rawRecordId);
        }
      } else {
        recordId = rawRecordId;
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
      const { forceRefund } = req.body; // Parámetro para forzar reembolso

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

      // Verificar si hay transacciones que no fueron creadas por el usuario actual
      // Solo realizar esta validación si no se ha forzado el reembolso
      if (!forceRefund) {
        const transactionsFromOtherUsers = refundableTransactions.filter(t => t.user_id !== user.id);
        
        if (transactionsFromOtherUsers.length > 0) {
          // Obtener información de los usuarios que crearon las transacciones
          const userIds = [...new Set(transactionsFromOtherUsers.map(t => t.user_id))];
          const transactionCreators = await storage.getUsersByIds(userIds);
          
          const creatorNames = transactionCreators.map(u => `${u.firstName} ${u.lastName}`).join(', ');
          
          return res.status(409).json({
            error: "cross_user_refund",
            message: `Algunas transacciones de esta reservación fueron creadas por otros usuarios: ${creatorNames}. ¿Desea continuar con el reembolso?`,
            details: {
              totalTransactions: refundableTransactions.length,
              transactionsFromOtherUsers: transactionsFromOtherUsers.length,
              creatorNames: creatorNames
            }
          });
        }
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

      // Crear transacciones de reembolso en negativo (en lugar de eliminar)
      let totalRefundAmount = 0;
      let refundTransactionsCreated = 0;

      for (const transaction of refundableTransactions) {
        try {
          const transactionDetails = transaction.details as any;
          const transactionAmount = transactionDetails?.details?.monto || 0;
          
          // Crear una nueva transacción de reembolso con monto negativo
          const refundTransactionData = {
            type: 'reservation_refund',
            details: {
              ...transactionDetails.details,
              monto: -transactionAmount, // Monto negativo para el reembolso
              notas: `Reembolso - Reservación #${id} cancelada`,
              originalTransactionId: transaction.id,
              refundDate: new Date().toISOString(),
              refundedBy: user.id
            }
          };

          // Crear la transacción de reembolso
          const refundTransaction = await storage.createTransaccion({
            details: refundTransactionData,
            user_id: user.id, // Usuario que ejecuta el reembolso
            company_id: transaction.company_id, // Usar company_id de la transacción original
            created_at: new Date(),
            updated_at: new Date()
          });

          if (refundTransaction) {
            refundTransactionsCreated++;
            totalRefundAmount += transactionAmount;
            console.log(`[POST /reservations/${id}/cancel-refund] Transacción de reembolso creada: ID ${refundTransaction.id}, Monto: -${transactionAmount}`);
          } else {
            console.error(`[POST /reservations/${id}/cancel-refund] Error al crear transacción de reembolso para transacción ${transaction.id}`);
          }
        } catch (error) {
          console.error(`[POST /reservations/${id}/cancel-refund] Error al procesar transacción ${transaction.id}:`, error);
        }
      }

      if (refundTransactionsCreated === 0) {
        return res.status(500).json({ error: "Error al procesar el reembolso - no se pudo crear ninguna transacción de reembolso" });
      }

      console.log(`[POST /reservations/${id}/cancel-refund] ${refundTransactionsCreated}/${refundableTransactions.length} transacciones de reembolso creadas exitosamente. Reembolso total: ${totalRefundAmount}`);

      res.json({ 
        success: true, 
        message: "Reservación cancelada con reembolso exitosamente",
        reservation: updatedReservation,
        refundAmount: totalRefundAmount,
        refundTransactionsCreated: refundTransactionsCreated,
        originalTransactionsKept: refundableTransactions.length
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
  
  // Endpoint público para acceder a los detalles de un paquete (para escaneo de QR)
  app.get(apiRouter("/public/packages/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      console.log(`[GET /public/packages/${id}] Acceso público solicitado`);
      
      // Obtener el paquete con información del viaje usando el método optimizado
      const packageData = await storage.getPackageWithTripInfo(id);
      
      if (!packageData) {
        console.log(`[GET /public/packages/${id}] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Extraer información del viaje desde tripDetails
      let tripInfo = {};
      if (packageData.tripDetails) {
        try {
          const tripDetails = typeof packageData.tripDetails === 'string' 
            ? JSON.parse(packageData.tripDetails) 
            : packageData.tripDetails;
          
          tripInfo = {
            tripOrigin: tripDetails.origin || 'No especificado',
            tripDestination: tripDetails.destination || 'No especificado',
            tripDate: tripDetails.departureDate || '',
            tripDepartureTime: tripDetails.departureTime || '',
            tripArrivalTime: tripDetails.arrivalTime || '',
            segmentOrigin: tripDetails.origin || 'No especificado',
            segmentDestination: tripDetails.destination || 'No especificado',
            // Para asegurar que se usa la fecha del viaje como fecha de envío
            shippingDate: tripDetails.departureDate || '',
            // Incluir la hora de salida del viaje
            departureTime: tripDetails.departureTime || ''
          };
          
          console.log(`[GET /public/packages/${id}] Información del viaje extraída: ${tripInfo.tripOrigin} → ${tripInfo.tripDestination}`);
        } catch (error) {
          console.error(`[GET /public/packages/${id}] Error al parsear tripDetails:`, error);
        }
      }
      
      console.log(`[GET /public/packages/${id}] Acceso público concedido`);
      res.json({
        ...packageData,
        ...tripInfo
      });
    } catch (error) {
      console.error(`[GET /public/packages/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener el paquete" });
    }
  });
  
  // Endpoint público para marcar un paquete como pagado
  app.post(apiRouter("/public/packages/:id/mark-paid"), async (req: Request, res: Response) => {
    try {
      const packageId = parseInt(req.params.id, 10);
      console.log(`[POST /public/packages/${packageId}/mark-paid] Marcando paquete como pagado`);
      
      // Verificar que el paquete existe
      const packageData = await storage.getPackage(packageId);
      if (!packageData) {
        console.log(`[POST /public/packages/${packageId}/mark-paid] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Obtener el ID del usuario autenticado (si está disponible)
      const userId = req.user ? (req.user as any).id : null;
      console.log(`[POST /public/packages/${packageId}/mark-paid] Usuario que marca como pagado:`, userId);
      
      // Actualizar el estado de pago
      console.log(`[POST /public/packages/${packageId}/mark-paid] Estado actual de pago:`, packageData.isPaid);
      const updatedPackage = await storage.updatePackage(packageId, {
        isPaid: true,
        paymentMethod: packageData.paymentMethod || 'efectivo',
        paidBy: userId, // Guardar el ID del usuario que marca como pagado
        updatedAt: new Date()
      });
      console.log(`[POST /public/packages/${packageId}/mark-paid] Nuevo estado de pago:`, updatedPackage?.isPaid);
      
      // Extraer información del viaje desde tripDetails
      const packageTripDetails = packageData.tripDetails as any;
      let tripId = "";
      let origen = "";
      let destino = "";
      
      if (packageTripDetails) {
        tripId = packageTripDetails.tripId || "";
        origen = packageTripDetails.segmentOrigin || packageTripDetails.origin || "";
        destino = packageTripDetails.segmentDestination || packageTripDetails.destination || "";
        
        console.log(`[POST /public/packages/${packageId}/mark-paid] Información extraída de tripDetails:`, {
          tripId,
          origen,
          destino
        });
      }
      
      // Crear una transacción cuando el paquete es marcado como pagado
      if (userId && updatedPackage) {
        try {
          // Obtener el companyId del paquete
          const companyId = packageData.companyId;
          
          // Crear los detalles de la transacción en formato JSON
          const detallesTransaccion = {
            type: "package",
            details: {
              id: packageData.id,
              monto: packageData.price,
              notas: "Pago de paquetería",
              origen: origen,
              tripId: tripId,
              destino: destino,
              isSubTrip: false, // Se puede determinar desde tripId si es necesario
              metodoPago: packageData.paymentMethod || "efectivo",
              remitente: `${packageData.senderName} ${packageData.senderLastName}`,
              destinatario: `${packageData.recipientName} ${packageData.recipientLastName}`,
              descripcion: packageData.packageDescription || "",
              usaAsientos: packageData.usesSeats || false,
              asientos: packageData.seatsQuantity || 0,
              companyId: companyId, // Añadimos el ID de la compañía
              dateCreated: new Date().toISOString() // Fecha exacta de creación
            }
          };
          
          console.log(`[POST /public/packages/${packageId}/mark-paid] Creando transacción con detalles:`, 
                      JSON.stringify(detallesTransaccion, null, 2));
          
          // Crear la transacción en la base de datos
          const transaccion = await storage.createTransaccion({
            details: detallesTransaccion,
            user_id: userId,
            cutoff_id: null,
            companyId: companyId // Añadimos el ID de la compañía a la transacción
          });
          
          console.log(`[POST /public/packages/${packageId}/mark-paid] Transacción creada con ID:`, transaccion.id);
        } catch (transactionError) {
          console.error(`[POST /public/packages/${packageId}/mark-paid] Error al crear la transacción:`, transactionError);
          // Continuamos aunque haya error en la creación de la transacción, ya que el paquete ya fue marcado como pagado
        }
      }
      
      console.log(`[POST /public/packages/${packageId}/mark-paid] Paquete actualizado con éxito`);
      res.json(updatedPackage);
    } catch (error) {
      console.error(`[POST /public/packages/:id/mark-paid] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el estado de pago del paquete" });
    }
  });
  
  // Endpoint público para marcar un paquete como entregado
  app.post(apiRouter("/public/packages/:id/mark-delivered"), async (req: Request, res: Response) => {
    try {
      const packageId = parseInt(req.params.id, 10);
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Marcando paquete como entregado`);
      
      // Verificar que el paquete existe
      const packageData = await storage.getPackage(packageId);
      if (!packageData) {
        console.log(`[POST /public/packages/${packageId}/mark-delivered] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Obtener el ID del usuario autenticado (si está disponible)
      const userId = req.user ? (req.user as any).id : null;
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Usuario que marca como entregado:`, userId);
      
      // Actualizar el estado de entrega
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Estado actual de entrega:`, packageData.deliveryStatus);
      const currentDate = new Date();
      const updatedPackage = await storage.updatePackage(packageId, {
        deliveryStatus: 'entregado',
        deliveredAt: currentDate,
        deliveredBy: userId, // Guardar el ID del usuario que marca como entregado
        updatedAt: currentDate
      });
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Nuevo estado de entrega:`, updatedPackage?.deliveryStatus);
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Fecha de entrega:`, updatedPackage?.deliveredAt);
      
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Paquete actualizado con éxito`);
      res.json(updatedPackage);
    } catch (error) {
      console.error(`[POST /public/packages/:id/mark-delivered] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el estado de entrega del paquete" });
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
        console.log('[WebSocket] Mensaje recibido:', data);
        
        // Si el mensaje incluye una autenticación de usuario, almacenar la conexión
        if (data.type === 'auth' && data.userId) {
          const userId = data.userId.toString();
          clients.set(userId, ws);
          console.log(`[WebSocket] Usuario ${userId} autenticado`);
          
          // Confirmar autenticación al cliente
          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            message: 'Autenticación exitosa' 
          }));
        }
      } catch (error) {
        console.error('[WebSocket] Error al procesar mensaje:', error);
      }
    });
    
    // Manejar cierre de conexión
    ws.on('close', () => {
      console.log('[WebSocket] Conexión cerrada');
      
      // Eliminar la conexión del registro
      clients.forEach((client, userId) => {
        if (client === ws) {
          clients.delete(userId);
          console.log(`[WebSocket] Usuario ${userId} desconectado`);
        }
      });
    });
  });
  
  // Función para obtener usuarios por empresa y roles
  const getUsersByCompanyAndRoles = async (companyId: string, roles: string[]): Promise<any[]> => {
    try {
      const users = await storage.getAllUsers();
      const filteredUsers = users.filter(user => 
        user.companyId === companyId && 
        roles.includes(user.role)
      );
      console.log(`[getUsersByCompanyAndRoles] Encontrados ${filteredUsers.length} usuarios para la empresa ${companyId} con roles ${roles.join(', ')}`);
      return filteredUsers;
    } catch (error) {
      console.error('[getUsersByCompanyAndRoles] Error al obtener usuarios:', error);
      return [];
    }
  };
  
  // Función para enviar notificaciones a través de WebSocket
  const sendNotificationToUsers = (userIds: number[], notification: any) => {
    console.log(`[WebSocket] Intentando enviar notificación a ${userIds.length} usuarios: ${userIds.join(', ')}`);
    
    // Verificar clientes conectados
    console.log(`[WebSocket] Total de clientes conectados: ${clients.size}`);
    clients.forEach((_, key) => {
      console.log(`[WebSocket] Cliente conectado: ID=${key}`);
    });
    
    let sentCount = 0;
    
    for (const userId of userIds) {
      const userIdStr = userId.toString();
      const client = clients.get(userIdStr);
      
      if (client) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            // Asegurarse de que la notificación tenga todos los campos necesarios
            const enhancedNotification = {
              ...notification,
              id: notification.id || Date.now(),
              title: notification.title || 'Nueva notificación',
              message: notification.message || 'Has recibido una nueva notificación',
              type: notification.type || 'default',
              createdAt: notification.createdAt || new Date().toISOString(),
              updatedAt: notification.updatedAt || new Date().toISOString()
            };
            
            // Formato del mensaje para el cliente
            const message = JSON.stringify({
              type: 'notification',
              data: enhancedNotification
            });
            
            // Enviar notificación
            client.send(message);
            console.log(`[WebSocket] Notificación enviada al usuario ${userIdStr}:`, JSON.stringify(enhancedNotification));
            sentCount++;
          } catch (error) {
            console.error(`[WebSocket] Error al enviar notificación al usuario ${userIdStr}:`, error);
          }
        } else {
          console.log(`[WebSocket] Usuario ${userIdStr} tiene conexión pero no está abierta. Estado: ${client.readyState}`);
        }
      } else {
        console.log(`[WebSocket] Usuario ${userIdStr} no está conectado actualmente`);
      }
    }
    
    console.log(`[WebSocket] Resumen: ${sentCount}/${userIds.length} notificaciones enviadas exitosamente`);
    
    // Si no se enviaron notificaciones, intentamos guardarlas para cuando los usuarios se conecten
    if (sentCount === 0) {
      console.log('[WebSocket] Ninguna notificación enviada en tiempo real. Las notificaciones deberán ser recuperadas por API.');
    }
  };
  
  // Endpoint para obtener reservaciones creadas por comisionistas
  app.get(apiRouter("/commissions/reservations"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      const requestedUserId = req.query.userId as string;
      const filterDate = req.query.date as string; // Nuevo parámetro para filtrar por fecha
      const viewAll = req.query.viewAll === 'true'; // Nuevo parámetro para ver todas las comisiones
      
      console.log(`[GET /commissions/reservations] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /commissions/reservations] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
        console.log(`[GET /commissions/reservations] userId solicitado: ${requestedUserId || 'Todos'}`);
        console.log(`[GET /commissions/reservations] Fecha filtro: ${filterDate || 'No especificada'}`);
        console.log(`[GET /commissions/reservations] Ver todas: ${viewAll ? 'Sí' : 'No'}`);
      }
      
      // SEGURIDAD: Verificar que solo los roles autorizados puedan acceder
      if (!user) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      // Validar permisos según el rol
      const isAdmin = user.role === UserRole.OWNER || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DEVELOPER;
      const isCommissioner = user.role === UserRole.COMMISSIONER;
      
      if (!isAdmin && !isCommissioner) {
        console.log(`[GET /commissions/reservations] ACCESO DENEGADO: El rol ${user.role} no tiene permiso para acceder a esta sección`);
        return res.status(403).json({ error: "Acceso denegado" });
      }
      
      // Si es comisionista, solo puede ver sus propias comisiones
      let targetUserId: number | null = null;
      if (isCommissioner) {
        targetUserId = user.id;
        console.log(`[GET /commissions/reservations] Comisionista - Filtrando por usuario: ${targetUserId}`);
      } else if (requestedUserId) {
        targetUserId = parseInt(requestedUserId);
        console.log(`[GET /commissions/reservations] Admin - Filtrando por usuario solicitado: ${targetUserId}`);
      }
      
      // SEGURIDAD: Filtrado de datos por compañía
      let companyId: string | null = null;
      
      // Aplicar filtro de compañía para todos excepto superAdmin
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        companyId = user.companyId || user.company;
        
        if (!companyId) {
          console.log(`[GET /commissions/reservations] ADVERTENCIA: Usuario sin compañía asignada`);
          // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
          return res.json([]);
        }
      }
      
      // Obtener todas las reservaciones con sus detalles
      console.log(`[GET /commissions/reservations] LLAMANDO storage.getReservations con:`, {
        companyId: companyId === null ? undefined : companyId,
        currentUserId: user.id,
        userRole: user.role
      });
      const allReservations = await storage.getReservations({
        companyId: companyId === null ? undefined : companyId,
        currentUserId: user.id,
        userRole: user.role
      });
      console.log(`[GET /commissions/reservations] RECIBIDO ${allReservations.length} reservaciones`);
      
      // DEBUG: Verificar si las reservaciones tienen commissionPaid
      if (allReservations.length > 0) {
        console.log(`[GET /commissions/reservations] MUESTRA - Primera reservación:`, {
          id: allReservations[0].id,
          commissionPaid: allReservations[0].commissionPaid,
          hasCommissionPaid: allReservations[0].hasOwnProperty('commissionPaid')
        });
      }
      
      // Filtrar solo aquellas creadas por usuarios comisionistas
      let comissionerReservations = allReservations.filter(
        reservation => reservation.createdByUser && reservation.createdByUser.role === UserRole.COMMISSIONER
      );
      
      // DEBUG: Verificar comisiones específicas antes del filtrado
      console.log(`[GET /commissions/reservations] DEBUG - Comisiones específicas (63, 65-69) en allReservations:`);
      [63, 65, 66, 67, 68, 69].forEach(id => {
        const reservation = allReservations.find(r => r.id === id);
        if (reservation) {
          console.log(`  Reservación ${id}: commissionPaid=${reservation.commissionPaid}, createdBy=${reservation.createdBy}, role=${reservation.createdByUser?.role}`);
        } else {
          console.log(`  Reservación ${id}: NO ENCONTRADA`);
        }
      });
      
      // Si se especifica un usuario específico, filtrar por ese usuario
      if (targetUserId) {
        comissionerReservations = comissionerReservations.filter(
          reservation => reservation.createdByUser && reservation.createdByUser.id === targetUserId
        );
        console.log(`[GET /commissions/reservations] Filtrado por usuario ${targetUserId}: ${comissionerReservations.length} reservaciones`);
      }
      
      // OPTIMIZACIÓN: Filtrar por fecha - por defecto fecha actual, personalizable o todas
      if (!viewAll) {
        const targetDate = filterDate || getCurrentLocalDate(); // Usar fecha especificada o fecha actual
        
        comissionerReservations = comissionerReservations.filter(reservation => {
          // Obtener fecha del viaje desde trip_details o trip
          let tripDate = null;
          
          try {
            // Si hay tripDetails con tripId, obtener la fecha del viaje
            if (reservation.tripDetails && reservation.tripDetails.tripId) {
              const tripId = reservation.tripDetails.tripId;
              let recordId: number;
              let tripIndex: number = 0;
              
              // Extraer recordId y index desde tripId
              if (typeof tripId === 'string' && tripId.includes('_')) {
                const [recordIdStr, indexStr] = tripId.split('_');
                recordId = parseInt(recordIdStr);
                tripIndex = parseInt(indexStr);
              } else {
                recordId = typeof tripId === 'number' ? tripId : parseInt(tripId.toString());
              }
              
              // Buscar en la lista de viajes ya obtenidos para optimizar
              const existingTrip = allReservations.find(r => 
                r.tripDetails && 
                (r.tripDetails.recordId === recordId || r.tripDetails.tripId === recordId)
              )?.trip;
              
              if (existingTrip && existingTrip.departureDate) {
                tripDate = existingTrip.departureDate;
              }
            }
            
            // Fallback: usar fecha del trip si existe
            if (!tripDate && reservation.trip && reservation.trip.departureDate) {
              tripDate = reservation.trip.departureDate;
            }
            
            // Si no hay fecha del viaje, usar fecha de creación como fallback
            if (!tripDate && reservation.createdAt) {
              tripDate = formatDateToLocal(new Date(reservation.createdAt));
            }
            
          } catch (error) {
            console.error(`[GET /commissions/reservations] Error obteniendo fecha del viaje:`, error);
            // Fallback a fecha de creación
            if (reservation.createdAt) {
              tripDate = formatDateToLocal(new Date(reservation.createdAt));
            }
          }
          
          return tripDate === targetDate;
        });
        
        console.log(`[GET /commissions/reservations] Filtrado por fecha de viaje (${targetDate}): ${comissionerReservations.length} reservaciones`);
      } else {
        console.log(`[GET /commissions/reservations] Mostrando todas las comisiones: ${comissionerReservations.length} reservaciones`);
      }
      console.log(`[GET /commissions/reservations] Encontradas ${comissionerReservations.length} reservaciones creadas por comisionistas`);
      
      // Transformar los datos para incluir origen/destino específicos y comisiones
      const transformedReservations = await Promise.all(comissionerReservations.map(async (reservation) => {
        // Obtener origen y destino específicos usando tripDetails.tripId
        let specificOrigin = reservation.trip?.route?.origin || "Origen no especificado";
        let specificDestination = reservation.trip?.route?.destination || "Destino no especificado";
        
        if (reservation.tripDetails && reservation.tripDetails.tripId) {
          const tripId = reservation.tripDetails.tripId; // formato: "recordId_index" o solo recordId
          let recordId: number;
          let tripIndex: number;
          
          // Verificar si tripId es un string con formato "recordId_index" o solo un número
          if (typeof tripId === 'string' && tripId.includes('_')) {
            // Formato: "recordId_index"
            const [recordIdStr, indexStr] = tripId.split('_');
            recordId = parseInt(recordIdStr);
            tripIndex = parseInt(indexStr);
          } else {
            // Formato: número directo (solo recordId)
            recordId = typeof tripId === 'number' ? tripId : parseInt(tripId.toString());
            tripIndex = 0; // Usar el primer segmento por defecto
          }
          
          console.log(`[GET /commissions/reservations] Procesando tripId: ${tripId}, recordId: ${recordId}, tripIndex: ${tripIndex}`);
          
          try {
            // Obtener el viaje específico usando recordId
            const tripRecord = await storage.getTrip(recordId);
            if (tripRecord && tripRecord.tripData && Array.isArray(tripRecord.tripData)) {
              const specificTrip = tripRecord.tripData[tripIndex] || tripRecord.tripData[0];
              if (specificTrip) {
                specificOrigin = specificTrip.origin || specificOrigin;
                specificDestination = specificTrip.destination || specificDestination;
                console.log(`[GET /commissions/reservations] Usando datos específicos: ${specificOrigin} → ${specificDestination}`);
              }
            }
          } catch (error) {
            console.error(`[GET /commissions/reservations] Error obteniendo datos específicos del viaje:`, error);
          }
        }
        

        // Retornar la reservación con datos modificados, preservando createdByUser completo
        const transformedReservation = {
          ...reservation,
          // Sobrescribir datos de trip con información específica
          trip: {
            ...reservation.trip,
            route: {
              ...reservation.trip?.route,
              origin: specificOrigin,
              destination: specificDestination
            }
          },
          // Asegurar que createdByUser se preserve completamente con commissionPercentage
          createdByUser: {
            ...reservation.createdByUser,
            // Preservar explícitamente el commissionPercentage si existe
            commissionPercentage: reservation.createdByUser?.commissionPercentage
          },
          // CRÍTICO: Preservar explícitamente el campo commissionPaid
          commissionPaid: reservation.commissionPaid
        };
        
        console.log(`[GET /commissions/reservations] Reservación ${reservation.id}: commissionPaid=${reservation.commissionPaid}, DB raw:`, {
          id: reservation.id,
          commissionPaid: reservation.commissionPaid,
          allKeys: Object.keys(reservation)
        });
        
        return transformedReservation;
      }));
      
      res.json(transformedReservations);
    } catch (error) {
      console.error(`[GET /commissions/reservations] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener las reservaciones de comisionistas" });
    }
  });
  

  
  // Endpoint para marcar comisiones como pagadas
  app.put(apiRouter("/commissions/pay"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /commissions/pay] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /commissions/pay] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar que solo los roles autorizados puedan acceder
      if (!user) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      // Solo los roles Dueño y Administrador pueden acceder a esta sección
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        console.log(`[PUT /commissions/pay] ACCESO DENEGADO: El rol ${user.role} no tiene permiso para marcar comisiones como pagadas`);
        return res.status(403).json({ error: "Acceso denegado" });
      }
      
      // Verificar datos en el cuerpo de la petición
      if (!req.body.reservationIds || !Array.isArray(req.body.reservationIds) || req.body.reservationIds.length === 0) {
        return res.status(400).json({ error: "Se requieren IDs de reservaciones válidos" });
      }
      
      const { reservationIds } = req.body;
      const results = [];
      
      // Actualizar cada reservación
      for (const id of reservationIds) {
        try {
          // Verificar que la reservación exista
          const reservation = await storage.getReservation(id);
          
          if (!reservation) {
            results.push({ id, success: false, message: "Reservación no encontrada" });
            continue;
          }
          
          // SEGURIDAD: Verificar que pertenece a la compañía del usuario
          if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
            const userCompanyId = user.companyId || user.company;
            if (reservation.companyId && reservation.companyId !== userCompanyId) {
              results.push({ id, success: false, message: "No tiene permisos para modificar reservaciones de otra compañía" });
              continue;
            }
          }
          
          // Actualizar el campo de comisión pagada
          const updated = await storage.updateReservation(id, { commissionPaid: true });
          
          if (updated) {
            results.push({ id, success: true, message: "Comisión marcada como pagada" });
          } else {
            results.push({ id, success: false, message: "Error al actualizar la reservación" });
          }
        } catch (error) {
          console.error(`[PUT /commissions/pay] Error al procesar la reservación ${id}: ${error}`);
          results.push({ id, success: false, message: "Error interno al procesar la reservación" });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`[PUT /commissions/pay] Actualización completada: ${successful} exitosas, ${failed} fallidas`);
      
      res.json({
        success: failed === 0,
        message: `Se han marcado ${successful} de ${reservationIds.length} comisiones como pagadas`,
        results
      });
    } catch (error) {
      console.error(`[PUT /commissions/pay] Error: ${error}`);
      res.status(500).json({ error: "Error al marcar las comisiones como pagadas" });
    }
  });
  
  // =========== RUTAS PARA SOLICITUDES DE RESERVACIÓN ===========
  
  // Crear una solicitud de reservación (para comisionistas)
  app.post(apiRouter('/reservation-requests'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo comisionistas pueden crear solicitudes de reservación
      if (currentUser.role !== UserRole.COMMISSIONER) {
        return res.status(403).json({ 
          message: "Solo los comisionistas pueden crear solicitudes de reservación" 
        });
      }
      
      // Validar datos del request (acepta tanto formato viejo como nuevo)
      const { 
        tripId, tripDetails, passengersData, passengers, totalAmount, email, phone, 
        paymentStatus, advanceAmount, advancePaymentMethod, 
        paymentMethod, notes, couponCode, discountAmount, originalAmount 
      } = req.body;
      
      // Usar passengers o passengersData según lo que venga
      const passengerData = passengers || passengersData;
      
      if (!totalAmount || !phone || !passengerData) {
        return res.status(400).json({ 
          message: "Faltan datos obligatorios para la solicitud de reservación" 
        });
      }

      // Validar que tripDetails contenga la información del viaje
      if (!tripDetails || !tripDetails.tripId || !tripDetails.recordId) {
        return res.status(400).json({ 
          message: "tripDetails es requerido y debe contener tripId y recordId" 
        });
      }
      
      // Extraer el recordId numérico si es string (formato "85_118" -> 85)
      let numericRecordId: number;
      if (typeof tripDetails.recordId === 'string') {
        if (tripDetails.recordId.includes('_')) {
          numericRecordId = parseInt(tripDetails.recordId.split('_')[0]);
        } else {
          numericRecordId = parseInt(tripDetails.recordId);
        }
      } else {
        numericRecordId = tripDetails.recordId;
      }
      
      // Verificar que el viaje exista y sea de la misma compañía que el comisionista  
      const trip = await storage.getTrip(numericRecordId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      if (trip.companyId !== currentUser.companyId) {
        console.log(`ALERTA: Intento de acceso no autorizado a viaje de otra compañía`);
        return res.status(403).json({ 
          message: "No tienes acceso a este viaje" 
        });
      }
      
      // Crear el objeto data con estructura compatible con tabla reservations
      const reservationData = {
        total_amount: totalAmount,
        email: email || null,
        phone: phone,
        notes: notes || null,
        payment_method: paymentMethod || 'efectivo',
        status: 'confirmed',
        payment_status: paymentStatus || 'pendiente',
        advance_amount: advanceAmount || 0,
        advance_payment_method: advancePaymentMethod || 'efectivo',
        created_by: currentUser.id,
        paid_by: null,
        marked_as_paid_at: null,
        commission_paid: false,
        company_id: currentUser.companyId,
        coupon_code: couponCode || null,
        discount_amount: discountAmount || 0,
        original_amount: originalAmount || null,
        trip_details: tripDetails,
        // Información de pasajeros para crear registros separados
        passengers: passengerData
      };
      
      // Crear la solicitud de reservación con nueva estructura
      const requestData = {
        data: reservationData,
        requesterId: currentUser.id,
        status: 'pendiente'
      };
      
      const request = await storage.createReservationRequest(requestData);
      
      // Crear notificaciones para administradores de la compañía
      try {
        // Obtener usuarios con roles que pueden aprobar solicitudes
        const approvalRoles = [UserRole.OWNER, UserRole.ADMIN, UserRole.TICKET_OFFICE];
        const companyUsers = await storage.getUsersByCompany(currentUser.companyId);
        const usersToNotify = companyUsers.filter(user => 
          approvalRoles.includes(user.role as any) && user.id !== currentUser.id
        );

        console.log(`[Solicitud Reservación] Notificando a ${usersToNotify.length} usuarios de roles: ${approvalRoles.join(', ')}`);

        // Obtener información del viaje para la notificación
        const tripInfo = await storage.getTripWithRouteInfo(numericRecordId);
        const tripDescription = tripInfo ? 
          `${tripInfo.route?.origin} → ${tripInfo.route?.destination}` : 
          `Viaje ID: ${tripDetails.recordId}`;

        // Crear notificaciones
        const notificationPromises = usersToNotify.map(async (user) => {
          // Calcular fecha de expiración (72 horas después)
          const expirationDate = new Date();
          expirationDate.setHours(expirationDate.getHours() + 72);

          const notificationData = {
            userId: user.id,
            type: 'reservation_request',
            title: 'Nueva solicitud de reservación',
            message: `${currentUser.firstName} ${currentUser.lastName} envió una solicitud de reservación para ${tripDescription}`,
            relatedId: request.id,
            metaData: JSON.stringify({
              requestId: request.id,
              tripId: tripDetails.recordId,
              requesterName: `${currentUser.firstName} ${currentUser.lastName}`,
              amount: totalAmount,
              passengers: passengerData?.length || 1
            }),
            read: false,
            expiresAt: expirationDate
          };

          const notification = await storage.createNotification(notificationData);
          console.log(`[Notificación] Creada para usuario ${user.id}: ${notification.id}`);
          return { userId: user.id, notification };
        });

        const createdNotifications = await Promise.all(notificationPromises);
        
        // Enviar notificaciones en tiempo real vía WebSocket
        const userIdsForWebSocket = createdNotifications.map(cn => cn.userId);
        if (userIdsForWebSocket.length > 0) {
          const notificationForWebSocket = {
            type: 'reservation_request',
            title: 'Nueva solicitud de reservación',
            message: `${currentUser.firstName} ${currentUser.lastName} envió una solicitud de reservación para ${tripDescription}`,
            relatedId: request.id
          };
          
          sendNotificationToUsers(userIdsForWebSocket, notificationForWebSocket);
          console.log(`[WebSocket] Notificación enviada a ${userIdsForWebSocket.length} usuarios`);
        }

      } catch (notificationError) {
        console.error('[Solicitud Reservación] Error al crear notificaciones:', notificationError);
        // No fallar la creación de la solicitud por errores de notificación
      }
      
      res.status(201).json({
        message: "Solicitud de reservación creada con éxito. Espera la aprobación.",
        request
      });
    } catch (error) {
      console.error("Error al crear solicitud de reservación:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener solicitudes de reservación (filtradas por compañía/estado/comisionista)
  app.get(apiRouter('/reservation-requests'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Construir filtros basados en permisos
      const filters: { companyId?: string, status?: string, requesterId?: number } = {};
      
      // Si es comisionista, solo puede ver sus propias solicitudes
      if (currentUser.role === UserRole.COMMISSIONER) {
        filters.requesterId = currentUser.id;
      } 
      // Si no es superAdmin, solo puede ver solicitudes de su compañía
      else if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.companyId) {
        filters.companyId = currentUser.companyId;
      }
      
      // Aplicar filtros adicionales de la consulta
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      
      const requests = await storage.getReservationRequests(filters);
      
      res.json(requests);
    } catch (error) {
      console.error("Error al obtener solicitudes de reservación:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener una solicitud de reservación específica
  app.get(apiRouter('/reservation-requests/:id'), isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "ID de solicitud inválido" });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Obtener la solicitud
      const request = await storage.getReservationRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }
      
      // Verificar permisos de acceso
      if (currentUser.role === UserRole.COMMISSIONER && request.requesterId !== currentUser.id) {
        return res.status(403).json({ 
          message: "No tienes permiso para ver esta solicitud" 
        });
      }
      
      if (currentUser.role !== UserRole.SUPER_ADMIN && 
          currentUser.role !== UserRole.COMMISSIONER && 
          request.companyId !== currentUser.companyId) {
        return res.status(403).json({ 
          message: "No tienes permiso para ver esta solicitud" 
        });
      }
      
      res.json(request);
    } catch (error) {
      console.error(`Error al obtener solicitud de reservación ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });

  // Obtener reservaciones de un comisionista específico
  app.get(apiRouter('/commissioners/:id/reservations'), isAuthenticated, async (req, res) => {
    try {
      const commissionerId = parseInt(req.params.id);
      if (isNaN(commissionerId)) {
        return res.status(400).json({ message: "ID de comisionista inválido" });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Verificar permisos: solo el propio comisionista puede ver sus reservaciones
      if (currentUser.role === UserRole.COMMISSIONER && currentUser.id !== commissionerId) {
        return res.status(403).json({ 
          message: "No tienes permiso para ver estas reservaciones" 
        });
      }
      
      // Obtener reservaciones donde created_by es igual al ID del comisionista
      const reservations = await storage.getReservations({ 
        companyId: currentUser.companyId,
        createdBy: commissionerId
      });
      
      console.log(`[/commissioners/${commissionerId}/reservations] Encontradas ${reservations.length} reservaciones`);
      
      res.json(reservations);
    } catch (error) {
      console.error(`Error al obtener reservaciones del comisionista ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Aprobar o rechazar una solicitud de reservación
  app.post(apiRouter('/reservation-requests/:id/update-status'), isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "ID de solicitud inválido" });
      }
      
      const { status, reviewNotes } = req.body;
      if (!status || !['aprobada', 'rechazada'].includes(status)) {
        return res.status(400).json({ 
          message: "Estado inválido. Debe ser 'aprobada' o 'rechazada'" 
        });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Verificar que el usuario tenga permisos para aprobar/rechazar
      const canApprove = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER].includes(currentUser.role);
      if (!canApprove) {
        return res.status(403).json({ 
          message: "No tienes permisos para aprobar o rechazar solicitudes" 
        });
      }
      
      // Obtener la solicitud para verificar que pertenezca a la misma compañía
      const request = await storage.getReservationRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }
      
      // Extraer companyId del JSON de la solicitud
      const requestData = request.data as any;
      const requestCompanyId = requestData?.company_id;
      
      // Obtener companyId del usuario (puede estar en companyId o company)
      const userCompanyId = currentUser.companyId || currentUser.company;
      
      console.log(`[DEBUG] Validación de permisos:`);
      console.log(`  - Usuario ID: ${currentUser.id}, Rol: ${currentUser.role}`);
      console.log(`  - Usuario companyId: ${userCompanyId}`);
      console.log(`  - Solicitud companyId: ${requestCompanyId}`);
      console.log(`  - Solicitud ID: ${requestId}`);
      
      if (currentUser.role !== UserRole.SUPER_ADMIN && requestCompanyId !== userCompanyId) {
        console.log(`[DEBUG] Acceso denegado: Company mismatch`);
        return res.status(403).json({ 
          message: "No tienes permiso para modificar esta solicitud" 
        });
      }
      
      console.log(`[DEBUG] Validación de permisos exitosa - procediendo con ${status}`);
      
      // Actualizar el estado de la solicitud
      // Este método también crea automáticamente una reservación en la tabla "reservations" si se aprueba
      const updatedRequest = await storage.updateReservationRequestStatus(
        requestId, 
        status, 
        currentUser.id, 
        reviewNotes
      );
      
      // Mensaje personalizado según si fue aprobada o rechazada
      let message = "";
      if (status === "aprobada") {
        message = "Solicitud de reservación aprobada. Se ha creado una reservación en el sistema.";
        console.log(`[reservation-requests/${requestId}/update-status] Solicitud aprobada y convertida a reservación`);
      } else {
        message = `Solicitud de reservación ${status}`;
        console.log(`[reservation-requests/${requestId}/update-status] Solicitud rechazada`);
      }
      
      res.json({
        message: message,
        request: updatedRequest
      });
    } catch (error) {
      console.error(`Error al actualizar estado de solicitud ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });


  
  // =========== RUTAS PARA NOTIFICACIONES ===========
  
  // Obtener notificaciones del usuario actual
  app.get(apiRouter('/notifications'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const notifications = await storage.getNotifications(currentUser.id);
      
      res.json(notifications);
    } catch (error) {
      console.error("Error al obtener notificaciones:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Marcar una notificación como leída
  app.post(apiRouter('/notifications/:id/mark-read'), isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "ID de notificación inválido" });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Obtener la notificación para verificar que pertenezca al usuario actual
      const notifications = await storage.getNotifications(currentUser.id);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ 
          message: "Notificación no encontrada o no pertenece a este usuario" 
        });
      }
      
      // Marcar como leída
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      
      res.json({
        message: "Notificación marcada como leída",
        notification: updatedNotification
      });
    } catch (error) {
      console.error(`Error al marcar notificación ${req.params.id} como leída:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener contador de notificaciones no leídas
  app.get(apiRouter('/notifications/unread-count'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const count = await storage.getUnreadNotificationsCount(currentUser.id);
      
      console.log(`[GET /notifications/unread-count] Usuario: ${currentUser.id}, Conteo: ${count}`);
      
      // Asegurarnos de devolver un número (no un objeto ni cadena)
      res.json(Number(count));
    } catch (error) {
      console.error("Error al obtener contador de notificaciones no leídas:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Rutas para manejo de usuarios
  // GET /api/users/commissioners - Obtener lista de comisionistas
  app.get(apiRouter('/users/commissioners'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      const user = req.user as Express.User;
      let commissioners;
      
      console.log(`[GET /api/users/commissioners] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}, CompanyId: ${user.companyId || 'N/A'}`);
      
      if (user.role === UserRole.SUPER_ADMIN) {
        // Superadmin puede ver todos los comisionistas
        commissioners = await storage.getUsers();
        commissioners = commissioners.filter(u => u.role === UserRole.COMMISSIONER);
      } else {
        // Owner y Admin solo ven comisionistas de su compañía
        const companyFilter = user.companyId || user.company || '';
        commissioners = await storage.getUsersByCompanyAndRole(companyFilter, UserRole.COMMISSIONER);
      }
      
      console.log(`[GET /api/users/commissioners] Encontrados ${commissioners.length} comisionistas`);
      
      res.json(commissioners);
    } catch (error) {
      console.error('Error al obtener comisionistas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // GET /api/users - Obtener todos los usuarios
  app.get(apiRouter('/users'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      // Si es superAdmin, puede ver todos los usuarios
      // Si es OWNER o ADMIN, solo ve los de su compañía
      const user = req.user as Express.User;
      let users;
      
      // Filtro por rol si se proporciona en la consulta
      const roleFilter = req.query.role as string;
      console.log(`[GET /api/users] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}, CompanyId: ${user.companyId || 'N/A'}, Company: ${user.company || 'N/A'}`);
      console.log(`[GET /api/users] Filtro de rol solicitado: ${roleFilter || 'ninguno'}`);
      
      if (user.role === UserRole.SUPER_ADMIN) {
        if (roleFilter) {
          // Si hay filtro de rol, usar la función optimizada aunque sea superadmin
          console.log(`[GET /api/users] Usuario con rol superadmin: filtrando por rol "${roleFilter}" en todas las empresas`);
          // Los superadmin ven usuarios de todas las compañías
          users = await storage.getUsers();
          // Luego filtramos por rol
          const normalizedRoleFilter = roleFilter.toLowerCase();
          users = users.filter(user => {
            const userRole = user.role.toLowerCase();
            
            // Caso especial para conductores 
            if (normalizedRoleFilter === 'chofer') {
              return userRole === 'chofer' || userRole === 'driver' || userRole === 'chófer';
            }
            
            return userRole === normalizedRoleFilter;
          });
        } else {
          // Si no hay filtro de rol, obtener todos los usuarios
          console.log(`[GET /api/users] Usuario con rol superadmin: obteniendo TODOS los usuarios`);
          users = await storage.getUsers();
        }
      } else {
        // Para Owner y Admin, filtramos por companyId o company
        const companyFilter = user.companyId || user.company || '';
        
        if (roleFilter) {
          // Si hay filtro de rol, usar función optimizada con filtro combinado
          console.log(`[GET /api/users] Usuario con rol ${user.role}: filtrando por compañía: ${companyFilter} y rol: ${roleFilter}`);
          users = await storage.getUsersByCompanyAndRole(companyFilter, roleFilter);
        } else {
          // Si no hay filtro de rol, obtener todos los usuarios de la compañía
          console.log(`[GET /api/users] Usuario con rol ${user.role}: filtrando por compañía: ${companyFilter}`);
          users = await storage.getUsersByCompany(companyFilter);
        }
      }
      
      console.log(`[GET /api/users] Encontrados ${users.length} usuarios`);
      
      res.json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  

  
  // GET /api/users/:id - Obtener un usuario por ID
  app.get(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      res.json(user);
    } catch (error) {
      console.error(`Error al obtener usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/users/:id - Actualizar un usuario
  app.patch(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email, password, commissionPercentage, commissionEnabled, cashBoxEnabled } = req.body;
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Solo permitir actualizar usuarios de la misma compañía (excepto para super admin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        const existingUserCompany = existingUser.company || existingUser.companyId;
        if (existingUserCompany !== userCompany) {
          return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
        }
      }
      
      // Construir objeto de actualización
      const updateData: {
        email?: string;
        password?: string;
        commissionPercentage?: number;
        commissionEnabled?: boolean;
        cashBoxEnabled?: boolean;
      } = {};
      
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (commissionPercentage !== undefined) updateData.commissionPercentage = commissionPercentage;
      if (commissionEnabled !== undefined) updateData.commissionEnabled = commissionEnabled;
      if (cashBoxEnabled !== undefined) updateData.cashBoxEnabled = cashBoxEnabled;
      
      // Actualizar el usuario
      const updatedUser = await storage.updateUser(id, updateData);
      
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error al actualizar usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // DELETE /api/users/:id - Eliminar un usuario
  app.delete(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // No permitir eliminar a uno mismo
      if (req.user && req.user.id === id) {
        return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
      }
      
      // Solo permitir eliminar usuarios de la misma compañía (excepto para super admin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        const existingUserCompany = existingUser.company || existingUser.companyId;
        if (existingUserCompany !== userCompany) {
          return res.status(403).json({ message: 'No tienes permiso para eliminar este usuario' });
        }
      }
      
      // Intentar eliminar el usuario
      const deleted = await storage.deleteUser(id);
      
      if (deleted) {
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
      } else {
        res.status(400).json({ 
          success: false, 
          message: 'No se pudo eliminar el usuario. Puede tener reservaciones asociadas u otros usuarios invitados.' 
        });
      }
    } catch (error) {
      console.error(`Error al eliminar usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });



  // POST /api/reservations/:id/check - Escanear/verificar un ticket
  app.post(apiRouter('/reservations/:id/check'), isAuthenticated, async (req, res) => {
    try {
      const reservationId = parseInt(req.params.id);
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Obtener la reservación
      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reservación no encontrada'
        });
      }

      // Verificar permisos de compañía - diferente lógica para taquilla vs otros roles
      if (user.role === 'taquilla') {
        // Para usuarios taquilla, verificar acceso a través de userCompanies
        console.log(`[CHECK TICKET] Usuario taquilla ${user.id} intentando verificar reservación de compañía ${reservation.companyId}`);
        
        const userCompanyAssociations = await storage.getUserCompanies(user.id);
        const hasAccess = userCompanyAssociations.some(assoc => assoc.companyId === reservation.companyId);
        
        console.log(`[CHECK TICKET] Usuario taquilla tiene acceso a empresas: ${userCompanyAssociations.map(a => a.companyId).join(', ')}`);
        console.log(`[CHECK TICKET] ¿Tiene acceso a empresa ${reservation.companyId}? ${hasAccess}`);
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para verificar tickets de esta compañía'
          });
        }
      } else {
        // Para otros roles, usar verificación tradicional de companyId
        if (user.companyId !== reservation.companyId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para verificar tickets de esta compañía'
          });
        }
      }

      // Verificar si el ticket ya fue escaneado
      if (reservation.checkedBy !== null) {
        return res.status(400).json({
          success: false,
          isAlreadyChecked: true,
          message: 'Este ticket ya ha sido verificado anteriormente'
        });
      }

      // Actualizar la reservación con la información del escaneo
      const updatedReservation = await storage.updateReservation(reservationId, {
        checkedBy: user.id,
        checkedAt: new Date(),
        checkCount: 1
      });

      if (!updatedReservation) {
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar la reservación'
        });
      }

      console.log(`[CHECK TICKET] Ticket ${reservationId} escaneado por primera vez por usuario ${user.id} (${user.firstName} ${user.lastName})`);

      res.json({
        success: true,
        isFirstScan: true,
        reservation: updatedReservation,
        message: 'Ticket verificado correctamente'
      });

    } catch (error) {
      console.error('Error al escanear ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  });

  // POST /api/reservations/:id/pay - Marcar un ticket como pagado
  app.post(apiRouter('/reservations/:id/pay'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que la reservación existe
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reservación no encontrada' 
        });
      }
      
      // Verificar que el usuario está autenticado
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
      }
      
      console.log(`[PAY TICKET] Solicitud de pago de ticket ${id} por usuario ${req.user.firstName} ${req.user.lastName} (ID: ${req.user.id})`);
    
      // Verificar permisos: solo ciertos roles pueden marcar tickets como pagados
      const allowedRoles = [
        UserRole.SUPER_ADMIN, 
        UserRole.ADMIN, 
        UserRole.OWNER, 
        UserRole.CHECKER, 
        UserRole.TICKET_OFFICE
      ];
      
      if (!allowedRoles.includes(req.user.role)) {
        console.log(`[PAY TICKET] DENEGADO: Rol ${req.user.role} no autorizado para marcar tickets como pagados`);
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para marcar tickets como pagados' 
        });
      }
      
      // Obtener los detalles del viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      if (!trip) {
        console.log(`[PAY TICKET] DENEGADO: No se encontró el viaje ${reservation.tripId} asociado a la reservación ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'No se encontró el viaje asociado a esta reservación' 
        });
      }
      
      // Obtener la compañía del usuario
      const userCompanyId = req.user.company || (req.user as any).companyId;
      
      // Obtener la compañía del viaje
      const tripCompanyId = trip.companyId;
      
      console.log(`[PAY TICKET] Verificando compañías - Usuario: ${userCompanyId || 'ninguna'}, Viaje: ${tripCompanyId || 'ninguna'}`);
      
      // Verificar si ambas compañías coinciden (solo si el usuario no es superAdmin)
      if (req.user.role !== UserRole.SUPER_ADMIN) {
        // Si el usuario no tiene compañía asignada, no puede marcar tickets como pagados
        if (!userCompanyId) {
          console.log(`[PAY TICKET] DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes una compañía asignada para marcar tickets como pagados' 
          });
        }
        
        // Si el viaje no tiene compañía asignada, aplicamos una restricción similar
        if (!tripCompanyId) {
          console.log(`[PAY TICKET] DENEGADO: El viaje no tiene compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'El viaje asociado no tiene compañía asignada' 
          });
        }
        
        // Normalizar IDs de compañía para la comparación
        // Extraer el nombre base de la compañía sin el sufijo (ej. "bamo-456" => "bamo")
        const normalizeCompanyId = (companyId: string) => {
          const companyIdLower = companyId.toLowerCase();
          // Si tiene formato "compañía-XXX", extraer solo la parte de la compañía
          const match = companyIdLower.match(/^([a-z]+)(?:-\d+)?$/);
          return match ? match[1] : companyIdLower;
        };
        
        const normalizedUserCompany = normalizeCompanyId(userCompanyId);
        const normalizedTripCompany = normalizeCompanyId(tripCompanyId);
        
        console.log(`[PAY TICKET] Compañías normalizadas - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
        
        // Verificar que las compañías coincidan después de normalizarlas
        if (normalizedUserCompany !== normalizedTripCompany) {
          console.log(`[PAY TICKET] DENEGADO: Las compañías no coinciden después de normalizar - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
          return res.status(403).json({ 
            success: false, 
            message: 'No puedes marcar como pagados tickets de viajes que no pertenecen a tu compañía' 
          });
        }
      }
      
      // Marcar el ticket como pagado
      const updatedReservation = await storage.markAsPaid(id, req.user.id);
      
      console.log(`[PAY TICKET] Ticket ${id} marcado como pagado por usuario ${req.user.id}`);
      
      res.json({ 
        success: true, 
        reservation: updatedReservation,
        message: 'Ticket marcado como pagado correctamente'
      });
    } catch (error) {
      console.error('Error al marcar ticket como pagado:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar el pago del ticket' 
      });
    }
  });

  // POST /api/reservations/:id/check - Verificar ticket (checkear)
  app.post(apiRouter('/reservations/:id/check'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de reservación inválido' 
        });
      }

      // Obtener la reservación
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reservación no encontrada' 
        });
      }

      // Verificar que la reservación no esté cancelada
      if (reservation.status === 'canceled') {
        return res.status(400).json({ 
          success: false, 
          message: 'No se puede verificar un ticket de una reservación cancelada' 
        });
      }

      // Verificar que el ticket no haya sido verificado previamente
      if (reservation.checkedBy) {
        return res.status(400).json({ 
          success: false, 
          message: 'Este ticket ya ha sido verificado previamente' 
        });
      }

      // Obtener información del viaje
      const trip = await storage.getTrip(reservation.trip.id);
      if (!trip) {
        return res.status(404).json({ 
          success: false, 
          message: 'Viaje no encontrado' 
        });
      }

      // Verificar permisos de compañía
      const userCompanyId = req.user.company_id;
      const tripCompanyId = trip.companyId;
      
      console.log(`[CHECK TICKET] Usuario: ${req.user.email}, Compañía del usuario: ${userCompanyId}, Compañía del viaje: ${tripCompanyId}`);
      
      if (userCompanyId !== tripCompanyId) {
        console.log(`[CHECK TICKET] DENEGADO: Las compañías no coinciden - Usuario: ${userCompanyId}, Viaje: ${tripCompanyId}`);
        return res.status(403).json({ 
          success: false, 
          message: 'Solo puedes verificar tickets de viajes de tu compañía' 
        });
      }

      // Marcar el ticket como verificado
      const updatedReservation = await storage.checkTicket(id, req.user.id);
      
      console.log(`[CHECK TICKET] Ticket ${id} verificado por usuario ${req.user.id}`);
      
      res.json({ 
        success: true, 
        reservation: updatedReservation,
        message: 'Ticket verificado correctamente'
      });
    } catch (error) {
      console.error('Error al verificar ticket:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al verificar el ticket' 
      });
    }
  });

  // POST /api/reservations/:id/cancel-refund - Cancelar con reembolso
  app.post(apiRouter('/reservations/:id/cancel-refund'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de reservación inválido' 
        });
      }

      // Verificar permisos - solo superAdmin, admin y dueño pueden cancelar con reembolso
      const allowedRoles = ['superAdmin', 'admin', 'dueño'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permisos para cancelar con reembolso' 
        });
      }

      // Obtener la reservación
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reservación no encontrada' 
        });
      }

      // Verificar que la reservación no esté ya cancelada
      if (reservation.status === 'canceled') {
        return res.status(400).json({ 
          success: false, 
          message: 'Esta reservación ya está cancelada' 
        });
      }

      // Verificar permisos de compañía (excepto para superAdmin)
      if (req.user.role !== 'superAdmin') {
        const userCompanyId = req.user.company_id;
        const reservationCompanyId = reservation.companyId;
        
        if (userCompanyId !== reservationCompanyId) {
          return res.status(403).json({ 
            success: false, 
            message: 'Solo puedes cancelar reservaciones de tu compañía' 
          });
        }
      }

      // Cancelar la reservación con reembolso
      const updatedReservation = await storage.cancelReservationWithRefund(id, req.user.id);
      
      console.log(`[CANCEL WITH REFUND] Reservación ${id} cancelada con reembolso por usuario ${req.user.id}`);
      
      res.json({ 
        success: true, 
        reservation: updatedReservation,
        message: 'Reservación cancelada con reembolso correctamente'
      });
    } catch (error) {
      console.error('Error al cancelar con reembolso:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al cancelar la reservación con reembolso' 
      });
    }
  });

  // ======== API de Cupones ========

  // GET /api/coupons - Obtener todos los cupones
  app.get(apiRouter('/coupons'), isAuthenticated, async (req, res) => {
    try {
      // Verificar permisos: solo administradores y dueños pueden ver cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para acceder a esta sección' 
        });
      }

      // Obtener el ID de la compañía del usuario si no es superAdmin
      let companyId = null;
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        companyId = req.user!.company || (req.user as any).companyId;
      }
      
      const coupons = await storage.getCoupons(companyId);
      res.json(coupons);
    } catch (error) {
      console.error('Error al obtener cupones:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener los cupones' 
      });
    }
  });

  // GET /api/coupons/:id - Obtener un cupón específico por ID
  app.get(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden ver cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para acceder a esta sección' 
        });
      }
      
      const coupon = await storage.getCoupon(id);
      
      if (!coupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (coupon.companyId && coupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      res.json(coupon);
    } catch (error) {
      console.error(`Error al obtener cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener el cupón' 
      });
    }
  });

  // POST /api/coupons - Crear un nuevo cupón
  app.post(apiRouter('/coupons'), isAuthenticated, async (req, res) => {
    try {
      // Verificar permisos: solo administradores y dueños pueden crear cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para crear cupones' 
        });
      }
      
      // Validar los datos recibidos
      if (!req.body.discountType || !req.body.discountValue 
          || !req.body.usageLimit || !req.body.expirationHours) {
        return res.status(400).json({ 
          success: false, 
          message: 'Faltan campos requeridos para crear el cupón' 
        });
      }
      
      // Si no se proporciona un código y generateRandomCode es true, generar un código aleatorio
      let code = req.body.code;
      if ((!code || code.trim() === '') && req.body.generateRandomCode) {
        // Generar un código aleatorio de 5 caracteres
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        code = result;
      } else if (!code || code.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón o activar la generación automática' 
        });
      }
      
      // Verificar si ya existe un cupón con ese código
      const existingCoupon = await storage.getCouponByCode(code);
      if (existingCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un cupón con ese código' 
        });
      }
      
      // Asignar la compañía del usuario al cupón
      let companyId = null;
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        companyId = req.user!.company || (req.user as any).companyId;
      }
      
      // Preparar los datos del cupón
      const couponData = {
        code,
        discountType: req.body.discountType,
        discountValue: req.body.discountValue,
        usageLimit: req.body.usageLimit,
        usageCount: 0,
        expirationHours: req.body.expirationHours,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        companyId,
        // La fecha de creación se establece en el modelo, igual que la fecha de expiración
      };
      
      // Crear el cupón
      const newCoupon = await storage.createCoupon(couponData);
      
      res.status(201).json(newCoupon);
    } catch (error) {
      console.error('Error al crear cupón:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al crear el cupón' 
      });
    }
  });

  // PATCH /api/coupons/:id - Actualizar un cupón existente
  app.patch(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden actualizar cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para actualizar cupones' 
        });
      }
      
      // Verificar que el cupón existe
      const existingCoupon = await storage.getCoupon(id);
      if (!existingCoupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (existingCoupon.companyId && existingCoupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      // Preparar los datos para actualizar
      const updates: any = {};
      
      // No permitir cambiar el código del cupón una vez creado
      if (req.body.discountType !== undefined) updates.discountType = req.body.discountType;
      if (req.body.discountValue !== undefined) updates.discountValue = req.body.discountValue;
      if (req.body.usageLimit !== undefined) updates.usageLimit = req.body.usageLimit;
      if (req.body.expirationHours !== undefined) updates.expirationHours = req.body.expirationHours;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      
      // Actualizar el cupón
      const updatedCoupon = await storage.updateCoupon(id, updates);
      
      if (!updatedCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se pudo actualizar el cupón' 
        });
      }
      
      res.json(updatedCoupon);
    } catch (error) {
      console.error(`Error al actualizar cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al actualizar el cupón' 
      });
    }
  });

  // DELETE /api/coupons/:id - Eliminar un cupón
  app.delete(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden eliminar cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para eliminar cupones' 
        });
      }
      
      // Verificar que el cupón existe
      const existingCoupon = await storage.getCoupon(id);
      if (!existingCoupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (existingCoupon.companyId && existingCoupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      // Eliminar el cupón
      const deleted = await storage.deleteCoupon(id);
      
      if (!deleted) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se pudo eliminar el cupón' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Cupón eliminado correctamente' 
      });
    } catch (error) {
      console.error(`Error al eliminar cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al eliminar el cupón' 
      });
    }
  });

  // GET /api/coupons/validate/:code - Endpoint para validar cupón por GET (usado por el frontend)
  app.get(apiRouter('/coupons/validate/:code'), async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón' 
        });
      }
      
      console.log(`Validando cupón con código: ${code}`);
      
      // Verificar la validez del cupón
      const result = await storage.verifyCouponValidity(code);
      
      if (!result.valid) {
        console.log(`Cupón ${code} inválido: ${result.message}`);
        return res.status(400).json({ 
          success: false, 
          valid: false,
          message: result.message || 'Cupón no válido' 
        });
      }
      
      console.log(`Cupón ${code} válido!`);
      
      // Devolver información del cupón para cálculo del descuento
      res.json({ 
        ...result.coupon,
        success: true, 
        valid: true,
        message: 'Cupón válido' 
      });
    } catch (error) {
      console.error('Error al validar cupón:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al validar cupón' 
      });
    }
  });

  // POST /api/coupons/verify - Verificar validez de un cupón
  app.post(apiRouter('/coupons/verify'), async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón' 
        });
      }
      
      // Verificar la validez del cupón
      const result = await storage.verifyCouponValidity(code);
      
      if (!result.valid) {
        return res.status(400).json({ 
          success: false, 
          valid: false,
          message: result.message || 'Cupón no válido' 
        });
      }
      
      res.json({ 
        success: true, 
        valid: true,
        coupon: result.coupon,
        message: 'Cupón válido' 
      });
    } catch (error) {
      console.error('Error al verificar cupón:', error);
      res.status(500).json({ 
        success: false, 
        valid: false,
        message: 'Error al verificar el cupón' 
      });
    }
  });

  // ========== RUTAS DE PAQUETERÍAS ==========
  // Middleware para validar acceso a paqueterías según rol
  function validatePackageAccess(req: Request, res: Response, next: Function) {
    const { user } = req as any;
    
    if (!user) {
      console.log(`[packages] Acceso denegado: Usuario no autenticado`);
      return res.status(401).json({ message: "No autenticado" });
    }
    
    if (!PACKAGE_ACCESS_ROLES.includes(user.role)) {
      console.log(`[packages] Acceso denegado: Rol ${user.role} no tiene permisos`);
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    next();
  }
  
  // 1. Obtener todas las paqueterías (con filtros)
  // Endpoint específico para taquilleros: obtener paqueterías de todas sus empresas
  app.get(apiRouter("/taquilla/packages"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { date } = req.query;
      
      console.log(`[GET /taquilla/packages] Usuario: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
      
      // Permitir mostrar todas las paqueterías por defecto (sin filtro automático)
      let dateFilter = date as string;
      if (date) {
        console.log(`[GET /taquilla/packages] Aplicando filtro de fecha específico: ${dateFilter}`);
      } else {
        console.log(`[GET /taquilla/packages] Sin filtro de fecha - mostrando todas las paqueterías`);
      }
      
      // Verificar que el usuario sea taquillero o chofer
      if (user.role !== 'taquilla' && user.role !== 'chofer') {
        console.log(`[GET /taquilla/packages] ACCESO DENEGADO: El usuario tiene rol ${user.role}, se requiere rol taquilla o chofer`);
        return res.status(403).json({ error: "Acceso denegado. Solo usuarios con rol taquilla o chofer pueden usar este endpoint." });
      }
      
      // Lógica específica para cada rol
      let packages;
      
      if (user.role === 'chofer') {
        // CASO ESPECIAL: CONDUCTORES (CHOFER) - solo ven paqueterías de sus viajes asignados
        console.log(`[GET /taquilla/packages] CONDUCTOR solicitando paqueterías - verificando viajes asignados`);
        
        // Obtener los viajes asignados al conductor
        const userCompanyId = user.companyId || user.company;
        const assignedTrips = await storage.searchTrips({ driverId: user.id, companyId: userCompanyId });
        
        if (assignedTrips.length === 0) {
          console.log(`[GET /taquilla/packages] Conductor ${user.id} no tiene viajes asignados`);
          return res.json([]);
        }
        
        // Obtener IDs de viajes asignados al conductor - solo los recordIds base
        const assignedTripIds = assignedTrips.map(trip => trip.id);
        
        // Extraer solo los recordIds únicos (base) de los tripIds con sufijos
        const uniqueRecordIds = [...new Set(assignedTripIds.map(tripId => {
          const tripIdStr = tripId.toString();
          if (tripIdStr.includes('_')) {
            return parseInt(tripIdStr.split('_')[0]);
          }
          return parseInt(tripIdStr);
        }))];
        
        console.log(`[GET /taquilla/packages] Conductor ${user.id} tiene ${assignedTripIds.length} viajes asignados`);
        console.log(`[GET /taquilla/packages] RecordIds únicos: [${uniqueRecordIds.join(', ')}]`);
        
        // Obtener paqueterías solo de los viajes asignados - usar método específico para conductor
        const filters: any = {};
        if (dateFilter) filters.date = dateFilter;
        
        packages = await storage.getPackagesWithTripInfo(filters, user.id, 'chofer');
      } else {
        // Para taquilleros: obtener todas las empresas asociadas al taquillero
        const userCompanies = await db
          .select()
          .from(schema.userCompanies)
          .where(eq(schema.userCompanies.userId, user.id));
        
        const companyIds = userCompanies.map(uc => uc.companyId);
        console.log(`[GET /taquilla/packages] Taquillero tiene acceso a ${companyIds.length} empresas: [${companyIds.join(', ')}]`);
        
        if (companyIds.length === 0) {
          console.log(`[GET /taquilla/packages] ADVERTENCIA: Taquillero no tiene empresas asociadas`);
          return res.json([]);
        }
        
        // Obtener paqueterías con información del viaje de todas las empresas del taquillero
        const filters: any = { companyIds: companyIds };
        if (dateFilter) filters.date = dateFilter;
        
        packages = await storage.getPackagesWithTripInfo(filters);
      }
      
      console.log(`[GET /taquilla/packages] Encontrados ${packages.length} paquetes para el usuario ${user.role} ${dateFilter ? `(fecha: ${dateFilter})` : '(sin filtro de fecha)'}`);;
      
      res.json(packages);
    } catch (error) {
      console.error(`[GET /taquilla/packages] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener paqueterías para taquillero" });
    }
  });

  // ELIMINAR: Definición duplicada del endpoint - se mantiene la versión de la línea 7174
  
  // ELIMINAR: Definición duplicada del endpoint - se mantiene la versión de la línea 7195
  
  // 3. Crear nueva paquetería
  app.post(apiRouter("/packages"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[POST /packages] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para crear paqueterías
      if (!PACKAGE_CREATE_ROLES.includes(user.role)) {
        console.log(`[POST /packages] Acceso denegado: Rol ${user.role} no puede crear paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para crear paqueterías" });
      }
      
      // Validar datos recibidos
      try {
        insertPackageSchema.parse(req.body);
      } catch (validationError: any) {
        console.error(`[POST /packages] Error de validación:`, validationError);
        return res.status(400).json({ 
          message: "Datos de paquetería inválidos", 
          errors: validationError.errors 
        });
      }
      
      // Extraer companyId del usuario para aislamiento de datos
      const userCompanyId = user.companyId || user.company;
      
      // Preparar datos para crear la paquetería
      const packageData = {
        ...req.body,
        companyId: userCompanyId,
        createdBy: user.id
      };
      
      // Si el paquete está marcado como pagado (isPaid=true), 
      // guardar el ID del usuario que lo está creando en el campo paidBy
      if (packageData.isPaid === true) {
        packageData.paidBy = user.id;
        console.log(`[POST /packages] Paquete marcado como pagado por el usuario: ${user.id}`);
      }
      
      // Si hay un tripId, obtener la fecha de salida del viaje y datos de la ruta
      let tripWithRouteInfo: any = null;
      if (packageData.tripId) {
        try {
          tripWithRouteInfo = await storage.getTripWithRouteInfo(packageData.tripId);
          if (tripWithRouteInfo && tripWithRouteInfo.departureDate) {
            console.log(`[POST /packages] Usando fecha de salida del viaje: ${tripWithRouteInfo.departureDate}`);
            // Actualizar la fecha de creación para que coincida con la fecha del viaje
            packageData.createdAt = tripWithRouteInfo.departureDate;
          }
        } catch (tripError) {
          console.error(`[POST /packages] Error al obtener datos del viaje: ${tripError}`);
          // Continuamos sin fecha específica si hay un error (usará la fecha actual)
        }
      }
      
      console.log(`[POST /packages] Creando paquetería:`, packageData);
      
      // Crear la paquetería
      const newPackage = await storage.createPackage(packageData);
      
      // ACTUALIZACIÓN DE ASIENTOS: Si el paquete ocupa asientos, actualizar disponibilidad del viaje
      if (packageData.usesSeats && packageData.seatsQuantity && packageData.seatsQuantity > 0) {
        try {
          // Extraer recordId y tripId desde tripDetails JSON
          const tripDetails = packageData.tripDetails as any;
          if (tripDetails && tripDetails.tripId) {
            const tripIdString = tripDetails.tripId.toString(); // ej: "28_2"
            const recordId = parseInt(tripIdString.split('_')[0]); // ej: 28
            
            if (!isNaN(recordId)) {
              console.log(`[POST /packages] Paquete ocupa ${packageData.seatsQuantity} asientos. Actualizando viaje ${recordId}, segmento ${tripIdString}`);
              
              // Reducir asientos disponibles (número negativo)
              await storage.updateRelatedTripsAvailability(recordId, tripIdString, -packageData.seatsQuantity);
              
              console.log(`[POST /packages] Asientos actualizados exitosamente: -${packageData.seatsQuantity} para ${tripIdString}`);
            } else {
              console.warn(`[POST /packages] No se pudo extraer recordId válido de tripId: ${tripIdString}`);
            }
          } else {
            console.warn(`[POST /packages] tripDetails no contiene tripId válido:`, tripDetails);
          }
        } catch (seatUpdateError) {
          console.error(`[POST /packages] Error al actualizar asientos disponibles:`, seatUpdateError);
          // No fallar la operación principal, solo loggeamos el error
        }
      }
      
      // Si el paquete está marcado como pagado, crear una transacción en la base de datos
      if (packageData.isPaid === true) {
        try {
          // Extraer información del viaje desde tripDetails
          const tripDetails = newPackage.tripDetails as any;
          let tripId = "";
          let origen = "";
          let destino = "";
          
          if (tripDetails) {
            tripId = tripDetails.tripId || "";
            origen = tripDetails.segmentOrigin || tripDetails.origin || "";
            destino = tripDetails.segmentDestination || tripDetails.destination || "";
            
            console.log(`[POST /packages] Información extraída de tripDetails:`, {
              tripId,
              origen,
              destino
            });
          }
          
          // Si no tenemos origen/destino desde tripDetails, intentar obtenerlos de la BD
          if (!origen || !destino) {
            try {
              // Extraer recordId del tripId para buscar en la BD
              if (tripId) {
                const recordId = parseInt(tripId.split('_')[0]);
                
                if (!isNaN(recordId)) {
                  const tripDbDetails = await db
                    .select({
                      isSubTrip: schema.trips.isSubTrip,
                      segmentOrigin: schema.trips.segmentOrigin,
                      segmentDestination: schema.trips.segmentDestination
                    })
                    .from(schema.trips)
                    .where(eq(schema.trips.id, recordId))
                    .limit(1);

                  if (tripDbDetails && tripDbDetails.length > 0) {
                    const tripData = tripDbDetails[0];
                    
                    if (tripData.isSubTrip && tripData.segmentOrigin && tripData.segmentDestination) {
                      origen = origen || tripData.segmentOrigin;
                      destino = destino || tripData.segmentDestination;
                      console.log(`[POST /packages] Origen/destino complementados desde BD:`, { origen, destino });
                    }
                  }
                }
              }
            } catch (dbError) {
              console.error(`[POST /packages] Error al consultar detalles del viaje en BD:`, dbError);
            }
          }
          
          // Crear los detalles de la transacción en formato JSON
          const detallesTransaccion = {
            type: "package",
            details: {
              id: newPackage.id,
              monto: newPackage.price,
              notas: "Pago de paquetería",
              origen: origen,
              tripId: tripId,
              destino: destino,
              isSubTrip: false, // Se puede determinar desde tripId si es necesario
              metodoPago: newPackage.paymentMethod || "efectivo",
              remitente: `${newPackage.senderName} ${newPackage.senderLastName}`,
              destinatario: `${newPackage.recipientName} ${newPackage.recipientLastName}`,
              descripcion: newPackage.packageDescription || "",
              usaAsientos: newPackage.usesSeats || false,
              asientos: newPackage.seatsQuantity || 0
            }
          };
          
          console.log(`[POST /packages] Creando transacción con detalles:`, 
                      JSON.stringify(detallesTransaccion, null, 2));
          
          // Crear la transacción en la base de datos
          const transaccion = await storage.createTransaccion({
            details: detallesTransaccion,
            user_id: user.id,
            cutoff_id: null,
            companyId: userCompanyId // Incluir el ID de la compañía para el aislamiento de datos
          });
          
          console.log(`[POST /packages] Transacción creada con ID:`, transaccion.id);
        } catch (transactionError: any) {
          console.error(`[POST /packages] Error al crear transacción:`, transactionError);
          // No detener el proceso si falla la creación de la transacción
        }
      } else {
        console.log(`[POST /packages] No se creó transacción porque el paquete no está marcado como pagado`);
      }
      
      // Responder con la paquetería creada
      res.status(201).json(newPackage);
    } catch (error: any) {
      console.error(`[POST /packages] Error:`, error);
      res.status(500).json({ message: error.message || "Error al crear la paquetería" });
    }
  });
  
  // 4. Actualizar una paquetería existente
  app.patch(apiRouter("/packages/:id"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      console.log(`[PATCH /packages/${id}] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para editar paqueterías
      if (!PACKAGE_WRITE_ROLES.includes(user.role)) {
        console.log(`[PATCH /packages/${id}] Acceso denegado: Rol ${user.role} no puede editar paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para editar paqueterías" });
      }
      
      // Obtener la paquetería existente
      const existingPackage = await storage.getPackage(parseInt(id));
      
      if (!existingPackage) {
        return res.status(404).json({ message: "Paquetería no encontrada" });
      }
      
      // Validar aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          console.log(`[PATCH /packages/${id}] Acceso denegado: La paquetería pertenece a otra compañía`);
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Preparar datos para actualizar
      const updateData = { ...req.body };
      
      // Si se está cambiando el viaje (tripId), actualizar la fecha de creación para que coincida con la nueva fecha del viaje
      if (updateData.tripId && updateData.tripId !== existingPackage.tripId) {
        try {
          const trip = await storage.getTrip(updateData.tripId);
          if (trip && trip.departureDate) {
            console.log(`[PATCH /packages/${id}] Actualizando fecha a fecha de salida del nuevo viaje: ${trip.departureDate}`);
            // Usar la fecha del nuevo viaje
            updateData.createdAt = trip.departureDate;
          }
        } catch (tripError) {
          console.error(`[PATCH /packages/${id}] Error al obtener datos del nuevo viaje: ${tripError}`);
          // Continuamos con la actualización sin cambiar la fecha
        }
      }
      
      // ACTUALIZACIÓN DE ASIENTOS: Manejar cambios en el uso de asientos
      const oldUsesSeats = existingPackage.usesSeats || false;
      const oldSeatsQuantity = existingPackage.seatsQuantity || 0;
      const newUsesSeats = updateData.usesSeats !== undefined ? updateData.usesSeats : oldUsesSeats;
      const newSeatsQuantity = updateData.seatsQuantity !== undefined ? updateData.seatsQuantity : oldSeatsQuantity;
      
      // Calcular el cambio neto en asientos
      const oldSeatsUsed = oldUsesSeats ? oldSeatsQuantity : 0;
      const newSeatsUsed = newUsesSeats ? newSeatsQuantity : 0;
      const seatChangeDelta = newSeatsUsed - oldSeatsUsed;
      
      // ESTADO DE ENTREGA: Establecer deliveredAt cuando se marca como entregado
      if (updateData.deliveryStatus === 'entregado' && existingPackage.deliveryStatus !== 'entregado') {
        console.log(`[PATCH /packages/${id}] Marcando paquete como entregado - estableciendo deliveredAt`);
        // Crear fecha en zona horaria de México (UTC-6)
        const now = new Date();
        const mexicoTime = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // UTC-6
        updateData.deliveredAt = mexicoTime;
        console.log(`[PATCH /packages/${id}] Timestamp ajustado a zona horaria de México: ${mexicoTime.toISOString()}`);
      }
      
      // Actualizar la paquetería
      const updatedPackage = await storage.updatePackage(parseInt(id), updateData);
      
      // Si hay cambio en los asientos, actualizar disponibilidad del viaje
      if (seatChangeDelta !== 0) {
        try {
          // Usar tripDetails del paquete existente (asumir que el viaje no cambió)
          const tripDetails = existingPackage.tripDetails as any;
          if (tripDetails && tripDetails.tripId) {
            const tripIdString = tripDetails.tripId.toString();
            const recordId = parseInt(tripIdString.split('_')[0]);
            
            if (!isNaN(recordId)) {
              console.log(`[PATCH /packages/${id}] Cambio en asientos: ${oldSeatsUsed} → ${newSeatsUsed} (Δ${seatChangeDelta})`);
              
              // Aplicar el cambio neto (negativo para reducir disponibilidad, positivo para aumentar)
              await storage.updateRelatedTripsAvailability(recordId, tripIdString, -seatChangeDelta);
              
              console.log(`[PATCH /packages/${id}] Asientos actualizados: ${seatChangeDelta > 0 ? '-' : '+'}${Math.abs(seatChangeDelta)} para ${tripIdString}`);
            }
          }
        } catch (seatUpdateError) {
          console.error(`[PATCH /packages/${id}] Error al actualizar asientos disponibles:`, seatUpdateError);
        }
      }
      
      // Responder con la paquetería actualizada
      res.json(updatedPackage);
    } catch (error: any) {
      console.error(`[PATCH /packages/${req.params.id}] Error:`, error);
      res.status(500).json({ message: error.message || "Error al actualizar la paquetería" });
    }
  });
  
  // 5. Eliminar una paquetería
  app.delete(apiRouter("/packages/:id"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      console.log(`[DELETE /packages/${id}] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para eliminar paqueterías
      if (!PACKAGE_WRITE_ROLES.includes(user.role)) {
        console.log(`[DELETE /packages/${id}] Acceso denegado: Rol ${user.role} no puede eliminar paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para eliminar paqueterías" });
      }
      
      // Obtener la paquetería existente
      const existingPackage = await storage.getPackage(parseInt(id));
      
      if (!existingPackage) {
        return res.status(404).json({ message: "Paquetería no encontrada" });
      }
      
      // Validar aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          console.log(`[DELETE /packages/${id}] Acceso denegado: La paquetería pertenece a otra compañía`);
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // LIBERACIÓN DE ASIENTOS: Si el paquete ocupaba asientos, liberarlos antes de eliminar
      if (existingPackage.usesSeats && existingPackage.seatsQuantity && existingPackage.seatsQuantity > 0) {
        try {
          const tripDetails = existingPackage.tripDetails as any;
          if (tripDetails && tripDetails.tripId) {
            const tripIdString = tripDetails.tripId.toString();
            const recordId = parseInt(tripIdString.split('_')[0]);
            
            if (!isNaN(recordId)) {
              console.log(`[DELETE /packages/${id}] Liberando ${existingPackage.seatsQuantity} asientos para ${tripIdString}`);
              
              // Liberar asientos (número positivo para aumentar disponibilidad)
              await storage.updateRelatedTripsAvailability(recordId, tripIdString, existingPackage.seatsQuantity);
              
              console.log(`[DELETE /packages/${id}] Asientos liberados exitosamente: +${existingPackage.seatsQuantity} para ${tripIdString}`);
            }
          }
        } catch (seatUpdateError) {
          console.error(`[DELETE /packages/${id}] Error al liberar asientos:`, seatUpdateError);
          // Continuamos con la eliminación aunque falle la liberación de asientos
        }
      }
      
      // ELIMINACIÓN EN CASCADA: Eliminar transacciones relacionadas con esta paquetería
      try {
        console.log(`[DELETE /packages/${id}] Buscando transacciones relacionadas con paquetería ID ${id}`);
        const relatedTransactions = await storage.getTransaccionesByPackageId(parseInt(id));
        
        if (relatedTransactions.length > 0) {
          console.log(`[DELETE /packages/${id}] Encontradas ${relatedTransactions.length} transacciones relacionadas, procediendo a eliminarlas`);
          
          for (const transaction of relatedTransactions) {
            try {
              const deletedTransaction = await storage.deleteTransaccion(transaction.id);
              if (deletedTransaction) {
                console.log(`[DELETE /packages/${id}] Transacción ${transaction.id} eliminada exitosamente`);
              } else {
                console.warn(`[DELETE /packages/${id}] No se pudo eliminar la transacción ${transaction.id}`);
              }
            } catch (transactionError) {
              console.error(`[DELETE /packages/${id}] Error eliminando transacción ${transaction.id}:`, transactionError);
              // Continuamos con otras transacciones aunque falle una
            }
          }
          
          console.log(`[DELETE /packages/${id}] Proceso de eliminación de transacciones completado`);
        } else {
          console.log(`[DELETE /packages/${id}] No se encontraron transacciones relacionadas con esta paquetería`);
        }
      } catch (transactionSearchError) {
        console.error(`[DELETE /packages/${id}] Error al buscar/eliminar transacciones relacionadas:`, transactionSearchError);
        // Continuamos con la eliminación de la paquetería aunque falle la eliminación de transacciones
      }
      
      // Eliminar la paquetería
      const deleted = await storage.deletePackage(parseInt(id));
      
      if (!deleted) {
        return res.status(500).json({ message: "No se pudo eliminar la paquetería" });
      }
      
      // Responder con éxito
      res.json({ message: "Paquetería eliminada correctamente" });
    } catch (error: any) {
      console.error(`[DELETE /packages/${req.params.id}] Error:`, error);
      res.status(500).json({ message: error.message || "Error al eliminar la paquetería" });
    }
  });

  // Setup routes for packages
  // Configurar rutas para presupuestos y gastos
  setupFinancialRoutes(app, isAuthenticated);
  
  // Configurar rutas para el sistema de cajas

  
  setupPackageRoutes(app);

  // Endpoint para verificar si hay reservaciones creadas por comisionistas
  app.post(apiRouter("/reservations/check-commission-agents"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { reservationIds } = req.body;
      
      // Validar el formato del cuerpo de la solicitud
      if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
        console.log("[/check-commission-agents] Solicitud inválida: reservationIds debe ser un array no vacío");
        return res.status(400).json({ 
          error: "Formato inválido", 
          details: "reservationIds debe ser un array no vacío de IDs" 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      if (!user) {
        console.log("[/check-commission-agents] Error: Usuario no autenticado");
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[/check-commission-agents] Verificando ${reservationIds.length} reservaciones para comisionistas`);
      
      // Buscar los creadores de las reservaciones para verificar si hay comisionistas
      let hasCommissionAgents = false;
      
      // Verificar cada reservación
      for (const reservationId of reservationIds) {
        try {
          // Obtener los detalles de la reservación
          const reservationDetails = await storage.getReservationWithDetails(reservationId);
          
          if (reservationDetails && reservationDetails.createdByUser) {
            // Verificar si el creador es un comisionista
            if (reservationDetails.createdByUser.role === 'comisionista') {
              console.log(`[/check-commission-agents] Reservación ${reservationId} creada por comisionista: ${reservationDetails.createdByUser.firstName} ${reservationDetails.createdByUser.lastName}`);
              hasCommissionAgents = true;
              break; // Encontramos al menos uno, podemos salir del bucle
            }
          }
        } catch (error) {
          console.error(`[/check-commission-agents] Error al verificar reservación ${reservationId}:`, error);
          // Continuamos con las demás reservaciones
        }
      }
      
      // Devolver el resultado
      console.log(`[/check-commission-agents] Resultado: ${hasCommissionAgents ? 'Encontradas' : 'No encontradas'} reservaciones de comisionistas`);
      res.json({ hasCommissionAgents });
    } catch (error) {
      console.error("[/check-commission-agents] Error general:", error);
      res.status(500).json({ 
        error: "Error al verificar comisionistas", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Endpoint para obtener historial de transferencias
  app.get(apiRouter('/transfers/history'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      console.log(`[GET /transfers/history] Usuario ${user.firstName} ${user.lastName} solicitando historial de transferencias`);
      
      // Obtener todas las reservaciones de la empresa actual (especialmente las transferidas)
      const allReservations = await storage.getReservations(user.company);
      const transferredReservations = allReservations.filter(r => r.status === 'transferido');
      console.log(`[GET /transfers/history] Reservaciones con estado transferido: ${transferredReservations.length}`);
      
      // Obtener notificaciones de tipo transfer
      const userNotifications = await storage.getNotifications(user.id);
      console.log(`[GET /transfers/history] Total de notificaciones del usuario: ${userNotifications.length}`);
      
      // Filtrar solo las notificaciones de tipo 'transfer'
      const transferNotifications = userNotifications.filter(n => n.type === 'transfer');
      console.log(`[GET /transfers/history] Notificaciones de transferencia: ${transferNotifications.length}`);
      
      // Preparar resultados
      const transfers: any[] = [];
      const processedReservationIds = new Set<number>();
      
      // Primero: agregar las reservaciones transferidas (salientes)
      // Esto asegura que las reservaciones transferidas aparezcan en el historial
      for (const reservation of transferredReservations) {
        console.log(`[GET /transfers/history] Procesando reservación transferida ID: ${reservation.id}, estado: ${reservation.status}, notas: ${reservation.notes}`);
        
        const transfer = {
          id: reservation.id + 10000, // Para evitar colisiones de ID
          createdAt: reservation.updatedAt || new Date().toISOString(),
          direction: 'outgoing',
          sourceCompany: user.company,
          targetCompany: reservation.notes?.includes("Transferido a") 
            ? reservation.notes.split("Transferido a ")[1].split(" el")[0] 
            : "Otra empresa",
          sourceUser: {
            name: `${user.firstName} ${user.lastName}`
          },
          reservationIds: [reservation.id],
          transferDate: reservation.updatedAt || new Date().toISOString(),
          reservationCount: 1
        };
        
        transfers.push(transfer);
        processedReservationIds.add(reservation.id);
        console.log(`[GET /transfers/history] Agregada reservación transferida a historial: ${JSON.stringify(transfer)}`);
      }
      
      // Luego: procesar notificaciones de transferencia
      for (const notification of transferNotifications) {
        try {
          let transferData = {};
          if (notification.metaData) {
            transferData = JSON.parse(notification.metaData);
            console.log(`[GET /transfers/history] Metadatos de notificación ${notification.id}: ${notification.metaData}`);
          }
          
          // Determinar si es saliente o entrante basado en los metadatos
          const companyId = user.company;
          const direction = transferData?.sourceCompany === companyId ? 'outgoing' : 'incoming';
          
          // Evitar duplicar reservaciones que ya procesamos
          const reservationIds = transferData?.reservationIds || [];
          if (direction === 'outgoing') {
            const alreadyProcessed = reservationIds.every(id => processedReservationIds.has(id));
            if (alreadyProcessed && reservationIds.length > 0) {
              console.log(`[GET /transfers/history] Omitiendo notificación ${notification.id} porque las reservaciones ya están procesadas`);
              continue;
            }
          }
          
          transfers.push({
            id: notification.id,
            createdAt: notification.createdAt,
            direction,
            sourceCompany: transferData?.sourceCompany || (direction === 'outgoing' ? companyId : 'Empresa desconocida'),
            targetCompany: transferData?.targetCompany || (direction === 'incoming' ? companyId : 'Empresa desconocida'),
            sourceUser: {
              name: (transferData?.sourceUser?.name) || `${user.firstName} ${user.lastName}`
            },
            reservationIds: reservationIds,
            transferDate: notification.createdAt,
            reservationCount: reservationIds.length || 0
          });
        } catch (error) {
          console.error('[GET /transfers/history] Error al procesar notificación:', error);
        }
      }
      
      // Buscar las transferencias en la memoria global
      if (transfers.length === 0) {
        console.log(`[GET /transfers/history] No se encontraron transferencias en los métodos anteriores, buscando en la memoria global...`);
        
        // Usar el almacenamiento en memoria creado para las transferencias
        if (global.transferRecords && global.transferRecords.length > 0) {
          const userCompany = user.company;
          
          global.transferRecords.forEach(record => {
            // Determinar la dirección de la transferencia basado en la compañía del usuario
            const direction = record.sourceCompany === userCompany ? 'outgoing' : 'incoming';
            
            // Solo incluir si es relevante para esta compañía
            if ((direction === 'outgoing' && record.sourceCompany === userCompany) || 
                (direction === 'incoming' && record.targetCompany === userCompany)) {
              
              console.log(`[GET /transfers/history] Encontrado registro de transferencia en memoria: ${JSON.stringify(record)}`);
              
              transfers.push({
                id: record.id,
                createdAt: record.createdAt,
                direction,
                sourceCompany: record.sourceCompany,
                targetCompany: record.targetCompany,
                sourceUser: record.sourceUser,
                reservationIds: record.reservationIds,
                transferDate: record.transferDate,
                reservationCount: record.reservationCount,
                // Incluir información de pasajeros si está disponible
                passengerInfo: record.passengerInfo || []
              });
            }
          });
        }
        
        // Respaldo: Buscar en las reservaciones si no hay nada en memoria
        if (transfers.length === 0) {
          console.log(`[GET /transfers/history] No hay transferencias en memoria, buscando en reservaciones...`);
          
          const allCompanyReservations = await storage.getReservations(user.company);
          console.log(`[GET /transfers/history] Buscando en ${allCompanyReservations.length} reservaciones de la empresa ${user.company}`);
          
          for (const reservation of allCompanyReservations) {
            // Verificar si es una reservación transferida por el texto en las notas
            if (reservation.notes && reservation.notes.includes("Transferido a")) {
              const targetCompanyName = reservation.notes.split("Transferido a ")[1].split(" el")[0];
              console.log(`[GET /transfers/history] Encontrada reservación ${reservation.id} transferida a ${targetCompanyName}`);
              
              // Crear un registro de transferencia para esta reservación
              transfers.push({
                id: reservation.id + 10000, // Para evitar colisiones de ID
                createdAt: reservation.updatedAt || new Date().toISOString(),
                direction: 'outgoing',
                sourceCompany: user.company,
                targetCompany: targetCompanyName,
                sourceUser: {
                  name: `${user.firstName} ${user.lastName}`
                },
                reservationIds: [reservation.id],
                transferDate: reservation.updatedAt || new Date().toISOString(),
                reservationCount: 1
              });
            }
          }
        }
        
        // Si no hay transferencias, devolver un arreglo vacío
        if (transfers.length === 0) {
          console.log(`[GET /transfers/history] No se encontraron transferencias reales, enviando arreglo vacío`);
          return res.json([]);
        }
      }
      
      // Ordenar por fecha (más recientes primero)
      transfers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Enviar resultados
      console.log(`[GET /transfers/history] Enviando ${transfers.length} transferencias`);
      return res.json(transfers);
    } catch (error) {
      console.error('[GET /transfers/history] Error:', error);
      res.status(500).json({ message: 'Error al obtener el historial de transferencias' });
    }
  });

  // Endpoint para transferencia de pasajeros
  app.post(apiRouter('/reservations/transfer'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { reservationIds, targetCompanyId } = req.body;
      
      // Validación básica
      if (!reservationIds || !Array.isArray(reservationIds) || reservationIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Se deben proporcionar IDs de reservaciones a transferir' 
        });
      }
      
      if (!targetCompanyId || typeof targetCompanyId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Se debe proporcionar una empresa destino válida' 
        });
      }
      
      // Obtener información del usuario actual
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Roles permitidos para transferencia
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN];
      if (!allowedRoles.includes(currentUser.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para transferir reservaciones' 
        });
      }
      
      // Obtener datos de la empresa destino
      const targetCompany = await storage.getCompanyById(targetCompanyId);
      if (!targetCompany) {
        return res.status(404).json({ 
          success: false, 
          message: 'La empresa destino no existe' 
        });
      }
      
      // Obtener todas las reservaciones que se transferirán
      const reservationsToTransfer = [];
      for (const id of reservationIds) {
        const reservation = await storage.getReservation(id);
        if (reservation) {
          reservationsToTransfer.push(reservation);
        }
      }
      
      if (reservationsToTransfer.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'No se encontraron reservaciones para transferir' 
        });
      }
      
      // Verificar que las reservaciones pertenezcan a la empresa del usuario
      // excepto para superadmin que puede transferir de cualquier empresa
      if (currentUser.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = currentUser.companyId || currentUser.company;
        
        for (const reservation of reservationsToTransfer) {
          const trip = await storage.getTrip(reservation.tripId);
          if (!trip || trip.companyId !== userCompanyId) {
            return res.status(403).json({ 
              success: false, 
              message: 'No tienes permiso para transferir reservaciones de otra empresa' 
            });
          }
        }
      }
      
      // Actualizar las reservaciones para asignarlas a viajes de la nueva empresa
      // Por ahora, solo registramos la transferencia y enviamos notificaciones
      
      // Actualizar el estado de las reservaciones a "Transferido"
      console.log(`[Transferencia] Actualizando estado de ${reservationsToTransfer.length} reservaciones a "transferido"`);
      
      // Obtener información detallada de las reservaciones, incluyendo pasajeros, origen/destino, y comisión
      const passengerInfo = [];
      for (const reservation of reservationsToTransfer) {
        // Obtener el viaje para determinar origen y destino
        const trip = await storage.getTrip(reservation.tripId);
        if (trip) {
          // Obtener ruta para determinar origen y destino
          const route = await storage.getRoute(trip.routeId);
          
          // Obtener lista de pasajeros
          const passengers = await storage.getPassengers(reservation.id);
          
          // Verificar si la reservación fue creada por un comisionista
          let commissionInfo = null;
          if (reservation.createdBy) {
            try {
              // Obtener información del usuario que creó la reservación
              const creator = await storage.getUser(reservation.createdBy);
              
              // Verificar si es un comisionista
              if (creator && creator.role === UserRole.COMMISSIONER) {
                commissionInfo = {
                  isFromCommissioner: true,
                  commissionPercentage: creator.commissionPercentage || 10 // Usar 10% por defecto si no está establecido
                };
                console.log(`[Transferencia] Reservación ${reservation.id} creada por comisionista ${creator.firstName} ${creator.lastName} con comisión de ${commissionInfo.commissionPercentage}%`);
              }
            } catch (error) {
              console.error(`[Transferencia] Error al obtener información del creador de la reservación ${reservation.id}:`, error);
            }
          }
          
          if (route && passengers && passengers.length > 0) {
            for (const passenger of passengers) {
              passengerInfo.push({
                name: `${passenger.firstName} ${passenger.lastName}`,
                origin: route.origin,
                destination: route.destination,
                tripDate: trip.departureDate.toISOString(),
                // Incluir información de comisión
                isFromCommissioner: commissionInfo?.isFromCommissioner || false,
                commissionPercentage: commissionInfo?.commissionPercentage || 0
              });
            }
          }
        }
      }
      
      console.log(`[Transferencia] Información de pasajeros recopilada: ${JSON.stringify(passengerInfo)}`);
      
      // Crear un registro de transferencia directo en la base de datos
      const transferLog = {
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
        sourceCompany: currentUser.company,
        targetCompany: targetCompanyId,
        sourceUser: {
          name: `${currentUser.firstName} ${currentUser.lastName}`
        },
        reservationIds: reservationsToTransfer.map(r => r.id),
        transferDate: new Date().toISOString(),
        reservationCount: reservationsToTransfer.length,
        // Agregar la información de pasajeros
        passengerInfo: passengerInfo
      };
      
      // Almacenar este registro en memoria global para propósitos de demostración
      // (no requiere cambios en la base de datos)
      if (!global.transferRecords) {
        global.transferRecords = [];
      }
      global.transferRecords.push({...transferLog, id: Date.now()}); // Usar timestamp como ID único
      console.log(`[Transferencia] Registro de transferencia creado en memoria: ${JSON.stringify(transferLog)}`);
      
      
      // Actualizar cada reservación individual
      for (const reservation of reservationsToTransfer) {
        try {
          const updated = await storage.updateReservation(reservation.id, {
            status: 'transferido',
            notes: `Transferido a ${targetCompany.name} el ${new Date().toLocaleDateString()}`
          });
          console.log(`[Transferencia] Reservación ${reservation.id} marcada como "transferido": ${JSON.stringify(updated)}`);
        } catch (error) {
          console.error(`[Transferencia] Error al marcar reservación ${reservation.id} como transferida:`, error);
        }
      }
      
      // 1. Obtener usuarios de la empresa destino con roles específicos
      const targetCompanyUsers = await storage.getUsersByCompany(targetCompanyId);
      // Filtrar por los roles que queremos notificar
      const notificationRoles = [UserRole.OWNER, UserRole.ADMIN, UserRole.TICKET_OFFICE];
      const filteredUsers = targetCompanyUsers.filter(user => 
        notificationRoles.includes(user.role as any)
      );
      
      if (filteredUsers.length === 0) {
        console.log(`[Transferencia] No hay usuarios para notificar en la empresa destino ${targetCompanyId}`);
      } else {
        console.log(`[Transferencia] Se notificará a ${filteredUsers.length} usuarios de la empresa ${targetCompanyId}`);
      }
      
      // Preparar datos de la transferencia para incluir en la notificación
      const transferDataForNotification = {
        reservationIds: reservationsToTransfer.map(r => r.id),
        transferDate: new Date().toISOString(),
        sourceCompany: currentUser.company || currentUser.companyId,
        targetCompany: targetCompanyId,
        sourceUser: {
          id: currentUser.id,
          name: `${currentUser.firstName} ${currentUser.lastName}`
        },
        count: reservationsToTransfer.length
      };
      
      console.log(`[Transferencia] Datos de transferencia: ${JSON.stringify(transferDataForNotification)}`);
      
      // Serializar los datos como JSON para almacenarlos en la notificación
      const transferDataAsJson = JSON.stringify(transferDataForNotification);
      
      // 2. Crear notificaciones para cada usuario (incluyendo al remitente)
      const notificationPromises = [];
      const userIdsForRealtime = [];
      
      // Primero crear una notificación para el usuario que realiza la transferencia
      const senderNotification = {
        userId: currentUser.id,
        type: 'transfer',
        title: 'Transferencia de reservaciones',
        message: `Has transferido ${reservationsToTransfer.length} reservación(es) a ${targetCompany.name}.`,
        read: false,
        relatedId: reservationsToTransfer.length > 0 ? reservationsToTransfer[0].id : null,
        metaData: transferDataAsJson,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log(`[Transferencia] Creando notificación para el remitente (ID: ${currentUser.id})`);
      notificationPromises.push(storage.createNotification(senderNotification));
      
      // Luego crear notificaciones para los usuarios de la empresa destino
      for (const user of filteredUsers) {
        // Crear la notificación
        const notification = {
          userId: user.id,
          type: 'transfer',
          title: 'Transferencia de reservaciones',
          message: `${currentUser.firstName} ${currentUser.lastName} ha transferido ${reservationsToTransfer.length} reservación(es) a tu empresa.`,
          read: false,
          // Usar relatedId para almacenar el ID de la primera reservación como referencia
          relatedId: reservationsToTransfer.length > 0 ? reservationsToTransfer[0].id : null,
          // Almacenar los datos completos en metaData
          metaData: transferDataAsJson,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        notificationPromises.push(storage.createNotification(notification));
        userIdsForRealtime.push(user.id);
      }
      
      // Esperar a que todas las notificaciones se creen
      const createdNotifications = await Promise.all(notificationPromises);
      
      // 3. Enviar notificaciones en tiempo real
      if (createdNotifications.length > 0) {
        // Asegurarnos que la notificación tenga la estructura correcta esperada por el cliente
        const formattedNotification = {
          ...createdNotifications[0],
          message: createdNotifications[0].message || 'Has recibido una nueva notificación',
          createdAt: createdNotifications[0].createdAt || new Date(),
          updatedAt: createdNotifications[0].updatedAt || new Date()
        };
        
        console.log(`[Transferencia] Enviando notificación en tiempo real:`, JSON.stringify(formattedNotification));
        sendNotificationToUsers(userIdsForRealtime, formattedNotification);
      } else {
        console.log(`[Transferencia] No se crearon notificaciones para enviar en tiempo real`);
      }
      
      // Responder con éxito
      res.json({
        success: true,
        message: `${reservationsToTransfer.length} reservaciones transferidas exitosamente a ${targetCompany.name}`,
        notificationsCount: createdNotifications.length
      });
      
    } catch (error) {
      console.error('Error al transferir reservaciones:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar la transferencia de reservaciones' 
      });
    }
  });

  // Endpoint para aceptar reservaciones transferidas
  app.post(apiRouter('/reservations/accept-transfer'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Obtener usuario actual desde req
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { reservationIds } = req.body;
      
      if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Se requiere un array de IDs de reservaciones' 
        });
      }
      
      console.log(`[AcceptTransfer] Usuario ${currentUser.firstName} ${currentUser.lastName} aceptando ${reservationIds.length} reservaciones`);
      
      // Obtener la compañía del usuario actual
      const userCompanyId = currentUser.companyId || currentUser.company;
      if (!userCompanyId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Usuario sin compañía asignada' 
        });
      }
      
      // Procesar cada reservación
      const results = [];
      const newReservationIds = [];
      
      for (const id of reservationIds) {
        try {
          // Obtener la reservación original
          const originalReservation = await storage.getReservation(id);
          if (!originalReservation) {
            results.push({ id, success: false, message: 'Reservación no encontrada' });
            continue;
          }
          
          // Obtener el viaje original
          const originalTrip = await storage.getTrip(originalReservation.tripId);
          if (!originalTrip) {
            results.push({ id, success: false, message: 'Viaje original no encontrado' });
            continue;
          }
          
          // Buscar un viaje similar en la compañía destino
          const similarTrips = await storage.findSimilarTrips({
            companyId: userCompanyId,
            departureDate: originalTrip.departureDate,
            routeId: originalTrip.routeId
          });
          
          if (!similarTrips || similarTrips.length === 0) {
            results.push({ id, success: false, message: 'No se encontraron viajes similares en la compañía destino' });
            continue;
          }
          
          // Usar el primer viaje similar encontrado
          const targetTrip = similarTrips[0];
          
          console.log(`[AcceptTransfer] Transferiendo reservación ${id} al viaje ${targetTrip.id} de la compañía ${userCompanyId}`);
          
          // Obtener la lista de pasajeros de la reservación original
          const passengers = await storage.getPassengers(id);
          
          // Obtener el nombre de la empresa origen (no solo el ID)
          let sourceCompanyName = originalTrip.companyId;
          try {
            // Intentar obtener información más detallada de la empresa origen
            const companies = await storage.getCompanies();
            const sourceCompany = companies.find(c => c.identifier === originalTrip.companyId);
            if (sourceCompany) {
              sourceCompanyName = sourceCompany.name;
            }
          } catch (error) {
            console.error(`[AcceptTransfer] Error al obtener nombre de empresa origen: ${originalTrip.companyId}`, error);
          }
          
          // Crear una nueva reservación en la compañía destino
          const newReservation = {
            tripId: targetTrip.id,
            totalAmount: originalReservation.totalAmount,
            email: originalReservation.email,
            phone: originalReservation.phone,
            notes: `Transferido desde ${sourceCompanyName} (${originalTrip.companyId}) el ${new Date().toLocaleDateString()}`,
            paymentMethod: originalReservation.paymentMethod || 'efectivo',
            status: 'confirmed', // Marcar como confirmada directamente
            paymentStatus: originalReservation.paymentStatus || 'pendiente',
            advanceAmount: originalReservation.advanceAmount || 0,
            advancePaymentMethod: originalReservation.advancePaymentMethod || 'efectivo',
            createdBy: currentUser.id,
            companyId: userCompanyId,
            // Campo adicional para indicar que es una transferencia
            isTransferred: true,
            // Guardar la empresa de origen para mostrarla como "Creada por"
            transferredFromCompany: sourceCompanyName,
            // Guardar el ID de la empresa de origen
            transferredFromCompanyId: originalTrip.companyId,
            // Guardar el usuario que acepta la transferencia
            acceptedBy: currentUser.id
          };
          
          const createdReservation = await storage.createReservation(newReservation);
          
          // Transferir los pasajeros a la nueva reservación
          if (passengers && passengers.length > 0) {
            for (const passenger of passengers) {
              await storage.createPassenger({
                firstName: passenger.firstName,
                lastName: passenger.lastName,
                reservationId: createdReservation.id
              });
            }
          }
          
          // Guardar el ID de la nueva reservación
          newReservationIds.push(createdReservation.id);
          
          // Añadir a los resultados
          results.push({ 
            id, 
            success: true, 
            message: 'Reservación transferida correctamente',
            newReservationId: createdReservation.id
          });
          
          console.log(`[AcceptTransfer] Reservación ${id} transferida exitosamente como ${createdReservation.id}`);
        } catch (error) {
          console.error(`[AcceptTransfer] Error al procesar reservación ${id}:`, error);
          results.push({ 
            id, 
            success: false, 
            message: 'Error al procesar la transferencia' 
          });
        }
      }
      
      // Retornar los resultados
      return res.json({
        success: results.some(r => r.success),
        message: `Se procesaron ${results.length} reservaciones con ${results.filter(r => r.success).length} transferencias exitosas`,
        results,
        newReservationIds
      });
    } catch (error) {
      console.error('[AcceptTransfer] Error general:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar las transferencias' 
      });
    }
  });

  return httpServer;
}

/**
 * Configura las rutas para la funcionalidad de paqueterías
 * @param app - Instancia de Express
 */
function setupPackageRoutes(app: Express) {
  // Helper para rutas API
  const apiRouter = (path: string) => `/api${path}`;
  
  // Middleware para verificar autenticación
  function isAuthenticated(req: Request, res: Response, next: Function) {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'No autenticado' });
  }
  
  // Constantes para roles que pueden crear/editar paquetes
  const PACKAGE_WRITE_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER, UserRole.TICKET_OFFICE];
  // Roles que solo pueden ver paquetes
  const PACKAGE_READ_ONLY_ROLES = [UserRole.DRIVER];
  
  // Middleware para comprobar permisos de paqueterías
  function hasPackageAccess(req: Request, res: Response, next: Function) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    const user = req.user as any;
    const userRole = user.role;
    
    if ([...PACKAGE_WRITE_ROLES, ...PACKAGE_READ_ONLY_ROLES].includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ message: 'No tiene permisos para acceder a esta funcionalidad' });
  }
  
  // Middleware para comprobar permisos de escritura de paqueterías
  function hasPackageWriteAccess(req: Request, res: Response, next: Function) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    const user = req.user as any;
    const userRole = user.role;
    
    if (PACKAGE_WRITE_ROLES.includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ message: 'No tiene permisos para modificar paquetes' });
  }
  
  // GET /api/packages - Obtener lista de paquetes con información del viaje
  app.get(apiRouter('/packages'), isAuthenticated, hasPackageAccess, async (req, res) => {
    try {
      const { user } = req as any;
      const { tripId, date } = req.query;
      
      console.log(`[GET /packages] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Filtrar por compañía para asegurar aislamiento de datos
      const userCompanyId = user.companyId || user.company;
      const filters: any = {};
      
      if (user.role !== UserRole.SUPER_ADMIN) {
        filters.companyId = userCompanyId;
      }
      
      if (tripId && !isNaN(parseInt(tripId as string))) {
        filters.tripId = parseInt(tripId as string);
      }
      
      if (date) {
        filters.date = date as string;
      }
      
      console.log(`[GET /packages] Obteniendo paquetes con información de viaje:`, filters);
      
      // Obtener paquetes CON información del viaje (origen y destino)
      const packages = await storage.getPackagesWithTripInfo(filters, user.id, user.role);
      
      console.log(`[GET /packages] Encontrados ${packages.length} paquetes con información de viaje`);
      res.json(packages);
    } catch (error) {
      console.error('Error al obtener paquetes:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // GET /api/packages/:id - Obtener un paquete específico
  app.get(apiRouter('/packages/:id'), isAuthenticated, hasPackageAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Obtener el paquete
      const packageData = await storage.getPackage(id);
      
      if (!packageData) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar acceso a la compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = req.user.companyId || req.user.company;
        if (packageData.companyId !== userCompanyId) {
          return res.status(403).json({ message: 'No tiene permisos para ver este paquete' });
        }
      }
      
      res.json(packageData);
    } catch (error) {
      console.error(`Error al obtener paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // POST /api/packages - Crear un nuevo paquete
  app.post(apiRouter('/packages'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      // Validar los datos con el esquema
      const packageData = insertPackageSchema.parse(req.body);
      
      // Agregar información del usuario y compañía
      const newPackage = {
        ...packageData,
        createdBy: req.user?.id,
        companyId: req.user?.companyId || req.user?.company,
      };
      
      // Crear el paquete
      const createdPackage = await storage.createPackage(newPackage);
      
      res.status(201).json(createdPackage);
    } catch (error) {
      console.error('Error al crear paquete:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Datos de paquete inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/packages/:id/deliver - Marcar un paquete como entregado
  app.patch(apiRouter('/packages/:id/deliver'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackage(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = req.user.companyId || req.user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Actualizar solo el estado de entrega
      const updatedPackage = await storage.updatePackage(id, {
        deliveryStatus: "entregado",
        updatedAt: new Date()
      });
      
      res.json(updatedPackage);
    } catch (error) {
      console.error('Error al marcar paquete como entregado:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/packages/:id - Actualizar un paquete
  app.patch(apiRouter('/packages/:id'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackage(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = req.user.companyId || req.user.company;
        if (existingPackage.companyId !== userCompanyId) {
          return res.status(403).json({ message: 'No tiene permisos para editar este paquete' });
        }
      }
      
      // Actualizar estado de entrega si corresponde
      if (req.body.deliveryStatus === 'entregado' && existingPackage.deliveryStatus !== 'entregado') {
        // Establecer deliveredAt cuando se marca como entregado
        // Crear fecha en zona horaria de México (UTC-6)
        const now = new Date();
        const mexicoTime = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // UTC-6
        req.body.deliveredAt = mexicoTime;
      }
      
      // Actualizar el paquete
      const updatedPackage = await storage.updatePackage(id, req.body);
      
      res.json(updatedPackage);
    } catch (error) {
      console.error(`Error al actualizar paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // DELETE /api/packages/:id - Eliminar un paquete
  app.delete(apiRouter('/packages/:id'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackage(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = req.user.companyId || req.user.company;
        if (existingPackage.companyId !== userCompanyId) {
          return res.status(403).json({ message: 'No tiene permisos para eliminar este paquete' });
        }
      }
      
      // Eliminar el paquete
      await storage.deletePackage(id);
      
      res.status(204).send();
    } catch (error) {
      console.error(`Error al eliminar paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // GET /api/cash-register - Obtener reservaciones pagadas por el usuario actual
  app.get(apiRouter('/cash-register'), isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      console.log(`[GET /cash-register] Usuario ${user.firstName} ${user.lastName} solicitando datos de caja`);
      
      // Si el usuario es taquillero (tiene acceso a empresas específicas)
      if (user.role === UserRole.TICKET_OFFICE) {
        console.log(`[GET /cash-register] Usuario taquillero: obteniendo compañías asociadas`);
        
        // Obtener las compañías asociadas al usuario de taquilla
        const userCompanyAssociations = await db
          .select()
          .from(userCompanies)
          .where(eq(userCompanies.userId, user.id));
        
        console.log(`[GET /cash-register] Usuario taquillero: ${userCompanyAssociations.length} compañías asociadas`);
        
        if (userCompanyAssociations.length === 0) {
          console.log(`[GET /cash-register] Usuario taquillero sin empresas asociadas: no se mostrarán reservaciones`);
          return res.json([]);
        }
        
        // Obtener todos los IDs de compañías a las que tiene acceso
        const associatedCompanyIds = userCompanyAssociations.map(assoc => assoc.companyId);
        console.log(`[GET /cash-register] IDs de compañías asociadas: ${associatedCompanyIds.join(', ')}`);
        
        // Obtener todas las reservaciones marcadas como pagadas por este taquillero
        const taquilleroReservations = await storage.getPaidReservationsByUser(user.id);
        
        // Filtrar las reservaciones para mostrar solo las de las compañías asociadas
        const filteredReservations = taquilleroReservations.filter(reservation => {
          const tripCompanyId = reservation.trip?.companyId || null;
          return tripCompanyId && associatedCompanyIds.includes(tripCompanyId);
        });
        
        console.log(`[GET /cash-register] Filtrando ${taquilleroReservations.length} reservaciones a ${filteredReservations.length} (solo compañías asociadas)`);
        
        // Agregar información adicional para identificar a qué empresa pertenece cada reserva
        const enrichedReservations = await Promise.all(
          filteredReservations.map(async (reservation) => {
            // Obtener la compañía del viaje
            let companyId = null;
            let companyName = "Desconocida";
            
            if (reservation.trip && reservation.trip.companyId) {
              companyId = reservation.trip.companyId;
              
              // Intentar obtener el nombre de la compañía si está disponible
              try {
                const company = await storage.getCompanyById(companyId);
                if (company) {
                  companyName = company.name || companyId;
                }
              } catch (err) {
                console.error(`Error al obtener información de la compañía ${companyId}:`, err);
              }
            }
            
            return {
              ...reservation,
              companyInfo: {
                id: companyId,
                name: companyName
              }
            };
          })
        );
        
        return res.json(enrichedReservations);
      }
      
      // Si el usuario es dueño o administrador, mostrar todas las reservaciones de la compañía
      if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
        // Obtener ID de la compañía
        const companyId = user.companyId || user.company;
        
        if (!companyId) {
          console.log(`[GET /cash-register] Usuario dueño/admin sin compañía asignada. Usando vista limitada.`);
          const paidReservations = await storage.getPaidReservationsByUser(user.id);
          
          // Agregar información adicional para identificar a qué empresa pertenece cada reserva
          const enrichedReservations = await Promise.all(
            paidReservations.map(async (reservation) => {
              // Obtener la compañía del viaje
              let companyId = null;
              let companyName = "Desconocida";
              
              if (reservation.trip && reservation.trip.companyId) {
                companyId = reservation.trip.companyId;
                
                // Intentar obtener el nombre de la compañía si está disponible
                try {
                  const company = await storage.getCompanyById(companyId);
                  if (company) {
                    companyName = company.name || companyId;
                  }
                } catch (err) {
                  console.error(`Error al obtener información de la compañía ${companyId}:`, err);
                }
              }
              
              return {
                ...reservation,
                companyInfo: {
                  id: companyId,
                  name: companyName
                }
              };
            })
          );
          
          return res.json(enrichedReservations);
        }
        
        console.log(`[GET /cash-register] Usuario dueño/admin: mostrando todas las reservaciones pagadas de la compañía ${companyId}`);
        
        // Modificación: Obtener todas las reservaciones pagadas de su compañía, incluidas las marcadas
        // por taquilleros para viajes de esta compañía
        
        // 1. Obtener reservaciones pagadas por usuarios de la compañía
        const companyUsersReservations = await storage.getPaidReservationsByCompany(companyId);
        
        // 2. Obtener reservaciones pagadas por taquilleros para viajes de esta compañía
        // Primero, buscar todos los usuarios con rol taquilla
        const ticketOfficeUsers = await storage.getUsersByRole(UserRole.TICKET_OFFICE);
        
        // Array para almacenar todas las reservaciones
        let allReservations = [...companyUsersReservations];
        
        // Para cada taquillero, obtener las reservaciones que marcó como pagadas
        for (const ticketOfficeUser of ticketOfficeUsers) {
          const ticketOfficeReservations = await storage.getPaidReservationsByUser(ticketOfficeUser.id);
          
          // Filtrar solo las que pertenecen a la compañía actual
          const companyTicketOfficeReservations = ticketOfficeReservations.filter(
            reservation => reservation.trip && reservation.trip.companyId === companyId
          );
          
          // Agregar las reservaciones al array total
          allReservations = [...allReservations, ...companyTicketOfficeReservations];
        }
        
        // Eliminar duplicados (si un taquillero marcó como pagada una reservación que ya está incluida)
        const uniqueReservations = allReservations.filter((reservation, index, self) => 
          self.findIndex(r => r.id === reservation.id) === index
        );
        
        // Agregar información adicional para identificar a qué empresa pertenece cada reserva
        const enrichedReservations = await Promise.all(
          uniqueReservations.map(async (reservation) => {
            // Obtener la compañía del viaje
            let companyId = null;
            let companyName = "Desconocida";
            
            if (reservation.trip && reservation.trip.companyId) {
              companyId = reservation.trip.companyId;
              
              // Intentar obtener el nombre de la compañía si está disponible
              try {
                const company = await storage.getCompanyById(companyId);
                if (company) {
                  companyName = company.name || companyId;
                }
              } catch (err) {
                console.error(`Error al obtener información de la compañía ${companyId}:`, err);
              }
            }
            
            return {
              ...reservation,
              companyInfo: {
                id: companyId,
                name: companyName
              }
            };
          })
        );
        
        return res.json(enrichedReservations);
      }
      
      // Para otros roles, mostrar solo sus propias reservaciones
      const paidReservations = await storage.getPaidReservationsByUser(user.id);
      
      // Agregar información adicional para identificar a qué empresa pertenece cada reserva
      const enrichedReservations = await Promise.all(
        paidReservations.map(async (reservation) => {
          // Obtener la compañía del viaje
          let companyId = null;
          let companyName = "Desconocida";
          
          if (reservation.trip && reservation.trip.companyId) {
            companyId = reservation.trip.companyId;
            
            // Intentar obtener el nombre de la compañía si está disponible
            try {
              const company = await storage.getCompanyById(companyId);
              if (company) {
                companyName = company.name || companyId;
              }
            } catch (err) {
              console.error(`Error al obtener información de la compañía ${companyId}:`, err);
            }
          }
          
          return {
            ...reservation,
            companyInfo: {
              id: companyId,
              name: companyName
            }
          };
        })
      );
      
      console.log(`[GET /cash-register] Enviando ${enrichedReservations.length} reservaciones pagadas por el usuario ${user.id}`);
      return res.json(enrichedReservations);
    } catch (error) {
      console.error('[GET /cash-register] Error:', error);
      res.status(500).json({ message: 'Error al cargar datos de caja' });
    }
  });
  
  // Endpoint para obtener todas las empresas registradas
  // Endpoint específico para obtener compañías para transferencia de pasajeros
  app.get(apiRouter('/companies/transfer'), isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      console.log(`[GET /companies/transfer] Usuario ${user.firstName} ${user.lastName} solicitando lista de empresas para transferencia`);
      
      // Verificar que el usuario tenga permisos (Admin o Dueño o SuperAdmin)
      if (![UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN].includes(user.role)) {
        console.log(`[GET /companies/transfer] Acceso denegado para usuario con rol ${user.role}`);
        return res.status(403).json({ message: "No tiene permisos para esta operación" });
      }
      
      // Obtener todas las empresas desde la base de datos
      let companiesList = await db.select().from(companies);
      console.log(`[GET /companies/transfer] Encontradas ${companiesList.length} empresas en total`);
      
      // Para Owner y Admin, mostrar todas las compañías excepto la propia
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        if (userCompanyId) {
          companiesList = companiesList.filter(company => company.identifier !== userCompanyId);
          console.log(`[GET /companies/transfer] Filtrando a ${companiesList.length} empresas (excluyendo la propia: ${userCompanyId})`);
        }
      }
      
      // No filtrar por estado, mostrar todas las empresas disponibles
      // Si en el futuro se necesita filtrar por estado, podemos habilitarlo nuevamente
      
      console.log(`[GET /companies/transfer] Devolviendo ${companiesList.length} empresas para transferencia`);
      return res.json(companiesList);
    } catch (error) {
      console.error(`[GET /companies/transfer] Error: ${error}`);
      res.status(500).json({ message: "Error al obtener empresas" });
    }
  });

  app.get(apiRouter('/companies'), isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      console.log(`[GET /companies] Usuario ${user.firstName} ${user.lastName} solicitando lista de empresas`);
      
      // Obtener todas las empresas desde la base de datos
      let allCompanies = await db.select().from(companies);
      console.log(`[GET /companies] Encontradas ${allCompanies.length} empresas en total`);
      
      // Filtrar según el rol del usuario
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Para Owner y Admin, solo mostrar su propia compañía si no son ellos quienes están transfiriendo
        if ((user.role === UserRole.OWNER || user.role === UserRole.ADMIN) && 
            req.query.forTransfer === 'true') {
          // Para transferencias, mostrar todas las compañías excepto la propia
          const userCompanyId = user.companyId || user.company;
          if (userCompanyId) {
            allCompanies = allCompanies.filter(company => company.identifier !== userCompanyId);
            console.log(`[GET /companies] Filtradas para transferencia: ${allCompanies.length} empresas (excluyendo ${userCompanyId})`);
          }
        } else if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
          // Para otros casos, solo mostrar su propia compañía
          const userCompanyId = user.companyId || user.company;
          if (userCompanyId) {
            allCompanies = allCompanies.filter(company => company.identifier === userCompanyId);
          }
        }
        
        // Para taquilleros, mostrar solo las compañías asignadas
        if (user.role === UserRole.TICKET_OFFICE) {
          // Obtener las asignaciones de compañías para este taquillero
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          const assignedCompanyIds = userCompanyAssociations.map(uc => uc.companyId);
          allCompanies = allCompanies.filter(company => assignedCompanyIds.includes(company.identifier));
          console.log(`[GET /companies] Taquillero: ${allCompanies.length} empresas asignadas`);
        }
      }
      
      // Devolver las empresas filtradas
      return res.json(allCompanies);
    } catch (error) {
      console.error('[GET /companies] Error:', error);
      return res.status(500).json({ message: 'Error al obtener lista de empresas' });
    }
  });

  // Ruta para obtener transacciones del usuario actual que no están en un corte
  app.get(apiRouter("/transactions/current"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      // Filtrar transacciones del usuario actual que no están en un corte de caja
      const filters = {
        user_id: user.id,  // Usar el nombre correcto que coincide con la BD
        cutoff_id: null // Usar el nombre correcto que coincide con la BD
      };
      
      const transacciones = await storage.getTransacciones(filters);
      console.log(`[GET /transactions/current] Encontradas ${transacciones.length} transacciones para usuario ${user.id}`);
      
      res.json(transacciones);
    } catch (error) {
      console.error("Error al obtener transacciones actuales:", error);
      res.status(500).json({ error: "Error al obtener transacciones actuales" });
    }
  });
  
  // Ruta para obtener el historial de cortes de caja del usuario actual
  app.get(apiRouter("/transactions/cutoff-history"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const { period } = req.query;
      
      console.log(`[GET /transactions/cutoff-history] Solicitando historial de transacciones para usuario ${user.id}, período: ${period || 'todos'}, compañía: ${user.companyId || user.company || 'no definida'}`);
      
      // Preparar filtros
      const filters: any = {
        user_id: user.id,
        // Solo queremos transacciones que YA están asociadas a un corte (cutoff_id NO es NULL)
        cutoff_id_not_null: true
      };
      
      // Aplicar filtro de período si se especifica
      if (period) {
        const now = new Date();
        let startDate: Date | undefined;
        
        // Calcular la fecha de inicio según el período
        if (period === 'week') {
          // Última semana
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          console.log(`[GET /transactions/cutoff-history] Filtrando por última semana desde ${startDate.toISOString()}`);
          filters.startDate = startDate;
        } else if (period === 'month') {
          // Último mes
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          console.log(`[GET /transactions/cutoff-history] Filtrando por último mes desde ${startDate.toISOString()}`);
          filters.startDate = startDate;
        }
      }
      
      // Obtener transacciones del historial
      const transacciones = await storage.getTransacciones(filters);
      
      console.log(`[GET /transactions/cutoff-history] Encontradas ${transacciones.length} transacciones históricas para usuario ${user.id}`);
      
      res.json(transacciones);
    } catch (error) {
      console.error("[GET /transactions/cutoff-history] Error:", error);
      res.status(500).json({ error: "Error al obtener historial de transacciones" });
    }
  });

  // Endpoint para obtener transacciones de otros usuarios de la misma compañía
  app.get(apiRouter("/transactions/user-cash-boxes"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      if (!user.companyId) {
        return res.status(400).json({ error: "Usuario sin compañía asignada" });
      }
      
      console.log(`[GET /transactions/user-cash-boxes] Solicitando transacciones con información de usuarios para compañía ${user.companyId}, usuario actual: ${user.id}`);
      
      // Obtener transacciones con información del usuario mediante JOIN
      // - user_id sea diferente al usuario actual
      // - company_id sea igual a la compañía del usuario actual
      const transaccionesConUsuarios = await storage.getUserCashBoxes(user.id, user.companyId);
      
      console.log(`[GET /transactions/user-cash-boxes] Encontradas ${transaccionesConUsuarios.length} transacciones con información de usuarios para compañía ${user.companyId}`);
      
      res.json(transaccionesConUsuarios);
    } catch (error) {
      console.error("[GET /transactions/user-cash-boxes] Error:", error);
      res.status(500).json({ error: "Failed to fetch user cash box transactions" });
    }
  });

  // Ruta para crear un nuevo corte de caja
  app.post(apiRouter("/box/cutoff"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { companyFilter } = req.body || {};
      
      console.log(`[POST /box/cutoff] Request body:`, req.body);
      console.log(`[POST /box/cutoff] Usuario: ${user?.firstName} ${user?.lastName}, Rol: ${user?.role}`);
      console.log(`[POST /box/cutoff] CompanyFilter recibido:`, companyFilter);
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      // Obtener transacciones sin corte (cutoff_id es NULL)
      const filters: any = { 
        user_id: user.id,
        cutoff_id: null
      };

      // Si es un usuario taquilla y especifica un filtro de empresa, aplicarlo
      if (user.role === "taquilla" && companyFilter) {
        filters.companyId = companyFilter;
        console.log(`[POST /box/cutoff] Usuario taquilla filtrando por empresa: ${companyFilter}`);
      }
      
      console.log(`[POST /box/cutoff] Filtros aplicados:`, filters);
      const transacciones = await storage.getTransacciones(filters);

      if (transacciones.length === 0) {
        return res.status(400).json({ error: "No hay transacciones para realizar el corte" });
      }

      console.log(`[POST /box/cutoff] Procesando ${transacciones.length} transacciones para el corte de usuario ${user.id}`);
      
      // Calcular totales
      let totalIngresos = 0;
      let totalEfectivo = 0;
      let totalTransferencias = 0;
      let fechaInicio = new Date();
      
      // Buscar la fecha más antigua
      transacciones.forEach(transaction => {
        const createdAt = new Date(transaction.createdAt);
        if (createdAt < fechaInicio) {
          fechaInicio = createdAt;
        }
        
        const details = transaction.details?.details || {};
        const amount = details.monto || 0;
        totalIngresos += amount;
        
        if (details.metodoPago === "efectivo") {
          totalEfectivo += amount;
        } else if (details.metodoPago === "transferencia") {
          totalTransferencias += amount;
        }
      });
      
      // Fecha actual para el fin del corte
      const fechaFin = new Date();
      
      // Crear el registro de corte
      const cutoff = await storage.createBoxCutoff({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        total_ingresos: totalIngresos,
        total_efectivo: totalEfectivo,
        total_transferencias: totalTransferencias,
        user_id: user.id,
        // Para usuarios taquilla, usar la empresa filtrada; para otros, usar su companyId
        companyId: (user.role === "taquilla" && companyFilter) ? companyFilter : (user.companyId || null)
      });
      
      console.log(`[POST /box/cutoff] Corte creado con ID: ${cutoff.id}`);
      
      // Actualizar las transacciones con el ID del corte
      // IMPORTANTE: Usando el método mejorado que verifica el usuario
      let actualizacionesExitosas = 0;
      for (const transaction of transacciones) {
        const actualizada = await storage.updateTransaccion(transaction.id, {
          cutoff_id: cutoff.id
        }, user.id); // Pasamos el user.id para asegurar que solo se actualicen transacciones del usuario actual
        
        if (actualizada) {
          actualizacionesExitosas++;
        }
      }
      
      // Usar la variable de actualizacionesExitosas para reportar las transacciones realmente actualizadas
      console.log(`[POST /box/cutoff] Actualizadas ${actualizacionesExitosas} transacciones con ID de corte ${cutoff.id}`);
      
      return res.json({ 
        message: "Corte realizado con éxito", 
        cutoff,
        transactionCount: transacciones.length
      });
    } catch (error) {
      console.error("Error al realizar corte de caja:", error);
      return res.status(500).json({ error: "Error al realizar corte de caja" });
    }
  });

  // Test endpoint for optimization validation (temporary)
  app.get('/api/test-optimization', async (req, res) => {
    console.log(`[GET /api/test-optimization] ENDPOINT DE PRUEBA INICIADO`);
    
    try {
      const optimizedResponse = req.query.optimizedResponse === 'true';
      console.log(`[GET /api/test-optimization] optimizedResponse: ${optimizedResponse}`);
      
      const trips = await storage.searchTrips({
        includeAllVisibilities: true,
        optimizedResponse: optimizedResponse
      });
      
      const responseSize = JSON.stringify(trips).length;
      
      res.json({
        mode: optimizedResponse ? 'OPTIMIZADO' : 'EXPANDIDO',
        tripCount: trips.length,
        responseSize: responseSize,
        sampleTrip: trips[0] || null,
        sampleKeys: trips[0] ? Object.keys(trips[0]) : []
      });
    } catch (error) {
      console.error(`[GET /api/test-optimization] Error:`, error);
      res.status(500).json({ error: 'Error en prueba de optimización' });
    }
  });

  // Endpoint temporal para limpiar cache
  app.delete(apiRouter("/cache/clear"), async (req: Request, res: Response) => {
    try {
      serverTripCache.invalidateAll();
      res.json({ message: "Cache limpiado exitosamente" });
    } catch (error) {
      console.error("Error al limpiar cache:", error);
      res.status(500).json({ error: "Error al limpiar cache" });
    }
  });

  // Endpoint para estadísticas de uso de cupones
  app.get(apiRouter("/statistics/coupon-usage"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /statistics/coupon-usage] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver estadísticas (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver estadísticas" 
        });
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return res.status(400).json({ 
          error: "Compañía no definida", 
          details: "Usuario sin compañía asignada" 
        });
      }
      
      // Obtener parámetros de fecha
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      console.log(`[GET /statistics/coupon-usage] Obteniendo estadísticas para compañía: ${companyId}, fechas: ${startDate} - ${endDate}`);
      
      const statistics = await storage.getCouponUsageStatistics(companyId, startDate, endDate);
      
      console.log(`[GET /statistics/coupon-usage] Encontradas ${statistics.length} estadísticas de cupones`);
      
      res.json(statistics);
    } catch (error: any) {
      console.error("[GET /statistics/coupon-usage] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener estadísticas de cupones",
        details: error.message 
      });
    }
  });

  // Endpoint para estadísticas de rutas más concurridas
  app.get(apiRouter("/statistics/popular-routes"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /statistics/popular-routes] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver estadísticas (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver estadísticas" 
        });
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return res.status(400).json({ 
          error: "Compañía no definida", 
          details: "Usuario sin compañía asignada" 
        });
      }
      
      // Obtener parámetros de fecha
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      console.log(`[GET /statistics/popular-routes] Obteniendo estadísticas para compañía: ${companyId}, fechas: ${startDate} - ${endDate}`);
      
      const statistics = await storage.getPopularRoutesStatistics(companyId, startDate, endDate);
      
      console.log(`[GET /statistics/popular-routes] Encontradas ${statistics.length} estadísticas de rutas`);
      
      res.json(statistics);
    } catch (error: any) {
      console.error("[GET /statistics/popular-routes] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener estadísticas de rutas",
        details: error.message 
      });
    }
  });

  // Endpoint para estadísticas de ingreso de pasajeros
  app.get(apiRouter("/statistics/passenger-intake"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /statistics/passenger-intake] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver estadísticas (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver estadísticas" 
        });
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return res.status(400).json({ 
          error: "Compañía no definida", 
          details: "Usuario sin compañía asignada" 
        });
      }
      
      // Obtener parámetros de fecha
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      console.log(`[GET /statistics/passenger-intake] Obteniendo estadísticas para compañía: ${companyId}, fechas: ${startDate} - ${endDate}`);
      
      const statistics = await storage.getPassengerIntakeStatistics(companyId, startDate, endDate);
      
      console.log(`[GET /statistics/passenger-intake] Encontradas ${statistics.length} estadísticas de ingreso`);
      
      res.json(statistics);
    } catch (error: any) {
      console.error("[GET /statistics/passenger-intake] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener estadísticas de ingreso de pasajeros",
        details: error.message 
      });
    }
  });

  // Endpoint para obtener usuarios que tienen transacciones en la compañía
  app.get(apiRouter("/transaction-users"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /transaction-users] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver usuarios con transacciones (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver usuarios con transacciones" 
        });
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return res.status(400).json({ 
          error: "Compañía no definida", 
          details: "Usuario sin compañía asignada" 
        });
      }
      
      console.log(`[GET /transaction-users] Obteniendo usuarios con transacciones para compañía: ${companyId}`);
      
      const users = await storage.getUsersWithTransactions(companyId);
      
      console.log(`[GET /transaction-users] Encontrados ${users.length} usuarios con transacciones`);
      
      res.json(users);
    } catch (error: any) {
      console.error("[GET /transaction-users] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener usuarios con transacciones",
        details: error.message 
      });
    }
  });

  // Endpoint para el historial de transacciones
  app.get(apiRouter("/transaction-history"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /transaction-history] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver historial de transacciones (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver el historial de transacciones" 
        });
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return res.status(400).json({ 
          error: "Compañía no definida", 
          details: "Usuario sin compañía asignada" 
        });
      }
      
      // Obtener parámetros de filtros
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const cutoffId = req.query.cutoffId ? parseInt(req.query.cutoffId as string) : undefined;
      
      console.log(`[GET /transaction-history] Obteniendo historial para compañía: ${companyId}, filtros:`, {
        startDate, endDate, userId, cutoffId
      });
      
      const transactionHistory = await storage.getTransactionHistory({
        companyId,
        startDate,
        endDate,
        userId,
        cutoffId
      });
      
      console.log(`[GET /transaction-history] Encontradas ${transactionHistory.length} transacciones`);
      
      res.json(transactionHistory);
    } catch (error: any) {
      console.error("[GET /transaction-history] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener historial de transacciones",
        details: error.message 
      });
    }
  });

  // Endpoint para obtener cortes pendientes de confirmación
  app.get(apiRouter("/cutoffs/pending"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /cutoffs/pending] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver cortes pendientes (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver cortes pendientes" 
        });
      }
      
      const companyId = user.companyId || user.company;
      const filterDate = req.query.date as string;
      
      console.log(`[GET /cutoffs/pending] Obteniendo cortes pendientes para compañía: ${companyId}${filterDate ? `, fecha: ${filterDate}` : ''}`);
      
      const pendingCutoffs = await storage.getPendingBoxCutoffs(companyId, filterDate);
      
      console.log(`[GET /cutoffs/pending] Encontrados ${pendingCutoffs.length} cortes pendientes`);
      
      res.json(pendingCutoffs);
    } catch (error: any) {
      console.error("[GET /cutoffs/pending] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener cortes pendientes",
        details: error.message 
      });
    }
  });

  // Endpoint para obtener información de un corte específico
  app.get(apiRouter("/cutoffs/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /cutoffs/:id] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver cortes (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver cortes" 
        });
      }
      
      const cutoffId = parseInt(req.params.id);
      
      console.log(`[GET /cutoffs/:id] Obteniendo corte con ID: ${cutoffId}`);
      
      const cutoff = await storage.getBoxCutoff(cutoffId);
      
      if (!cutoff) {
        return res.status(404).json({ error: "Corte no encontrado" });
      }
      
      console.log(`[GET /cutoffs/:id] Corte encontrado: ${cutoff.id}`);
      
      res.json(cutoff);
    } catch (error: any) {
      console.error("[GET /cutoffs/:id] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener corte",
        details: error.message 
      });
    }
  });

  // Endpoint para obtener transacciones de un corte específico
  app.get(apiRouter("/cutoffs/:id/transactions"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[GET /cutoffs/:id/transactions] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para ver transacciones de cortes (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden ver transacciones de cortes" 
        });
      }
      
      const cutoffId = parseInt(req.params.id);
      
      console.log(`[GET /cutoffs/:id/transactions] Obteniendo transacciones para corte: ${cutoffId}`);
      
      const transactions = await storage.getBoxCutoffTransactions(cutoffId);
      
      console.log(`[GET /cutoffs/:id/transactions] Encontradas ${transactions.length} transacciones`);
      
      res.json(transactions);
    } catch (error: any) {
      console.error("[GET /cutoffs/:id/transactions] Error:", error);
      res.status(500).json({ 
        error: "Error al obtener transacciones del corte",
        details: error.message 
      });
    }
  });

  // Endpoint para confirmar un corte
  app.post(apiRouter("/cutoffs/:id/confirm"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[POST /cutoffs/:id/confirm] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para confirmar cortes (solo dueño y admin)
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños y administradores pueden confirmar cortes" 
        });
      }
      
      const cutoffId = parseInt(req.params.id);
      
      console.log(`[POST /cutoffs/:id/confirm] Confirmando corte: ${cutoffId} por usuario: ${user.id}`);
      
      // Verificar que el corte existe
      const cutoff = await storage.getBoxCutoff(cutoffId);
      if (!cutoff) {
        return res.status(404).json({ error: "Corte no encontrado" });
      }
      
      // Verificar que el corte no esté ya confirmado
      if (cutoff.check) {
        return res.status(400).json({ error: "Este corte ya está confirmado" });
      }
      
      const confirmedCutoff = await storage.confirmBoxCutoff(cutoffId, user.id);
      
      if (!confirmedCutoff) {
        return res.status(500).json({ error: "Error al confirmar el corte" });
      }
      
      console.log(`[POST /cutoffs/:id/confirm] Corte ${cutoffId} confirmado exitosamente`);
      
      res.json({ 
        message: "Corte confirmado exitosamente",
        cutoff: confirmedCutoff 
      });
    } catch (error: any) {
      console.error("[POST /cutoffs/:id/confirm] Error:", error);
      res.status(500).json({ 
        error: "Error al confirmar corte",
        details: error.message 
      });
    }
  });

  // PASSENGER TRANSFER ENDPOINT
  app.post(apiRouter("/reservations/transfer"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      console.log(`[POST /reservations/transfer] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar que el usuario tenga permisos para transferir pasajeros
      if (user.role !== UserRole.OWNER && 
          user.role !== UserRole.ADMIN && 
          user.role !== UserRole.CALL_CENTER &&
          user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "Solo los dueños, administradores y call center pueden transferir pasajeros" 
        });
      }

      const transferSchema = z.object({
        transfers: z.array(z.object({
          id: z.string(),
          reservationId: z.number(),
          passengerName: z.string(),
          seats: z.number(),
          tripId: z.number(),
          originalTripId: z.number()
        }))
      });

      const { transfers } = transferSchema.parse(req.body);
      
      if (transfers.length === 0) {
        return res.status(400).json({ error: "No se especificaron transferencias" });
      }

      console.log(`[POST /reservations/transfer] Procesando ${transfers.length} transferencias`);

      // Procesar cada transferencia
      for (const transfer of transfers) {
        console.log(`[TRANSFER] Moviendo reserva ${transfer.reservationId} del viaje ${transfer.originalTripId} al viaje ${transfer.tripId}`);
        
        // Obtener la reserva original
        const reservation = await storage.getReservation(transfer.reservationId);
        if (!reservation) {
          console.error(`[TRANSFER] Reserva ${transfer.reservationId} no encontrada`);
          return res.status(404).json({ error: `Reserva ${transfer.reservationId} no encontrada` });
        }

        // Verificar capacidad en el viaje destino
        const destinationTrip = await storage.getTrip(transfer.tripId);
        if (!destinationTrip) {
          return res.status(404).json({ error: `Viaje destino ${transfer.tripId} no encontrado` });
        }

        // Obtener reservas actuales del viaje destino para calcular asientos disponibles
        const destinationReservations = await storage.getReservationsByTrip(transfer.tripId);
        const occupiedSeats = destinationReservations.reduce((sum, res) => sum + res.passengers.length, 0);
        const availableSeats = destinationTrip.capacity - occupiedSeats;

        if (transfer.seats > availableSeats) {
          return res.status(400).json({ 
            error: `Capacidad insuficiente en viaje destino. Disponibles: ${availableSeats}, Requeridos: ${transfer.seats}` 
          });
        }

        // Actualizar la reserva con el nuevo viaje
        const tripDetails = typeof reservation.tripDetails === 'string' 
          ? JSON.parse(reservation.tripDetails) 
          : reservation.tripDetails;

        // Actualizar tripDetails con el nuevo viaje
        const updatedTripDetails = {
          ...tripDetails,
          recordId: transfer.tripId,
          tripId: transfer.tripId.toString()
        };

        // Actualizar la reserva en la base de datos
        await db
          .update(schema.reservations)
          .set({
            tripDetails: JSON.stringify(updatedTripDetails),
            notes: `${reservation.notes || ''}\n[TRANSFERIDO] Movido del viaje ${transfer.originalTripId} al viaje ${transfer.tripId} por ${user.firstName} ${user.lastName}`.trim()
          })
          .where(eq(schema.reservations.id, transfer.reservationId));

        console.log(`[TRANSFER] Reserva ${transfer.reservationId} transferida exitosamente al viaje ${transfer.tripId}`);
      }

      // Invalidar caché de viajes para reflejar los cambios
      serverTripCache.clear();

      // Notificar via WebSocket si está disponible
      if (wss) {
        const message = JSON.stringify({
          type: 'PASSENGER_TRANSFER',
          data: {
            transfers: transfers.map(t => ({
              reservationId: t.reservationId,
              fromTrip: t.originalTripId,
              toTrip: t.tripId,
              seats: t.seats
            })),
            transferredBy: {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`
            },
            timestamp: new Date().toISOString()
          }
        });

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json({ 
        message: "Transferencias completadas exitosamente",
        transferredCount: transfers.length,
        transfers: transfers.map(t => ({
          reservationId: t.reservationId,
          fromTrip: t.originalTripId,
          toTrip: t.tripId,
          seats: t.seats
        }))
      });

    } catch (error: any) {
      console.error("[POST /reservations/transfer] Error:", error);
      res.status(500).json({ 
        error: "Error al transferir pasajeros",
        details: error.message 
      });
    }
  });

  // Ruta para obtener línea de tiempo del operador - Solo admin y dueño
  app.get("/api/operator-timeline", async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      // Verificar autenticación
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo admin y dueño pueden acceder
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER && user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "No tienes permisos para acceder a esta función" });
      }
      
      const { operatorId, startDate, endDate } = req.query;
      
      // Validar parámetros requeridos
      if (!operatorId || !startDate || !endDate) {
        return res.status(400).json({ 
          message: "Parámetros requeridos: operatorId, startDate, endDate" 
        });
      }
      
      console.log(`[GET /api/operator-timeline] Usuario: ${user.firstName} ${user.lastName}, Operador: ${operatorId}, Rango: ${startDate} - ${endDate}`);
      
      // Convertir fechas
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0); // Asegurar que comience al inicio del día
      
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999); // Incluir todo el día final
      
      console.log(`[GET /api/operator-timeline] Buscando desde: ${start.toISOString()} hasta: ${end.toISOString()}`);
      
      // Obtener compañía del usuario para filtrado
      const userCompany = user.companyId || user.company;
      
      // Obtener viajes del operador en el rango de fechas
      const operatorIdNum = parseInt(operatorId as string);
      const tripConditions = [
        eq(schema.trips.driverId, operatorIdNum),
        gte(schema.trips.departureDate, start.toISOString().split('T')[0]),
        lte(schema.trips.departureDate, end.toISOString().split('T')[0])
      ];
      
      // Agregar filtro de compañía si no es superadmin
      if (user.role !== UserRole.SUPER_ADMIN && userCompany) {
        tripConditions.push(eq(schema.trips.companyId, userCompany));
      }
      
      const trips = await db
        .select()
        .from(schema.trips)
        .where(and(...tripConditions))
        .orderBy(desc(schema.trips.departureDate));
      
      console.log(`[GET /api/operator-timeline] Encontrados ${trips.length} viajes`);
      
      // Obtener transacciones del operador en el rango de fechas
      const transactionConditions = [
        eq(schema.transacciones.user_id, operatorIdNum),
        gte(schema.transacciones.createdAt, start),
        lte(schema.transacciones.createdAt, end)
      ];
      
      // Agregar filtro de compañía para transacciones si no es superadmin
      if (user.role !== UserRole.SUPER_ADMIN && userCompany) {
        transactionConditions.push(eq(schema.transacciones.companyId, userCompany));
      }
      
      const transactions = await db
        .select()
        .from(schema.transacciones)
        .where(and(...transactionConditions))
        .orderBy(desc(schema.transacciones.createdAt));
      
      console.log(`[GET /api/operator-timeline] Encontradas ${transactions.length} transacciones`);
      
      // Formatear datos para el frontend
      const formattedTrips = trips.map(trip => ({
        id: trip.id,
        origin: typeof trip.tripData === 'string' 
          ? JSON.parse(trip.tripData)[0]?.origin || 'Origen no disponible'
          : trip.tripData[0]?.origin || 'Origen no disponible',
        destination: typeof trip.tripData === 'string'
          ? JSON.parse(trip.tripData)[JSON.parse(trip.tripData).length - 1]?.destination || 'Destino no disponible'
          : trip.tripData[trip.tripData.length - 1]?.destination || 'Destino no disponible',
        departureDate: trip.departureDate,
        departureTime: typeof trip.tripData === 'string'
          ? JSON.parse(trip.tripData)[0]?.departureTime || 'Hora no disponible'
          : trip.tripData[0]?.departureTime || 'Hora no disponible',
        driverId: trip.driverId,
        companyId: trip.companyId
      }));
      
      const formattedTransactions = transactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.source || 'general',
        description: transaction.description || 'Sin descripción',
        createdAt: transaction.createdAt,
        createdBy: transaction.user_id,
        tripId: transaction.trip_record_id?.toString() || 'Sin viaje asociado'
      }));
      
      res.json({
        trips: formattedTrips,
        transactions: formattedTransactions,
        totalCount: formattedTrips.length + formattedTransactions.length
      });
      
    } catch (error) {
      console.error("Error al obtener línea de tiempo del operador:", error);
      res.status(500).json({ message: "Error al obtener datos de línea de tiempo" });
    }
  });
}
