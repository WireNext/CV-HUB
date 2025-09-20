// Variable para almacenar los datos GTFS
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {}
};

// Variable para almacenar los datos GTFS
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {}
};

// Define un icono personalizado para las paradas
const customStopIcon = L.divIcon({
    className: 'custom-stop-icon',
    html: '<div style="background-color: #3388ff; border-radius: 50%; width: 10px; height: 10px; border: 2px solid white;"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

// Función para actualizar el tamaño de los iconos según el zoom
function updateIconSize(map, marker) {
    // ... (código de la función)
}

// Función para cargar y procesar los archivos GTFS
async function loadGTFSData(agency) {
}

// Función para inicializar el mapa con Leaflet
function initMap() {
    const map = L.map('map').setView([39.4699, -0.3774], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    drawStopsOnMap(map, 'metrovalencia'); // Llama a la nueva función
    
    return map; // Devuelve el mapa para usarlo después
}

// Función para dibujar las paradas en el mapa
function drawStopsOnMap(map, agency) {
    if (gtfsData[agency].stops) {
        gtfsData[agency].stops.forEach(stop => {
            if (stop.stop_lat && stop.stop_lon && !isNaN(parseFloat(stop.stop_lat))) {
                const marker = L.marker([stop.stop_lat, stop.stop_lon], { icon: customStopIcon }).addTo(map)
                    .bindPopup(stop.stop_name);
                
                updateIconSize(map, marker);
                map.on('zoom', () => updateIconSize(map, marker));
            }
        });
    }
}

// Función para procesar y dibujar las líneas
function drawRoutes(map, agency) {
    const routes = gtfsData[agency].routes || [];
    const trips = gtfsData[agency].trips || [];
    const shapes = gtfsData[agency].shapes || [];

    // Agrupar los puntos de 'shapes.txt' por ID de forma (shape_id)
    const shapeMap = new Map();
    shapes.forEach(shape => {
        if (!shapeMap.has(shape.shape_id)) {
            shapeMap.set(shape.shape_id, []);
        }
        shapeMap.get(shape.shape_id).push([shape.shape_pt_lat, shape.shape_pt_lon]);
    });

    // Recorrer las rutas para dibujar cada línea
    routes.forEach(route => {
        const routeColor = `#${route.route_color || '000000'}`;
        const routeName = route.route_short_name || route.route_long_name;
        
        const trip = trips.find(t => t.route_id === route.route_id);
        if (!trip || !trip.shape_id) return;
        
        const shapePoints = shapeMap.get(trip.shape_id);
        if (shapePoints && shapePoints.length > 0) {
            const polyline = L.polyline(shapePoints, {
                color: routeColor,
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            
            polyline.bindPopup(`Línea: ${routeName}`);
        }
    });
}

// Función para cargar y procesar los archivos GTFS
async function loadGTFSData(agency) {
    const dataDir = `./data/${agency}/`;
    
    // Lista de archivos GTFS que nos interesan
    const files = ['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'shapes.txt'];
    
    for (const file of files) {
        try {
            const response = await fetch(dataDir + file);
            if (!response.ok) throw new Error(`Error al cargar ${file}`);
            
            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = lines[0].split(',');
            const data = lines.slice(1).map(line => {
                const values = line.split(',');
                return headers.reduce((obj, header, i) => {
                    obj[header.trim()] = values[i] ? values[i].trim() : '';
                    return obj;
                }, {});
            });
            gtfsData[agency][file.replace('.txt', '')] = data;
            
        } catch (error) {
            console.error(`No se pudo cargar o parsear el archivo ${file} para ${agency}:`, error);
        }
    }
}

// Función para inicializar el mapa con Leaflet
function initMap() {
    const map = L.map('map').setView([39.4699, -0.3774], 12); // Coordenadas de Valencia

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    drawRoutesOnMap(map);
}

// Función para dibujar las rutas en el mapa
function drawRoutesOnMap(map) {
    // Ejemplo de cómo dibujar un punto (una parada)
    // Supongamos que tienes la lista de paradas en gtfsData.metrovalencia.stops
    if (gtfsData.metrovalencia.stops) {
        gtfsData.metrovalencia.stops.forEach(stop => {
            L.marker([stop.stop_lat, stop.stop_lon]).addTo(map)
                .bindPopup(stop.stop_name);
        });
    }

}

// Función principal para iniciar la aplicación
async function startApp() {
    // Cargar los datos de todas las agencias
    await loadGTFSData('metrovalencia');
    await loadGTFSData('tramcastellon');

    const map = initMap(); // Modificado para capturar la instancia del mapa

    drawStopsOnMap(map, 'metrovalencia');
    drawStopsOnMap(map, 'tramcastellon');

    drawRoutes(map, 'metrovalencia');
    drawRoutes(map, 'tramcastellon');
}

// Iniciar
startApp();