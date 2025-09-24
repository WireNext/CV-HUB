// Variable para almacenar los datos GTFS. Debe estar solo una vez.
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {},
    almassoraurba: {}
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
    const zoomLevel = map.getZoom();
    let iconSize = 0;

    if (zoomLevel >= 14) {
        iconSize = (zoomLevel - 13) * 3;
        if (iconSize > 25) iconSize = 25;
    } else {
        iconSize = 0;
    }

    const newIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `<div style="background-color: #3388ff; border-radius: 50%; width: ${iconSize}px; height: ${iconSize}px; border: 2px solid white;"></div>`,
        iconSize: [iconSize + 4, iconSize + 4],
        iconAnchor: [iconSize / 2 + 2, iconSize / 2 + 2]
    });

    marker.setIcon(newIcon);
}

// Función para cargar y procesar los archivos GTFS (usando un parser simple)
async function loadGTFSData(agency) {
    const dataDir = `./data/${agency}/`;
    const files = ['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'shapes.txt'];
    
    for (const file of files) {
        try {
            const response = await fetch(dataDir + file);
            if (!response.ok) throw new Error(`Error al cargar ${file}`);
            const text = await response.text();
            
            // Lógica de parsing de CSV (puedes mejorarla con Papa Parse)
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length <= 1) continue; // Si el archivo está vacío, saltar
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
    const map = L.map('map').setView([39.4699, -0.3774], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    return map;
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

    const shapeMap = new Map();
    shapes.forEach(shape => {
        if (!shapeMap.has(shape.shape_id)) {
            shapeMap.set(shape.shape_id, []);
        }
        shapeMap.get(shape.shape_id).push([shape.shape_pt_lat, shape.shape_pt_lon]);
    });

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

// Función para generar y mostrar la información de las rutas de forma única
function displayRoutesInfo(agency) {
    const routesInfoDiv = document.getElementById('routes-info');
    const routes = gtfsData[agency].routes || [];
    
    // Usamos un Map para almacenar una entrada única por cada nombre de ruta
    const uniqueRoutesMap = new Map();

    // Iterar sobre las rutas para agrupar por route_short_name
    routes.forEach(route => {
        const routeName = route.route_short_name;
        if (routeName && !uniqueRoutesMap.has(routeName)) {
            // Guarda la primera instancia que encuentres de cada nombre de ruta
            uniqueRoutesMap.set(routeName, route);
        }
    });

    if (uniqueRoutesMap.size === 0) {
        routesInfoDiv.innerHTML += `<p>No se encontraron datos de rutas para ${agency}.</p>`;
        return;
    }

    const agencyTitle = document.createElement('h3');
    agencyTitle.textContent = agency.charAt(0).toUpperCase() + agency.slice(1);
    routesInfoDiv.appendChild(agencyTitle);

    const routesList = document.createElement('ul');
    // Iterar sobre el mapa de rutas únicas para crear la lista
    uniqueRoutesMap.forEach(route => {
        const routeItem = document.createElement('li');
        routeItem.className = 'route-item';
        routeItem.dataset.routeId = route.route_id;

        const routeNameSpan = document.createElement('span');
        routeNameSpan.textContent = route.route_short_name;
        routeNameSpan.style.color = `#${route.route_color || 'black'}`;
        
        routeItem.appendChild(routeNameSpan);
        routesList.appendChild(routeItem);

        routeItem.addEventListener('click', () => {
            const existingStopList = routeItem.querySelector('.stop-list');
            
            document.querySelectorAll('.stop-list').forEach(list => {
                if (list !== existingStopList) {
                    list.style.display = 'none';
                }
            });

            if (existingStopList) {
                if (existingStopList.style.display === 'block') {
                    existingStopList.style.display = 'none';
                } else {
                    existingStopList.style.display = 'block';
                }
            } else {
                displayStopTimes(agency, route.route_id, routeItem);
            }
        });
    });

    routesInfoDiv.appendChild(routesList);
}

// Función para mostrar las paradas y horarios de una ruta específica
function displayStopTimes(agency, routeId, containerElement) {
    const trips = gtfsData[agency].trips;
    const stopTimes = gtfsData[agency].stop_times;
    const stops = gtfsData[agency].stops;
    
    // Encuentra un viaje que pertenezca a esta ruta para obtener la secuencia de paradas.
    // Usamos .find() para tomar solo un ejemplo de viaje.
    const sampleTrip = trips.find(t => t.route_id === routeId);
    if (!sampleTrip) {
        containerElement.innerHTML += `<p>No se encontraron horarios para esta ruta.</p>`;
        return;
    }

    // Obtener todas las paradas de este viaje, ordenadas por secuencia
    const tripStopTimes = stopTimes.filter(st => st.trip_id === sampleTrip.trip_id)
                                    .sort((a, b) => a.stop_sequence - b.stop_sequence);

    const stopList = document.createElement('ul');
    stopList.className = 'stop-list';

    tripStopTimes.forEach(st => {
        const stop = stops.find(s => s.stop_id === st.stop_id);
        if (stop) {
            const stopItem = document.createElement('li');
            stopItem.textContent = `${stop.stop_name} (Llegada: ${st.arrival_time})`;
            stopList.appendChild(stopItem);
        }
    });

    containerElement.appendChild(stopList);
}

// Función principal para iniciar la aplicación
async function startApp() {
    // Cargar los datos de todas las agencias
    await loadGTFSData('metrovalencia');
    await loadGTFSData('tramcastellon');
    await loadGTFSData('almassoraurba');

    // Inicializar el mapa solo una vez, después de cargar los datos
    const map = initMap();

    // Dibujar las paradas y las rutas con los datos cargados
    drawStopsOnMap(map, 'metrovalencia');
    drawStopsOnMap(map, 'tramcastellon');
    drawStopsOnMap(map, 'almassoraurbano');

    drawRoutes(map, 'metrovalencia');
    drawRoutes(map, 'tramcastellon');
    drawRoutes(map, 'almassoraurbano');


    displayRoutesInfo('metrovalencia');
    displayRoutesInfo('tramcastellon');
    displayRoutesInfo('almassoraurbano');

}

// Iniciar la aplicación
startApp();