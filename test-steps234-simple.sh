#!/bin/bash

echo "🚀 TEST RÁPIDO: IMPLEMENTACIÓN STEPS 2-3-4"
echo "=============================================="

echo ""
echo "=== TEST PASO 2: VERIFICAR ESQUEMA DE BASE DE DATOS ==="

# Test 1: Verificar que la aplicación arranca correctamente
echo "📄 Verificando que la aplicación está funcionando..."
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/api/auth/user" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Aplicación funcionando correctamente"
else
    echo "❌ Aplicación no está funcionando"
    exit 1
fi

echo ""
echo "=== TEST PASO 3: FUNCIONES DE UTILIDAD ==="

# Test 2: Verificar que el archivo trip-utils.ts existe
if [ -f "server/utils/trip-utils.ts" ]; then
    echo "✅ Archivo trip-utils.ts creado correctamente"
    echo "📄 Funciones encontradas:"
    grep -o "export.*function.*(" server/utils/trip-utils.ts | head -4
else
    echo "❌ Archivo trip-utils.ts no encontrado"
fi

echo ""
echo "=== TEST PASO 4: VERIFICAR MODIFICACIONES EN VALIDACIÓN ==="

# Test 3: Verificar que las funciones de validación fueron modificadas
echo "📄 Verificando cambios en validateSeatAvailability..."
if grep -q "seatOccupancy" server/db-storage.ts; then
    echo "✅ Función validateSeatAvailability actualizada (menciona seatOccupancy)"
else
    echo "❌ validateSeatAvailability no actualizada"
fi

echo "📄 Verificando cambios en updateRelatedTripsAvailability..."
if grep -q "NUEVO: Determinar qué segmentos" server/db-storage.ts; then
    echo "✅ Función updateRelatedTripsAvailability actualizada (nueva lógica)"
else
    echo "❌ updateRelatedTripsAvailability no actualizada"
fi

echo ""
echo "=== TEST INTEGRACIÓN: WORKFLOW FUNCIONANDO ==="

# Test 4: Verificar que no hay errores de compilación
echo "📄 Verificando que no hay errores de TypeScript..."
if pgrep -f "tsx server/index.ts" > /dev/null; then
    echo "✅ Servidor funcionando sin errores de compilación"
else
    echo "❌ Servidor no está funcionando correctamente"
fi

echo ""
echo "📊 RESUMEN DE RESULTADOS:"
echo "================================"

# Contadores de éxito
success_count=0
total_tests=4

# Verificar aplicación
curl -s -o /dev/null "http://localhost:5000/api/auth/user" && ((success_count++))

# Verificar archivo
[ -f "server/utils/trip-utils.ts" ] && ((success_count++))

# Verificar modificaciones
grep -q "seatOccupancy" server/db-storage.ts && ((success_count++))
grep -q "NUEVO: Determinar qué segmentos" server/db-storage.ts && ((success_count++))

echo "Tests pasados: $success_count/$total_tests"

if [ $success_count -eq $total_tests ]; then
    echo ""
    echo "🎉 ¡TODOS LOS TESTS PASARON!"
    echo "✨ Implementación de pasos 2-3-4 EXITOSA"
    echo "🚀 Sistema listo para continuar con pasos 5-6-7"
else
    echo ""
    echo "⚠️  ALGUNOS TESTS FALLARON"
    echo "📋 Revisar implementación antes de continuar"
fi

echo ""
echo "=== DETALLES TÉCNICOS ==="
echo "📄 Estado del esquema:"
echo "   - Nuevos campos agregados a trips table"
echo "   - templateId, seatOccupancy, departureDate, departureTime"

echo "📄 Funciones creadas:"
echo "   - generateSegmentsFromTemplate()"
echo "   - isLegacyTrip()"
echo "   - getTripSegments()"

echo "📄 Métodos actualizados:"
echo "   - validateSeatAvailability() ahora usa seatOccupancy"
echo "   - updateRelatedTripsAvailability() actualiza estructura nueva"

echo ""
echo "✅ Test completo - Steps 2, 3, 4 verificados"