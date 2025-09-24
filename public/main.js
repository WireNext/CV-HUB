// Inicializar el mapa centrado en Castellón
const map = L.map('map').setView([39.9864, -0.0513], 13);

// Añadir capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Diccionario para almacenar los datos GTFS cargados
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {},
    almassoraurbano: {}
};

// Diccionario para almacenar los layerGroups de cada agencia
const agencyLayers = {
    metrovalencia: L.layerGroup().addTo(map),
    tramcastellon: L.layerGroup().addTo(map),
    almassoraurbano: L.layerGroup().addTo(map)
};

// Función para cargar y parsear archivos CSV de GTFS
async function loadGTFSData(agency, files) {
    for (const file of files) {
        const response = await fetch(`gtfs/${agency}/${file}.txt`);
        const text = await response.text();
        gtfsData[agency][file] = Papa.parse(text, { header: true }).data;
    }
}

// Ícono personalizado para las paradas
const customStopIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61205.png',
    iconSize: [20, 20]
});

// Dibujar paradas en el mapa dentro del layer correspondiente
function drawStopsOnMap(agency) {
    const stops = gtfsData[agency].stops || [];
    const layer = agencyLayers[agency];
    stops.forEach(stop => {
        const marker = L.marker(
            [parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)],
            { icon: customStopIcon }
        ).bindPopup(`<b>${stop.stop_name}</b><br>ID: ${stop.stop_id}`);
        layer.addLayer(marker);
    });
}

// Dibujar rutas en el mapa dentro del layer correspondiente
function drawRoutes(agency) {
    const routes = gtfsData[agency].routes || [];
    const trips = gtfsData[agency].trips || [];
    const shapes = gtfsData[agency].shapes || [];
    const layer = agencyLayers[agency];

    // Construir mapa de shapes
    const shapeMap = new Map();
    shapes.forEach(shape => {
        if (!shapeMap.has(shape.shape_id)) {
            shapeMap.set(shape.shape_id, []);
        }
        shapeMap.get(shape.shape_id).push({
            lat: parseFloat(shape.shape_pt_lat),
            lon: parseFloat(shape.shape_pt_lon),
            seq: parseInt(shape.shape_pt_sequence, 10)
        });
    });

    // Ordenar puntos por secuencia
    shapeMap.forEach((points, shapeId) => {
        points.sort((a, b) => a.seq - b.seq);
        shapeMap.set(shapeId, points.map(p => [p.lat, p.lon]));
    });

    // Pintar polilíneas
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
            }).bindPopup(`Línea: ${routeName}`);
            layer.addLayer(polyline);
        }
    });
}

// Mostrar información de rutas
function displayRoutesInfo(agency) {
    const routes = gtfsData[agency].routes || [];
    const routeList = document.getElementById('route-list');

    routes.forEach(route => {
        const listItem = document.createElement('li');
        listItem.textContent = `${route.route_short_name || route.route_long_name}`;
        listItem.style.color = `#${route.route_color || '000000'}`;
        listItem.onclick = () => displayStopTimes(agency, route.route_id);
        routeList.appendChild(listItem);
    });
}

// Mostrar horarios de una ruta
function displayStopTimes(agency, routeId) {
    const stopTimes = gtfsData[agency].stop_times || [];
    const trips = gtfsData[agency].trips || [];
    const stops = gtfsData[agency].stops || [];

    const trip = trips.find(t => t.route_id === routeId);
    if (!trip) return;

    const tripStopTimes = stopTimes
        .filter(st => st.trip_id === trip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10));

    const stopTimesList = document.getElementById('stop-times-list');
    stopTimesList.innerHTML = '';

    tripStopTimes.forEach(st => {
        const stop = stops.find(s => s.stop_id === st.stop_id);
        if (stop) {
            const listItem = document.createElement('li');
            listItem.textContent = `${stop.stop_name}: ${st.arrival_time}`;
            stopTimesList.appendChild(listItem);
        }
    });
}

// Activar/desactivar capas desde checkboxes
function setupLayerControls() {
    const checkboxes = document.querySelectorAll('.agency-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const agency = cb.value;
            if (cb.checked) {
                map.addLayer(agencyLayers[agency]);
            } else {
                map.removeLayer(agencyLayers[agency]);
            }
        });
    });
}

// Inicializar todo
async function init() {
    const agencies = ['metrovalencia', 'tramcastellon', 'almassoraurbano'];
    for (const agency of agencies) {
        await loadGTFSData(agency, ['routes', 'trips', 'shapes', 'stops', 'stop_times']);
        drawStopsOnMap(agency);
        drawRoutes(agency);
        displayRoutesInfo(agency);
    }

    setupLayerControls();
}

init();
