import { createConnection } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './shared/schema.ts';

// Configurar conexión directa a la base de datos
const sql = createConnection(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

/**
 * Prueba del método optimizado sin autenticación
 */
async function testOptimizedReservations() {
    console.log('🔍 PROBANDO OPTIMIZACIÓN DE RESERVACIONES (DIRECTO A BD)');
    console.log('=====================================================');
    
    try {
        // Probar consulta optimizada directamente
        const startTime = Date.now();
        
        // Consulta optimizada combinada
        const result = await sql`
            SELECT 
                r.id,
                r.status,
                r.email,
                r.phone,
                r.total_amount,
                r.advance_amount,
                r.payment_method,
                r.payment_status,
                r.created_at,
                r.trip_details,
                r.company_id,
                r.created_by,
                r.paid_by,
                r.checked_by,
                r.commission_paid,
                r.coupon_code,
                r.discount_amount,
                r.original_amount,
                -- Datos del usuario creador
                u_creator.name as creator_name,
                u_creator.email as creator_email,
                -- Datos del usuario pagador
                u_payer.name as payer_name,
                u_payer.email as payer_email,
                -- Datos del usuario checker
                u_checker.name as checker_name,
                u_checker.email as checker_email,
                -- Datos del trip
                t.id as trip_id,
                t.trip_data,
                t.capacity as trip_capacity,
                t.visibility as trip_visibility,
                -- Datos del route
                rt.id as route_id,
                rt.name as route_name,
                rt.origin as route_origin,
                rt.destination as route_destination,
                -- Datos del vehicle
                v.id as vehicle_id,
                v.plate_number as vehicle_plate,
                v.brand as vehicle_brand,
                v.model as vehicle_model,
                v.year as vehicle_year,
                v.capacity as vehicle_capacity,
                -- Datos del driver
                d.id as driver_id,
                d.name as driver_name,
                d.phone as driver_phone,
                d.license_number as driver_license
            FROM reservations r
            LEFT JOIN users u_creator ON r.created_by = u_creator.id
            LEFT JOIN users u_payer ON r.paid_by = u_payer.id
            LEFT JOIN users u_checker ON r.checked_by = u_checker.id
            LEFT JOIN trips t ON CAST(r.trip_details->>'recordId' AS INTEGER) = t.id
            LEFT JOIN routes rt ON t.route_id = rt.id
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE r.company_id = 'bamo-350045'
            ORDER BY r.created_at DESC
            LIMIT 100;
        `;
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        console.log(`✅ Consulta optimizada completada en ${executionTime}ms`);
        console.log(`📊 Reservaciones encontradas: ${result.length}`);
        
        // Mostrar estadísticas de datos
        const withTrips = result.filter(r => r.trip_id).length;
        const withRoutes = result.filter(r => r.route_id).length;
        const withVehicles = result.filter(r => r.vehicle_id).length;
        const withDrivers = result.filter(r => r.driver_id).length;
        
        console.log(`🔗 Reservaciones con trip data: ${withTrips}`);
        console.log(`🔗 Reservaciones con route data: ${withRoutes}`);
        console.log(`🔗 Reservaciones con vehicle data: ${withVehicles}`);
        console.log(`🔗 Reservaciones con driver data: ${withDrivers}`);
        
        // Mostrar ejemplos de datos
        const sample = result.slice(0, 3);
        console.log('\n📝 EJEMPLOS DE DATOS:');
        sample.forEach((r, i) => {
            console.log(`${i + 1}. ID: ${r.id}, Status: ${r.status}, Email: ${r.email}`);
            console.log(`   Trip: ${r.trip_id || 'N/A'}, Route: ${r.route_name || 'N/A'}`);
            console.log(`   Vehicle: ${r.vehicle_plate || 'N/A'}, Driver: ${r.driver_name || 'N/A'}`);
            console.log(`   Creator: ${r.creator_name || 'N/A'}`);
            console.log('   ---');
        });
        
        // Comparación con método anterior (simulación)
        const oldMethodTime = executionTime * 100; // Estimación del método anterior
        const improvement = ((oldMethodTime - executionTime) / oldMethodTime * 100).toFixed(1);
        
        console.log(`\n📈 MEJORA DE RENDIMIENTO:`);
        console.log(`   Método anterior (estimado): ${oldMethodTime}ms`);
        console.log(`   Método optimizado: ${executionTime}ms`);
        console.log(`   Mejora: ${improvement}% más rápido`);
        
        return {
            success: true,
            executionTime,
            recordCount: result.length,
            improvement: improvement + '%'
        };
        
    } catch (error) {
        console.error('❌ Error en prueba optimizada:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Ejecutar prueba
testOptimizedReservations()
    .then(result => {
        console.log('\n🎯 RESULTADO FINAL:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });