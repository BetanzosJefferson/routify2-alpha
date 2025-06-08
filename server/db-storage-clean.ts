import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, or, sql, desc, asc, like, gte, lte, inArray } from "drizzle-orm";
import type { 
  User, InsertUser, Route, InsertRoute, Trip, InsertTrip, 
  TripWithRouteInfo, Reservation, InsertReservation, Passenger, 
  InsertPassenger, Vehicle, InsertVehicle, Commission, InsertCommission,
  Notification, InsertNotification, Coupon, InsertCoupon, TripBudget,
  InsertTripBudget, TripExpense, InsertTripExpense, RouteWithSegments
} from "@shared/schema";

export interface IStorage {
  // Métodos existentes...
  updateRelatedTripsAvailability(recordId: number, tripId: string, seatChange: number): Promise<void>;
  // ... otros métodos
}

export class DatabaseStorage implements IStorage {
  
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
    
    // Clonar el array tripData para modificarlo
    const updatedTripData = [...tripRecord.tripData];
    
    // Actualizar todos los segmentos que se superponen con el reservado
    for (let i = 0; i < updatedTripData.length; i++) {
      const segment = updatedTripData[i];
      
      // Verificar si este segmento se superpone con el segmento reservado
      const hasOverlap = await this.checkTripSegmentsOverlap(
        reservedSegment.origin, reservedSegment.destination,
        segment.origin, segment.destination,
        tripRecord // Pasar el registro completo para obtener la ruta
      );
      
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

  // Función auxiliar para verificar superposición entre segmentos de viaje usando origen y destino
  private async checkTripSegmentsOverlap(
    reservedOrigin: string,
    reservedDestination: string,
    segmentOrigin: string,
    segmentDestination: string,
    tripRecord: any
  ): Promise<boolean> {
    // Obtener información de la ruta para determinar el orden de las paradas
    const routeInfo = await this.getRouteWithSegments(tripRecord.routeId);
    if (!routeInfo) return false;
    
    // Crear array con todas las paradas en orden
    const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
    
    // Encontrar índices de las ubicaciones
    const reservedOriginIdx = allStops.indexOf(reservedOrigin);
    const reservedDestinationIdx = allStops.indexOf(reservedDestination);
    const segmentOriginIdx = allStops.indexOf(segmentOrigin);
    const segmentDestinationIdx = allStops.indexOf(segmentDestination);
    
    // Si no se encuentran las ubicaciones, no hay superposición
    if (reservedOriginIdx === -1 || reservedDestinationIdx === -1 || 
        segmentOriginIdx === -1 || segmentDestinationIdx === -1) {
      return false;
    }
    
    // Verificar superposición: los segmentos se superponen si uno comienza antes de que termine el otro
    return this.checkSegmentsOverlap(
      reservedOriginIdx, reservedDestinationIdx,
      segmentOriginIdx, segmentDestinationIdx
    );
  }

  // Función auxiliar para verificar superposición entre dos segmentos usando índices
  private checkSegmentsOverlap(
    segment1OriginIdx: number,
    segment1DestinationIdx: number,
    segment2OriginIdx: number,
    segment2DestinationIdx: number
  ): boolean {
    // Los segmentos se superponen si uno comienza antes de que termine el otro
    // y termina después de que el otro comienza.
    return segment1OriginIdx < segment2DestinationIdx && segment1DestinationIdx > segment2OriginIdx;
  }

  // Métodos placeholder - estos deben implementarse con el resto de la lógica
  async getTrip(id: number): Promise<any> {
    // Implementación placeholder
    return null;
  }

  async getRouteWithSegments(id: number): Promise<any> {
    // Implementación placeholder
    return null;
  }
}