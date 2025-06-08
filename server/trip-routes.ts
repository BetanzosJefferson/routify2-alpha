import { Router, Request, Response } from "express";
import { storage } from "./storage";

const router = Router();

// GET /api/trips - Obtener viajes
router.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const { 
      startDate, 
      endDate, 
      routeId, 
      origin, 
      destination, 
      parentTripsOnly = 'true',
      limit = '50',
      offset = '0'
    } = req.query;

    console.log(`[GET /trips] Usuario: ${req.user?.firstName} ${req.user?.lastName}, Compañía: ${req.user?.company}`);

    const companyId = req.user.company;
    if (!companyId) {
      return res.status(400).json({ message: "Usuario sin compañía asignada" });
    }

    const trips = await storage.getTrips(companyId);
    res.json(trips);
  } catch (error) {
    console.error("Error getting trips:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// GET /api/trips/:id - Obtener viaje por ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const id = parseInt(req.params.id);
    const trip = await storage.getTrip(id);
    
    if (!trip) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    // Check if user has access to this trip (same company)
    if (trip.companyId !== req.user.company) {
      return res.status(403).json({ message: "No autorizado para ver este viaje" });
    }

    res.json(trip);
  } catch (error) {
    console.error("Error getting trip:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// POST /api/trips - Crear viaje (usa la lógica existente del sistema)
router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (!["dueño", "admin", "superAdmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    console.log(`[POST /trips] Usuario: ${req.user?.firstName} ${req.user?.lastName}, Rol: ${req.user?.role}`);
    console.log(`[POST /trips] CREANDO VIAJE PARA COMPAÑÍA: ${req.user?.company}`);

    // La lógica de creación de viajes ya existe en el sistema principal
    // Este endpoint redirige a la funcionalidad existente
    res.status(501).json({ 
      message: "Usar endpoint principal /api/trips en routes.ts",
      redirect: "Use the main trip creation endpoint" 
    });
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// PUT /api/trips/:id - Actualizar viaje
router.put("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (!["dueño", "admin", "superAdmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const id = parseInt(req.params.id);
    const existingTrip = await storage.getTrip(id);
    
    if (!existingTrip) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    // Check if user has access to this trip (same company)
    if (existingTrip.companyId !== req.user.company) {
      return res.status(403).json({ message: "No autorizado para modificar este viaje" });
    }

    const updatedTrip = await storage.updateTrip(id, req.body);
    res.json(updatedTrip);
  } catch (error) {
    console.error("Error updating trip:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// DELETE /api/trips/:id - Eliminar viaje
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (!["dueño", "admin", "superAdmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const id = parseInt(req.params.id);
    const existingTrip = await storage.getTrip(id);
    
    if (!existingTrip) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    // Check if user has access to this trip (same company)
    if (existingTrip.companyId !== req.user.company) {
      return res.status(403).json({ message: "No autorizado para eliminar este viaje" });
    }

    await storage.deleteTrip(id);
    res.json({ message: "Viaje eliminado exitosamente" });
  } catch (error) {
    console.error("Error deleting trip:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;