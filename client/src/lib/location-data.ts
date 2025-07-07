import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './queryClient';

// Estructura para datos de ubicación en México
export interface LocationData {
  states: LocationState[];
}

export interface LocationState {
  id?: number;
  state?: string;
  name?: string;
  code: string;
  municipalities: Municipality[];
}

export interface Municipality {
  name: string;
  code: string;
}

// Hook para obtener datos de ubicación
export function useLocationData() {
  return useQuery<LocationState[]>({
    queryKey: ['/api/locations'],
    queryFn: async () => {
      const response = await apiRequest<LocationState[]>("GET", '/api/locations');
      return response;
    }
  });
}

// Datos estáticos actualizados desde la base de datos (2025-07-07)
const staticMexicoStates: LocationState[] = [
  {
    name: "Aguascalientes",
    code: "AGU",
    municipalities: [
      { name: "Aguascalientes", code: "AGU001" },
      { name: "Asientos", code: "AGU002" },
      { name: "Calvillo", code: "AGU003" },
      { name: "Cosio", code: "AGU004" },
      { name: "El Llano", code: "AGU005" },
      { name: "Jesus Maria", code: "AGU006" },
      { name: "Pabellon de Arteaga", code: "AGU007" },
      { name: "Rincon de Romos", code: "AGU008" },
      { name: "San Francisco de los Romo", code: "AGU009" },
      { name: "San Jose de Gracia", code: "AGU010" },
      { name: "Tepezala", code: "AGU011" }
    ]
  },
  {
    name: "Baja California",
    code: "BAJ",
    municipalities: [
      { name: "Ensenada", code: "BAJ001" },
      { name: "Mexicali", code: "BAJ002" },
      { name: "Playas de Rosarito", code: "BAJ003" },
      { name: "Tecate", code: "BAJ004" },
      { name: "Tijuana", code: "BAJ005" }
    ]
  },
  {
    name: "Baja California Sur",
    code: "BAJ",
    municipalities: [
      { name: "Comondu", code: "BAJ001" },
      { name: "La Paz", code: "BAJ002" },
      { name: "Loreto", code: "BAJ003" },
      { name: "Los Cabos", code: "BAJ004" },
      { name: "Mulege", code: "BAJ005" }
    ]
  },
  {
    name: "Campeche",
    code: "CAM",
    municipalities: [
      { name: "Calakmul", code: "CAM001" },
      { name: "Calkini", code: "CAM002" },
      { name: "Campeche", code: "CAM003" },
      { name: "Candelaria", code: "CAM004" },
      { name: "Carmen", code: "CAM005" },
      { name: "Champoton", code: "CAM006" },
      { name: "Escarcega", code: "CAM007" },
      { name: "Hecelchakan", code: "CAM008" },
      { name: "Hopelchen", code: "CAM009" },
      { name: "Palizada", code: "CAM010" },
      { name: "Tenabo", code: "CAM011" }
    ]
  },
  {
    name: "Chiapas",
    code: "CHI",
    municipalities: [
      { name: "Acacoyagua", code: "CHI001" },
      { name: "Acala", code: "CHI002" },
      { name: "Acapetahua", code: "CHI003" },
      { name: "Aldama", code: "CHI004" },
      { name: "Altamirano", code: "CHI005" },
      { name: "Amatenango de la Frontera", code: "CHI006" },
      { name: "Amatenango del Valle", code: "CHI007" },
      { name: "Amatan", code: "CHI008" },
      { name: "Angel Albino Corzo", code: "CHI009" },
      { name: "Arriaga", code: "CHI010" },
      { name: "Bejucal de Ocampo", code: "CHI011" },
      { name: "Bella Vista", code: "CHI012" },
      { name: "Benemerito de las Americas", code: "CHI013" },
      { name: "Berriozabal", code: "CHI014" },
      { name: "Bochil", code: "CHI015" },
      { name: "Cacahoatan", code: "CHI016" },
      { name: "Capitan Luis Angel Vidal", code: "CHI017" },
      { name: "Catazaja", code: "CHI018" },
      { name: "Chalchihuitan", code: "CHI019" },
      { name: "Chamula", code: "CHI020" },
      { name: "Chanal", code: "CHI021" },
      { name: "Chapultenango", code: "CHI022" },
      { name: "Chenalho", code: "CHI023" },
      { name: "Chiapa de Corzo", code: "CHI024" },
      { name: "Chiapilla", code: "CHI025" },
      { name: "Chicoasen", code: "CHI026" },
      { name: "Chicomuselo", code: "CHI027" },
      { name: "Chilon", code: "CHI028" },
      { name: "Cintalapa", code: "CHI029" },
      { name: "Coapilla", code: "CHI030" },
      { name: "Comitan de Dominguez", code: "CHI031" },
      { name: "Copainala", code: "CHI032" },
      { name: "El Bosque", code: "CHI033" },
      { name: "El Parral", code: "CHI034" },
      { name: "El Porvenir", code: "CHI035" },
      { name: "Emiliano Zapata", code: "CHI036" },
      { name: "Escuintla", code: "CHI037" },
      { name: "Francisco Leon", code: "CHI038" },
      { name: "Frontera Comalapa", code: "CHI039" },
      { name: "Frontera Hidalgo", code: "CHI040" },
      { name: "Huehuetan", code: "CHI041" },
      { name: "Huitiupan", code: "CHI042" },
      { name: "Huixtla", code: "CHI043" },
      { name: "Huixtan", code: "CHI044" },
      { name: "Ixhuatan", code: "CHI045" },
      { name: "Ixtacomitan", code: "CHI046" },
      { name: "Ixtapa", code: "CHI047" },
      { name: "Ixtapangajoya", code: "CHI048" },
      { name: "Jiquipilas", code: "CHI049" },
      { name: "Jitotol", code: "CHI050" },
      { name: "Juarez", code: "CHI051" },
      { name: "La Concordia", code: "CHI052" },
      { name: "La Grandeza", code: "CHI053" },
      { name: "La Independencia", code: "CHI054" },
      { name: "La Libertad", code: "CHI055" },
      { name: "La Trinitaria", code: "CHI056" },
      { name: "Larrainzar", code: "CHI057" },
      { name: "Las Margaritas", code: "CHI058" },
      { name: "Las Rosas", code: "CHI059" },
      { name: "Mapastepec", code: "CHI060" },
      { name: "Maravilla Tenejapa", code: "CHI061" },
      { name: "Marques de Comillas", code: "CHI062" },
      { name: "Mazapa de Madero", code: "CHI063" },
      { name: "Mazatan", code: "CHI064" },
      { name: "Metapa", code: "CHI065" },
      { name: "Mezcalapa", code: "CHI066" },
      { name: "Mitontic", code: "CHI067" },
      { name: "Montecristo de Guerrero", code: "CHI068" },
      { name: "Motozintla", code: "CHI069" },
      { name: "Nicolas Ruiz", code: "CHI070" },
      { name: "Ocosingo", code: "CHI071" },
      { name: "Ocotepec", code: "CHI072" },
      { name: "Ocozocoautla de Espinosa", code: "CHI073" },
      { name: "Ostuacan", code: "CHI074" },
      { name: "Osumacinta", code: "CHI075" },
      { name: "Oxchuc", code: "CHI076" },
      { name: "Palenque", code: "CHI077" },
      { name: "Pantelho", code: "CHI078" },
      { name: "Pantepec", code: "CHI079" },
      { name: "Pichucalco", code: "CHI080" },
      { name: "Pijijiapan", code: "CHI081" },
      { name: "Pueblo Nuevo Solistahuacan", code: "CHI082" },
      { name: "Rayon", code: "CHI083" },
      { name: "Reforma", code: "CHI084" },
      { name: "Rincon Chamula San Pedro", code: "CHI085" },
      { name: "Sabanilla", code: "CHI086" },
      { name: "Salto de Agua", code: "CHI087" },
      { name: "San Andres Duraznal", code: "CHI088" },
      { name: "San Cristobal de las Casas", code: "CHI089" },
      { name: "San Fernando", code: "CHI090" },
      { name: "San Juan Cancuc", code: "CHI091" },
      { name: "San Lucas", code: "CHI092" },
      { name: "Santiago el Pinar", code: "CHI093" },
      { name: "Siltepec", code: "CHI094" },
      { name: "Simojovel", code: "CHI095" },
      { name: "Sitala", code: "CHI096" },
      { name: "Socoltenango", code: "CHI097" },
      { name: "Solosuchiapa", code: "CHI098" },
      { name: "Soyalo", code: "CHI099" },
      { name: "Suchiapa", code: "CHI100" },
      { name: "Suchiate", code: "CHI101" },
      { name: "Sunuapa", code: "CHI102" },
      { name: "Tapachula", code: "CHI103" },
      { name: "Tapalapa", code: "CHI104" },
      { name: "Tapilula", code: "CHI105" },
      { name: "Tecpatan", code: "CHI106" },
      { name: "Tenejapa", code: "CHI107" },
      { name: "Teopisca", code: "CHI108" },
      { name: "Tila", code: "CHI109" },
      { name: "Tonala", code: "CHI110" },
      { name: "Totolapa", code: "CHI111" },
      { name: "Tumbala", code: "CHI112" },
      { name: "Tuxtla Chico", code: "CHI113" },
      { name: "Tuxtla Gutierrez", code: "CHI114" },
      { name: "Tuzantan", code: "CHI115" },
      { name: "Tzimol", code: "CHI116" },
      { name: "Union Juarez", code: "CHI117" },
      { name: "Venustiano Carranza", code: "CHI118" },
      { name: "Villa Comaltitlan", code: "CHI119" },
      { name: "Villa Corzo", code: "CHI120" },
      { name: "Villaflores", code: "CHI121" },
      { name: "Yajalon", code: "CHI122" },
      { name: "Zinacantan", code: "CHI123" }
    ]
  },
  {
    name: "Chihuahua",
    code: "CHI",
    municipalities: [
      { name: "Ahumada", code: "CHI001" },
      { name: "Aldama", code: "CHI002" },
      { name: "Allende", code: "CHI003" },
      { name: "Aquiles Serdan", code: "CHI004" },
      { name: "Ascension", code: "CHI005" },
      { name: "Bachiniva", code: "CHI006" },
      { name: "Balleza", code: "CHI007" },
      { name: "Batopilas de Manuel Gomez Morin", code: "CHI008" },
      { name: "Bocoyna", code: "CHI009" },
      { name: "Buenaventura", code: "CHI010" },
      { name: "Camargo", code: "CHI011" },
      { name: "Carichi", code: "CHI012" },
      { name: "Casas Grandes", code: "CHI013" },
      { name: "Chihuahua", code: "CHI014" },
      { name: "Chinipas", code: "CHI015" },
      { name: "Coronado", code: "CHI016" },
      { name: "Coyame del Sotol", code: "CHI017" },
      { name: "Cuauhtemoc", code: "CHI018" },
      { name: "Cusihuiriachi", code: "CHI019" },
      { name: "Delicias", code: "CHI020" },
      { name: "Dr. Belisario Dominguez", code: "CHI021" },
      { name: "El Tule", code: "CHI022" },
      { name: "Galeana", code: "CHI023" },
      { name: "Gran Morelos", code: "CHI024" },
      { name: "Guachochi", code: "CHI025" },
      { name: "Guadalupe y Calvo", code: "CHI026" },
      { name: "Guadalupe", code: "CHI027" },
      { name: "Guazapares", code: "CHI028" },
      { name: "Guerrero", code: "CHI029" },
      { name: "Gomez Farias", code: "CHI030" },
      { name: "Hidalgo del Parral", code: "CHI031" },
      { name: "Huejotitan", code: "CHI032" },
      { name: "Ignacio Zaragoza", code: "CHI033" },
      { name: "Janos", code: "CHI034" },
      { name: "Jimenez", code: "CHI035" },
      { name: "Julimes", code: "CHI036" },
      { name: "Juarez", code: "CHI037" },
      { name: "La Cruz", code: "CHI038" },
      { name: "Lopez", code: "CHI039" },
      { name: "Madera", code: "CHI040" },
      { name: "Maguarichi", code: "CHI041" },
      { name: "Manuel Benavides", code: "CHI042" },
      { name: "Matachi", code: "CHI043" },
      { name: "Matamoros", code: "CHI044" },
      { name: "Meoqui", code: "CHI045" },
      { name: "Morelos", code: "CHI046" },
      { name: "Moris", code: "CHI047" },
      { name: "Namiquipa", code: "CHI048" },
      { name: "Nonoava", code: "CHI049" },
      { name: "Nuevo Casas Grandes", code: "CHI050" },
      { name: "Ocampo", code: "CHI051" },
      { name: "Ojinaga", code: "CHI052" },
      { name: "Praxedis G. Guerrero", code: "CHI053" },
      { name: "Riva Palacio", code: "CHI054" },
      { name: "Rosales", code: "CHI055" },
      { name: "Rosario", code: "CHI056" },
      { name: "San Francisco de Borja", code: "CHI057" },
      { name: "San Francisco de Conchos", code: "CHI058" },
      { name: "San Francisco del Oro", code: "CHI059" },
      { name: "Santa Barbara", code: "CHI060" },
      { name: "Santa Isabel", code: "CHI061" },
      { name: "Satevo", code: "CHI062" },
      { name: "Saucillo", code: "CHI063" },
      { name: "Temosachic", code: "CHI064" },
      { name: "Urique", code: "CHI065" },
      { name: "Uruachi", code: "CHI066" },
      { name: "Valle de Zaragoza", code: "CHI067" }
    ]
  },
  {
    name: "Ciudad de Mexico",
    code: "CIU",
    municipalities: [
      { name: "Alvaro Obregon", code: "CIU001" },
      { name: "Azcapotzalco", code: "CIU002" },
      { name: "Benito Juarez", code: "CIU003" },
      { name: "Coyoacan", code: "CIU004" },
      { name: "Cuajimalpa de Morelos", code: "CIU005" },
      { name: "Cuauhtemoc", code: "CIU006" },
      { name: "Gustavo A. Madero", code: "CIU007" },
      { name: "Iztacalco", code: "CIU008" },
      { name: "Iztapalapa", code: "CIU009" },
      { name: "La Magdalena Contreras", code: "CIU010" },
      { name: "Miguel Hidalgo", code: "CIU011" },
      { name: "Milpa Alta", code: "CIU012" },
      { name: "Tlalpan", code: "CIU013" },
      { name: "Tlahuac", code: "CIU014" },
      { name: "Venustiano Carranza", code: "CIU015" },
      { name: "Xochimilco", code: "CIU016" }
    ]
  },
  {
    name: "Coahuila",
    code: "COA",
    municipalities: [
      { name: "Abasolo", code: "COA001" },
      { name: "Acuna", code: "COA002" },
      { name: "Allende", code: "COA003" },
      { name: "Arteaga", code: "COA004" },
      { name: "Candela", code: "COA005" },
      { name: "Castanos", code: "COA006" },
      { name: "Cuatro Cienegas", code: "COA007" },
      { name: "Escobedo", code: "COA008" },
      { name: "Francisco I. Madero", code: "COA009" },
      { name: "Frontera", code: "COA010" },
      { name: "General Cepeda", code: "COA011" },
      { name: "Guerrero", code: "COA012" },
      { name: "Hidalgo", code: "COA013" },
      { name: "Jimenez", code: "COA014" },
      { name: "Juarez", code: "COA015" },
      { name: "Lamadrid", code: "COA016" },
      { name: "Matamoros", code: "COA017" },
      { name: "Monclova", code: "COA018" },
      { name: "Morelos", code: "COA019" },
      { name: "Muzquiz", code: "COA020" },
      { name: "Nadadores", code: "COA021" },
      { name: "Nava", code: "COA022" },
      { name: "Ocampo", code: "COA023" },
      { name: "Parras", code: "COA024" },
      { name: "Piedras Negras", code: "COA025" },
      { name: "Progreso", code: "COA026" },
      { name: "Ramos Arizpe", code: "COA027" },
      { name: "Sabinas", code: "COA028" },
      { name: "Sacramento", code: "COA029" },
      { name: "Saltillo", code: "COA030" },
      { name: "San Buenaventura", code: "COA031" },
      { name: "San Juan de Sabinas", code: "COA032" },
      { name: "San Pedro", code: "COA033" },
      { name: "Sierra Mojada", code: "COA034" },
      { name: "Torreon", code: "COA035" },
      { name: "Viesca", code: "COA036" },
      { name: "Villa Union", code: "COA037" },
      { name: "Zaragoza", code: "COA038" }
    ]
  },
  {
    name: "Colima",
    code: "COL",
    municipalities: [
      { name: "Armeria", code: "COL001" },
      { name: "Colima", code: "COL002" },
      { name: "Comala", code: "COL003" },
      { name: "Coquimatlan", code: "COL004" },
      { name: "Cuauhtemoc", code: "COL005" },
      { name: "Ixtlahuacan", code: "COL006" },
      { name: "Manzanillo", code: "COL007" },
      { name: "Minatitlan", code: "COL008" },
      { name: "Tecoman", code: "COL009" },
      { name: "Villa de Alvarez", code: "COL010" }
    ]
  },
  {
    name: "Durango",
    code: "DUR",
    municipalities: [
      { name: "Canatlán", code: "DUR001" },
      { name: "Canelas", code: "DUR002" },
      { name: "Coneto de Comonfort", code: "DUR003" },
      { name: "Cuencamé", code: "DUR004" },
      { name: "Durango", code: "DUR005" },
      { name: "El Oro", code: "DUR006" },
      { name: "General Simón Bolívar", code: "DUR007" },
      { name: "Gómez Palacio", code: "DUR008" },
      { name: "Guadalupe Victoria", code: "DUR009" },
      { name: "Guanaceví", code: "DUR010" },
      { name: "Hidalgo", code: "DUR011" },
      { name: "Indé", code: "DUR012" },
      { name: "Lerdo", code: "DUR013" },
      { name: "Mapimí", code: "DUR014" },
      { name: "Mezquital", code: "DUR015" },
      { name: "Nazas", code: "DUR016" },
      { name: "Nombre de Dios", code: "DUR017" },
      { name: "Ocampo", code: "DUR018" },
      { name: "Otáez", code: "DUR019" },
      { name: "Pánuco de Coronado", code: "DUR020" },
      { name: "Peñón Blanco", code: "DUR021" },
      { name: "Poanas", code: "DUR022" },
      { name: "Pueblo Nuevo", code: "DUR023" },
      { name: "Rodeo", code: "DUR024" },
      { name: "San Bernardo", code: "DUR025" },
      { name: "San Dimas", code: "DUR026" },
      { name: "San Juan de Guadalupe", code: "DUR027" },
      { name: "San Juan del Río", code: "DUR028" },
      { name: "San Luis del Cordero", code: "DUR029" },
      { name: "San Pedro del Gallo", code: "DUR030" },
      { name: "Santa Clara", code: "DUR031" },
      { name: "Santiago Papasquiaro", code: "DUR032" },
      { name: "Súchil", code: "DUR033" },
      { name: "Tamazula", code: "DUR034" },
      { name: "Tepehuanes", code: "DUR035" },
      { name: "Tlahualilo", code: "DUR036" },
      { name: "Topia", code: "DUR037" },
      { name: "Vicente Guerrero", code: "DUR038" },
      { name: "Nuevo Ideal", code: "DUR039" }
    ]
  },
  {
    name: "Guanajuato",
    code: "GUA",
    municipalities: [
      { name: "Abasolo", code: "GUA001" },
      { name: "Acambaro", code: "GUA002" },
      { name: "Apaseo el Alto", code: "GUA003" },
      { name: "Apaseo el Grande", code: "GUA004" },
      { name: "Atarjea", code: "GUA005" },
      { name: "Celaya", code: "GUA006" },
      { name: "Comonfort", code: "GUA007" },
      { name: "Coroneo", code: "GUA008" },
      { name: "Cortazar", code: "GUA009" },
      { name: "Cueramaro", code: "GUA010" },
      { name: "Doctor Mora", code: "GUA011" },
      { name: "Dolores Hidalgo Cuna de la Independencia Nacional", code: "GUA012" },
      { name: "Guanajuato", code: "GUA013" },
      { name: "Huanimaro", code: "GUA014" },
      { name: "Irapuato", code: "GUA015" },
      { name: "Jaral del Progreso", code: "GUA016" },
      { name: "Jerecuaro", code: "GUA017" },
      { name: "Leon", code: "GUA018" },
      { name: "Manuel Doblado", code: "GUA019" },
      { name: "Moroleon", code: "GUA020" },
      { name: "Ocampo", code: "GUA021" },
      { name: "Penjamo", code: "GUA022" },
      { name: "Pueblo Nuevo", code: "GUA023" },
      { name: "Purisima del Rincon", code: "GUA024" },
      { name: "Romita", code: "GUA025" },
      { name: "Salamanca", code: "GUA026" },
      { name: "Salvatierra", code: "GUA027" },
      { name: "San Diego de la Union", code: "GUA028" },
      { name: "San Felipe", code: "GUA029" },
      { name: "San Francisco del Rincon", code: "GUA030" },
      { name: "San Jose Iturbide", code: "GUA031" },
      { name: "San Luis de la Paz", code: "GUA032" },
      { name: "San Miguel de Allende", code: "GUA033" },
      { name: "Santa Catarina", code: "GUA034" },
      { name: "Santa Cruz de Juventino Rosas", code: "GUA035" },
      { name: "Santiago Maravatio", code: "GUA036" },
      { name: "Silao de la Victoria", code: "GUA037" },
      { name: "Tarandacuao", code: "GUA038" },
      { name: "Tarimoro", code: "GUA039" },
      { name: "Tierra Blanca", code: "GUA040" },
      { name: "Uriangato", code: "GUA041" },
      { name: "Valle de Santiago", code: "GUA042" },
      { name: "Victoria", code: "GUA043" },
      { name: "Villagran", code: "GUA044" },
      { name: "Xichu", code: "GUA045" },
      { name: "Yuriria", code: "GUA046" }
    ]
  },
  {
    name: "Guerrero",
    code: "GUE",
    municipalities: [
      { name: "Acapulco de Juarez", code: "GUE001" },
      { name: "Acatepec", code: "GUE002" },
      { name: "Ahuacuotzingo", code: "GUE003" },
      { name: "Ajuchitlan del Progreso", code: "GUE004" },
      { name: "Alcozauca de Guerrero", code: "GUE005" },
      { name: "Alpoyeca", code: "GUE006" },
      { name: "Apaxtla", code: "GUE007" },
      { name: "Arcelia", code: "GUE008" },
      { name: "Atenango del Rio", code: "GUE009" },
      { name: "Atlamajalcingo del Monte", code: "GUE010" },
      { name: "Atlixtac", code: "GUE011" },
      { name: "Atoyac de Alvarez", code: "GUE012" },
      { name: "Ayutla de los Libres", code: "GUE013" },
      { name: "Azoyu", code: "GUE014" },
      { name: "Benito Juarez", code: "GUE015" },
      { name: "Buenavista de Cuellar", code: "GUE016" },
      { name: "Chilapa de Alvarez", code: "GUE017" },
      { name: "Chilpancingo de los Bravo", code: "GUE018" },
      { name: "Coahuayutla de Jose Maria Izazaga", code: "GUE019" },
      { name: "Cochoapa el Grande", code: "GUE020" },
      { name: "Cocula", code: "GUE021" },
      { name: "Copala", code: "GUE022" },
      { name: "Copalillo", code: "GUE023" },
      { name: "Copanatoyac", code: "GUE024" },
      { name: "Coyuca de Benitez", code: "GUE025" },
      { name: "Coyuca de Catalan", code: "GUE026" },
      { name: "Cuajinicuilapa", code: "GUE027" },
      { name: "Cualac", code: "GUE028" },
      { name: "Cuautepec", code: "GUE029" },
      { name: "Cuetzala del Progreso", code: "GUE030" },
      { name: "Cutzamala de Pinzon", code: "GUE031" },
      { name: "Eduardo Neri", code: "GUE032" },
      { name: "Florencio Villarreal", code: "GUE033" },
      { name: "General Canuto A. Neri", code: "GUE034" },
      { name: "General Heliodoro Castillo", code: "GUE035" },
      { name: "Huamuxtitlan", code: "GUE036" },
      { name: "Huitzuco de los Figueroa", code: "GUE037" },
      { name: "Iguala de la Independencia", code: "GUE038" },
      { name: "Igualapa", code: "GUE039" },
      { name: "Iliatenco", code: "GUE040" },
      { name: "Ixcateopan de Cuauhtemoc", code: "GUE041" },
      { name: "Jose Joaquin de Herrera", code: "GUE042" },
      { name: "Juan R. Escudero", code: "GUE043" },
      { name: "Juchitan", code: "GUE044" },
      { name: "La Union de Isidoro Montes de Oca", code: "GUE045" },
      { name: "Leonardo Bravo", code: "GUE046" },
      { name: "Malinaltepec", code: "GUE047" },
      { name: "Marquelia", code: "GUE048" },
      { name: "Martir de Cuilapan", code: "GUE049" },
      { name: "Metlatonoc", code: "GUE050" },
      { name: "Mochitlan", code: "GUE051" },
      { name: "Olinala", code: "GUE052" },
      { name: "Ometepec", code: "GUE053" },
      { name: "Pedro Ascencio Alquisiras", code: "GUE054" },
      { name: "Petatlan", code: "GUE055" },
      { name: "Pilcaya", code: "GUE056" },
      { name: "Pungarabato", code: "GUE057" },
      { name: "Quechultenango", code: "GUE058" },
      { name: "San Luis Acatlan", code: "GUE059" },
      { name: "San Marcos", code: "GUE060" },
      { name: "San Miguel Totolapan", code: "GUE061" },
      { name: "Taxco de Alarcon", code: "GUE062" },
      { name: "Tecoanapa", code: "GUE063" },
      { name: "Tecpan de Galeana", code: "GUE064" },
      { name: "Teloloapan", code: "GUE065" },
      { name: "Tepecoacuilco de Trujano", code: "GUE066" },
      { name: "Tetipac", code: "GUE067" },
      { name: "Tixtla de Guerrero", code: "GUE068" },
      { name: "Tlacoachistlahuaca", code: "GUE069" },
      { name: "Tlacoapa", code: "GUE070" },
      { name: "Tlalchapa", code: "GUE071" },
      { name: "Tlalixtaquilla de Maldonado", code: "GUE072" },
      { name: "Tlapa de Comonfort", code: "GUE073" },
      { name: "Tlapehuala", code: "GUE074" },
      { name: "Xalpatlahuac", code: "GUE075" },
      { name: "Xochihuehuetlan", code: "GUE076" },
      { name: "Xochistlahuaca", code: "GUE077" },
      { name: "Zapotitlan Tablas", code: "GUE078" },
      { name: "Zihuatanejo de Azueta", code: "GUE079" },
      { name: "Zirandaro", code: "GUE080" },
      { name: "Zitlala", code: "GUE081" }
    ]
  }
];

