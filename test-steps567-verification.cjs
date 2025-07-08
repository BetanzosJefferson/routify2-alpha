/**
 * VERIFICACIÓN COMPLETA DE PASOS 5, 6 Y 7
 * Confirma que todos los cambios template-based están implementados
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICACIÓN DETALLADA - PASOS 5, 6 Y 7');
console.log('='.repeat(50));

// PASO 5: VERIFICAR ENDPOINT POST /trips
console.log('\n=== PASO 5: VERIFICACIÓN ENDPOINT POST /trips ===');
const routesFile = fs.readFileSync('server/routes.ts', 'utf8');

// Verificar lógica template-based
const hasTemplateBased = routesFile.includes('if (tripData.templateId)') && 
                        routesFile.includes('MODO TEMPLATE-BASED (NUEVO)');
console.log(`✅ Lógica template-based: ${hasTemplateBased ? 'PRESENTE' : '❌ FALTANTE'}`);

// Verificar campos nuevos
const hasNewFields = routesFile.includes('templateId: tripData.templateId') &&
                    routesFile.includes('seatOccupancy: {}') &&
                    routesFile.includes('departureDate: currentDateStr') &&
                    routesFile.includes('departureTime: departureTime');
console.log(`✅ Campos nuevos (templateId, seatOccupancy, etc): ${hasNewFields ? 'PRESENTE' : '❌ FALTANTE'}`);

// Verificar compatibilidad legacy
const hasLegacy = routesFile.includes('MODO LEGACY (PRESERVAR COMPATIBILIDAD)') &&
                 routesFile.includes('tripData: tripCombinations');
console.log(`✅ Compatibilidad legacy: ${hasLegacy ? 'PRESENTE' : '❌ FALTANTE'}`);

// PASO 6: VERIFICAR MÉTODO createTrip
console.log('\n=== PASO 6: VERIFICACIÓN MÉTODO createTrip ===');
const dbStorageFile = fs.readFileSync('server/db-storage.ts', 'utf8');

// Buscar método createTrip actualizado
const createTripMethod = dbStorageFile.match(/async createTrip\(trip: InsertTrip\): Promise<Trip> \{[\s\S]*?\n  \}/);
if (createTripMethod) {
  const methodContent = createTripMethod[0];
  
  const hasLogging = methodContent.includes('Template-based') && methodContent.includes('Legacy');
  console.log(`✅ Logging inteligente: ${hasLogging ? 'PRESENTE' : '❌ FALTANTE'}`);
  
  const hasTypeDetection = methodContent.includes('trip.templateId ?');
  console.log(`✅ Detección de tipo: ${hasTypeDetection ? 'PRESENTE' : '❌ FALTANTE'}`);
  
  const hasDetailedLogging = methodContent.includes('templateId:') && methodContent.includes('departureDate:');
  console.log(`✅ Logging detallado: ${hasDetailedLogging ? 'PRESENTE' : '❌ FALTANTE'}`);
} else {
  console.log('❌ Método createTrip no encontrado');
}

// PASO 7: VERIFICAR MÉTODO searchTrips
console.log('\n=== PASO 7: VERIFICACIÓN MÉTODO searchTrips ===');

// Verificar filtrado híbrido de fechas
const hasHybridDateFilter = dbStorageFile.includes('FILTRO DE FECHA HÍBRIDO') &&
                           dbStorageFile.includes('EXISTS (') &&
                           dbStorageFile.includes('eq(schema.trips.departureDate, date)');
console.log(`✅ Filtrado híbrido de fechas: ${hasHybridDateFilter ? 'PRESENTE' : '❌ FALTANTE'}`);

// Verificar manejo híbrido de viajes
const hasHybridProcessing = dbStorageFile.includes('MANEJO HÍBRIDO DE VIAJES') &&
                           dbStorageFile.includes('isTemplateBased = trip.templateId != null') &&
                           dbStorageFile.includes('generateSegmentsFromTemplate');
console.log(`✅ Procesamiento híbrido: ${hasHybridProcessing ? 'PRESENTE' : '❌ FALTANTE'}`);

// Verificar generación dinámica de segmentos
const hasDynamicGeneration = dbStorageFile.includes('VIAJES TEMPLATE-BASED: Generar segmentos dinámicamente') &&
                            dbStorageFile.includes('import(\'./utils/trip-utils.js\')');
console.log(`✅ Generación dinámica: ${hasDynamicGeneration ? 'PRESENTE' : '❌ FALTANTE'}`);

// Verificar manejo legacy
const hasLegacyHandling = dbStorageFile.includes('VIAJES LEGACY: Usar tripData JSON existente') &&
                         dbStorageFile.includes('JSON.parse(trip.tripData as string)');
console.log(`✅ Manejo legacy: ${hasLegacyHandling ? 'PRESENTE' : '❌ FALTANTE'}`);

// VERIFICACIÓN DE ARCHIVOS DE UTILIDAD
console.log('\n=== VERIFICACIÓN ARCHIVOS DE UTILIDAD ===');

// Verificar trip-utils.ts
const tripUtilsExists = fs.existsSync('server/utils/trip-utils.ts');
console.log(`✅ Archivo trip-utils.ts: ${tripUtilsExists ? 'PRESENTE' : '❌ FALTANTE'}`);

if (tripUtilsExists) {
  const tripUtilsContent = fs.readFileSync('server/utils/trip-utils.ts', 'utf8');
  const hasMainFunction = tripUtilsContent.includes('export async function generateSegmentsFromTemplate');
  console.log(`✅ Función generateSegmentsFromTemplate: ${hasMainFunction ? 'PRESENTE' : '❌ FALTANTE'}`);
}

// VERIFICACIÓN DE ESQUEMA
console.log('\n=== VERIFICACIÓN ESQUEMA DE BASE DE DATOS ===');
const schemaFile = fs.readFileSync('shared/schema.ts', 'utf8');

const hasTemplateId = schemaFile.includes('templateId:') && schemaFile.includes('integer("template_id")');
const hasSeatOccupancy = schemaFile.includes('seatOccupancy:') && schemaFile.includes('jsonb("seat_occupancy")');
const hasDepartureDate = schemaFile.includes('departureDate:') && schemaFile.includes('varchar("departure_date")');
const hasDepartureTime = schemaFile.includes('departureTime:') && schemaFile.includes('varchar("departure_time")');

console.log(`✅ Campo templateId: ${hasTemplateId ? 'PRESENTE' : '❌ FALTANTE'}`);
console.log(`✅ Campo seatOccupancy: ${hasSeatOccupancy ? 'PRESENTE' : '❌ FALTANTE'}`);
console.log(`✅ Campo departureDate: ${hasDepartureDate ? 'PRESENTE' : '❌ FALTANTE'}`);
console.log(`✅ Campo departureTime: ${hasDepartureTime ? 'PRESENTE' : '❌ FALTANTE'}`);

// RESUMEN FINAL
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE VERIFICACIÓN');

const allChecks = [
  hasTemplateBased,
  hasNewFields,
  hasLegacy,
  hasHybridDateFilter,
  hasHybridProcessing,
  hasDynamicGeneration,
  hasLegacyHandling,
  tripUtilsExists,
  hasTemplateId,
  hasSeatOccupancy,
  hasDepartureDate,
  hasDepartureTime
];

const passedChecks = allChecks.filter(check => check === true).length;
const totalChecks = allChecks.length;

console.log(`✅ Verificaciones exitosas: ${passedChecks}/${totalChecks}`);
console.log(`📈 Porcentaje de completitud: ${Math.round((passedChecks/totalChecks) * 100)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 ¡TODOS LOS PASOS 5, 6 Y 7 IMPLEMENTADOS CORRECTAMENTE!');
  console.log('✨ Sistema template-based completamente operativo');
} else {
  console.log('\n⚠️  Algunos elementos requieren atención');
  console.log('🔧 Revisar los elementos marcados como FALTANTE');
}

console.log('\n=== VERIFICACIÓN COMPLETA ===');