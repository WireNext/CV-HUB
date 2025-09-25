// Variable para almacenar los datos GTFS
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {}
};

// Icono personalizado para las paradas
const customStopIcon = L.divIcon({
    className: 'custom-stop-icon',
    html: '<div style="background-color: #3388ff; border-radius: 50%; width: 10px; height: 10px; border: 2px solid white;"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

// Actualizar tamaño del icono según zoom
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

// Cargar y procesar archivos GTFS
async function loadGTFSData(agency) {
    const dataDir = `./data/${agency}/`;
    const files = ['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'shapes.txt'];
    
    for (const file of files) {
        try {
            const response = await fetch(dataDir + file);
            if (!response.ok) throw new Error(`Error al cargar ${file}`);
            const text = await response.text();
            
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length <= 1) continue;
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

// Inicializar mapa
function initMap() {
    const map = L.map('map').setView([39.4699, -0.3774], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    return map;
}

// Dibujar paradas en el mapa con popup dinámico
function drawStopsOnMap(map, agency) {
    const stops = gtfsData[agency].stops || [];
    const stopTimes = gtfsData[agency].stop_times || [];
    const trips = gtfsData[agency].trips || [];
    const routes = gtfsData[agency].routes || [];

    // Filtrar trips y stop_times para tramcastellon según T1–T4
    let allowedTrips = trips;
    let allowedStopTimes = stopTimes;
    if (agency === 'tramcastellon') {
        const allowedRoutes = ['T1', 'T2', 'T3', 'T4'];
        allowedTrips = trips.filter(t => allowedRoutes.includes(
            routes.find(r => r.route_id === t.route_id)?.route_short_name
        ));
        allowedStopTimes = stopTimes.filter(st => allowedTrips.some(t => t.trip_id === st.trip_id));
    }

    stops.forEach(stop => {
        const stopTimesForStop = allowedStopTimes.filter(st => st.stop_id === stop.stop_id);
        if (agency === 'tramcastellon' && stopTimesForStop.length === 0) return; // ignorar paradas no filtradas

        let lat = parseFloat(stop.stop_lat?.replace(/["\s]/g,''));
        let lon = parseFloat(stop.stop_lon?.replace(/["\s]/g,''));
        
        if (!isNaN(lat) && !isNaN(lon)) {
            const marker = L.marker([lat, lon], { icon: customStopIcon }).addTo(map);
            marker.bindPopup("Cargando...");

            marker.on('click', () => {
                const ahora = new Date();

                function horaAFecha(horaStr) {
                    const [hh, mm, ss] = horaStr.split(':').map(Number);
                    const fecha = new Date(ahora);
                    fecha.setHours(hh, mm, ss, 0);
                    return fecha;
                }

                // Buscar horarios válidos en esa parada
                const horarios = stopTimesForStop
                    .map(st => {
                        const trip = allowedTrips.find(t => t.trip_id === st.trip_id);
                        if (!trip) return null;

                        const ruta = routes.find(r => r.route_id === trip.route_id);
                        if (!ruta) return null;

                        return {
                            linea: ruta.route_short_name || '',
                            nombre: ruta.route_long_name || '',
                            hora: st.departure_time
                        };
                    })
                    .filter(h => h !== null);

                const horariosConDiff = horarios.map(h => {
                    const fechaSalida = horaAFecha(h.hora);
                    let diffMin = (fechaSalida - ahora) / 60000;
                    if (diffMin < 0) diffMin += 24 * 60;
                    return { ...h, diffMin, fechaSalida };
                });

                horariosConDiff.sort((a, b) => a.diffMin - b.diffMin);
                const futuros = horariosConDiff.filter(h => h.diffMin >= 0);

                if (futuros.length === 0) {
                    marker.setPopupContent(`<strong>${stop.stop_name}</strong><br>No hay más servicios hoy.`);
                    return;
                }

                const proximosMinutos = futuros.slice(0, 2);
                const siguientesHoras = futuros.slice(2, 5);

                let html = `<strong>${stop.stop_name}</strong><br><ul>`;

                proximosMinutos.forEach(h => {
                    if (h.diffMin <= 1) {
                        html += `<li><b>${h.linea}</b> → ${h.nombre}: <span class="parpadeo" style="color:red;">en ${Math.round(h.diffMin)} min</span></li>`;
                    } else {
                        html += `<li><b>${h.linea}</b> → ${h.nombre}: en ${Math.round(h.diffMin)} min</li>`;
                    }
                });

                siguientesHoras.forEach(h => {
                    html += `<li><b>${h.linea}</b> → ${h.nombre}: ${h.hora}</li>`;
                });

                html += '</ul>';
                marker.setPopupContent(html);
            });

            updateIconSize(map, marker);
            map.on('zoom', () => updateIconSize(map, marker));
        }
    });
}

// Dibujar rutas
function drawRoutes(map, agency) {
    const routes = gtfsData[agency].routes || [];
    const trips = gtfsData[agency].trips || [];
    const shapes = gtfsData[agency].shapes || [];

    if (routes.length === 0 || trips.length === 0 || shapes.length === 0) return;

    const shapeMap = new Map();
    shapes.forEach(shape => {
        const shapeId = shape.shape_id?.trim();
        if (!shapeMap.has(shapeId)) shapeMap.set(shapeId, []);
        shapeMap.get(shapeId).push([
            parseFloat(shape.shape_pt_lat),
            parseFloat(shape.shape_pt_lon)
        ]);
    });

    let filteredRoutes = routes;
    if (agency === 'tramcastellon') {
        const allowedRoutes = ['T1','T2','T3','T4'];
        filteredRoutes = routes.filter(r => allowedRoutes.includes(r.route_short_name));
    }

    filteredRoutes.forEach(route => {
        let routeColor = `#${route.route_color || '000000'}`;
        if (agency === 'tramcastellon' && !route.route_color) routeColor = '#28a745';

        const routeName = route.route_short_name || route.route_long_name;
        const trip = trips.find(t => t.route_id === route.route_id && t.shape_id?.trim());
        if (!trip) return;

        const shapePoints = shapeMap.get(trip.shape_id?.trim());
        if (shapePoints && shapePoints.length > 0) {
            L.polyline(shapePoints, {
                color: routeColor,
                weight: 4,
                opacity: 0.8
            }).addTo(map).bindPopup(`Línea: ${routeName}`);
        }
    });
}

// Mostrar info de rutas
function displayRoutesInfo(agency) {
    const routesInfoDiv = document.getElementById('routes-info');
    const routes = gtfsData[agency].routes || [];

    let filteredRoutes = routes;
    if (agency === 'tramcastellon') {
        const allowedRoutes = ['T1','T2','T3','T4'];
        filteredRoutes = routes.filter(r => allowedRoutes.includes(r.route_short_name));
    }

    if (filteredRoutes.length === 0) {
        routesInfoDiv.innerHTML += `<p>No se encontraron datos de rutas para ${agency}.</p>`;
        return;
    }

    const agencyTitle = document.createElement('h3');
    agencyTitle.textContent = agency.charAt(0).toUpperCase() + agency.slice(1);
    routesInfoDiv.appendChild(agencyTitle);

    const routesList = document.createElement('ul');

    filteredRoutes.forEach(route => {
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
                if (list !== existingStopList) list.style.display = 'none';
            });

            if (existingStopList) {
                existingStopList.style.display = existingStopList.style.display === 'block' ? 'none' : 'block';
            } else {
                displayStopTimes(agency, route.route_id, routeItem);
            }
        });
    });

    routesInfoDiv.appendChild(routesList);
}

// Mostrar horarios de una ruta
function displayStopTimes(agency, routeId, containerElement) {
    const trips = gtfsData[agency].trips;
    const stopTimes = gtfsData[agency].stop_times;
    const stops = gtfsData[agency].stops;

    const sampleTrip = trips.find(t => t.route_id === routeId);
    if (!sampleTrip) return;

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

// Iniciar app
async function startApp() {
    await loadGTFSData('metrovalencia');
    await loadGTFSData('tramcastellon');

    const map = initMap();

    drawStopsOnMap(map, 'metrovalencia');
    drawStopsOnMap(map, 'tramcastellon');

    drawRoutes(map, 'metrovalencia');
    drawRoutes(map, 'tramcastellon');

    displayRoutesInfo('metrovalencia');
    displayRoutesInfo('tramcastellon');
}

startApp();