// Exportamos los datos estáticos actualizados
export const mexicoStates = staticMexicoStates;

// Funciones para trabajar con los datos
export function getMunicipalitiesByState(stateCode: string, states?: LocationState[]): Municipality[] {
  const statesData = states || staticMexicoStates;
  const state = statesData.find(state => state.code === stateCode);
  return state ? state.municipalities : [];
}

// Función para obtener un estado por su código
export function getStateByCode(stateCode: string, states?: LocationState[]): LocationState | undefined {
  const statesData = states || staticMexicoStates;
  return statesData.find(state => state.code === stateCode);
}

// Función para obtener un municipio por su código dentro de un estado
export function getMunicipalityByCode(stateCode: string, municipalityCode: string, states?: LocationState[]): Municipality | undefined {
  const state = getStateByCode(stateCode, states);
  return state?.municipalities.find(municipality => municipality.code === municipalityCode);
}

// Función para obtener el nombre completo de una ubicación
export function getFullLocationName(stateCode: string, municipalityCode: string, stationName?: string): string {
  const state = getStateByCode(stateCode);
  const municipality = getMunicipalityByCode(stateCode, municipalityCode);
  
  if (!state || !municipality) {
    return '';
  }
  
  let fullName = `${municipality.name}, ${state.name}`;
  if (stationName) {
    fullName += ` - ${stationName}`;
  }
  
  return fullName;
}

// Función para buscar ubicaciones por texto
export function searchLocations(searchText: string, states?: LocationState[]): { state: LocationState; municipality: Municipality }[] {
  const statesData = states || staticMexicoStates;
  const results: { state: LocationState; municipality: Municipality }[] = [];
  const searchLower = searchText.toLowerCase();
  
  statesData.forEach(state => {
    state.municipalities.forEach(municipality => {
      if (
        municipality.name.toLowerCase().includes(searchLower) ||
        state.name?.toLowerCase().includes(searchLower)
      ) {
        results.push({ state, municipality });
      }
    });
  });
  
  return results;
}

// Interfaces para compatibilidad (alias)
export interface State extends LocationState {}