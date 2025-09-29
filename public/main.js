// =============================
// 1. Datos GTFS
// =============================
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {},
    almassora: {},
    tramalc: {}
};

// =============================
// 2. Iconos paradas
// =============================
const customStopIcon = L.divIcon({
    className: 'custom-stop-icon',
    html: '<div style="background-color: #3388ff; border-radius: 50%; width: 10px; height: 10px; border: 2px solid white;"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

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

// =============================
// 3. Cargar GTFS
// =============================
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
            console.error(`No se pudo cargar ${file} para ${agency}:`, error);
        }
    }
}

// =============================
// 4. Inicializar mapa
// =============================
function initMap() {
    const map = L.map('map').setView([39.4699, -0.3774], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    return map;
}

// =============================
// 5. Dibujar paradas
// =============================
function drawStopsOnMap(map, agency) {
    const stops = gtfsData[agency].stops || [];
    const stopTimes = gtfsData[agency].stop_times || [];
    const trips = gtfsData[agency].trips || [];
    const routes = gtfsData[agency].routes || [];

    let allowedTrips = trips;
    let allowedStopTimes = stopTimes;

if (agency === 'tramcastellon') {
    const allowedAgencies = ['5999', '510703'];
    const allowedRoutes = routes.filter(r => allowedAgencies.includes(r.agency_id));
    allowedTrips = trips.filter(t => allowedRoutes.some(r => r.route_id === t.route_id));
    allowedStopTimes = stopTimes.filter(st => allowedTrips.some(t => t.trip_id === st.trip_id));
}


    stops.forEach(stop => {
        const stopTimesForStop = allowedStopTimes.filter(st => st.stop_id === stop.stop_id);
        if (agency === 'tramcastellon' && stopTimesForStop.length === 0) return;

        let lat = parseFloat(stop.stop_lat?.replace(/["\s]/g, ''));
        let lon = parseFloat(stop.stop_lon?.replace(/["\s]/g, ''));

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

                const horarios = stopTimesForStop
                    .map(st => {
                        const trip = allowedTrips.find(t => t.trip_id === st.trip_id);
                        if (!trip) return null;
                        const ruta = routes.find(r => r.route_id === trip.route_id);
                        if (!ruta) return null;
                        return { linea: ruta.route_short_name || '', nombre: ruta.route_long_name || '', hora: st.departure_time };
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

// =============================
// 6. Dibujar rutas
// =============================
function drawRoutes(map, agency) {
    const routes = gtfsData[agency].routes || [];
    const trips = gtfsData[agency].trips || [];
    const shapes = gtfsData[agency].shapes || [];
    if (routes.length === 0 || trips.length === 0 || shapes.length === 0) return;

    const shapeMap = new Map();
    shapes.forEach(shape => {
        const shapeId = shape.shape_id?.trim();
        if (!shapeMap.has(shapeId)) shapeMap.set(shapeId, []);
        shapeMap.get(shapeId).push([parseFloat(shape.shape_pt_lat), parseFloat(shape.shape_pt_lon)]);
    });

    let filteredRoutes = routes;
    if (agency === 'tramcastellon') {
    const allowedAgencies = ['5999', '510703'];
    filteredRoutes = routes.filter(r => allowedAgencies.includes(r.agency_id));
}


    filteredRoutes.forEach(route => {
        let routeColor = `#${route.route_color || '000000'}`;
        if (agency === 'tramcastellon' && !route.route_color) routeColor = '#28a745';
        const routeName = route.route_short_name || route.route_long_name;
        const trip = trips.find(t => t.route_id === route.route_id && t.shape_id?.trim());
        if (!trip) return;
        const shapePoints = shapeMap.get(trip.shape_id?.trim());
        if (shapePoints && shapePoints.length > 0) {
            L.polyline(shapePoints, { color: routeColor, weight: 4, opacity: 0.8 })
                .addTo(map).bindPopup(`Línea: ${routeName}`);
        }
    });
}

// =============================
// 7. Mostrar info rutas
// =============================
function displayRoutesInfo(agency) {
    const routesInfoDiv = document.getElementById('routes-info');
    const routes = gtfsData[agency].routes || [];
    let filteredRoutes = routes;

    if (agency === 'tramcastellon') {
        const allowedAgencies = ['5999', '510703'];
        filteredRoutes = routes.filter(r => allowedAgencies.includes(r.agency_id));
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

// =============================
// 8. Incidencias en tiempo real
// =============================
const fonts = [
  {
    nom: 'Rodalia València',
    url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.renfe.com/content/renfe/es/es/grupo-renfe/comunicacion/renfe-al-dia/avisos/jcr:content/root/responsivegrid/rfincidentreports_co.noticeresults.json?noticetags=valencia'),
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Cercanias_Logo.svg',
    formatter: (incidencias) => {
      if (!incidencias || incidencias.length === 0) return 'No hi ha incidències.';
      const lineas = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
      const variantes = lineas.flatMap(l => [l, l.replace('C', 'C-')]);
      const incidenciasCercanias = incidencias.filter(i =>
        variantes.some(v => i.paragraph.includes(v))
      );
      if (incidenciasCercanias.length === 0) return 'No hi ha incidències en C1-C6.';
      return '<ul>' + incidenciasCercanias.map(i => {
        const texto = i.paragraph.replace(/\n/g, '<br>');
        const fecha = i.chipText ? `<small>${i.chipText}</small>` : '';
        return `<li><p>${texto}</p>${fecha}<br><a href="${i.link}" target="_blank">Más info</a></li>`;
      }).join('') + '</ul>';
    }
  },
  {
    nom: 'Metrovalencia',
    url: 'https://raw.githubusercontent.com/WireNext/MetroValenciaIncidencias/refs/heads/main/avisos_metrovalencia.json',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Isotip_de_Metroval%C3%A8ncia.svg',
    formatter: (incidencias) => {
      if (!incidencias || incidencias.length === 0) return 'No hi ha incidències.';
      return '<ul>' + incidencias.map(i => {
        const texto = i.texto_alerta.replace(/\n/g, '<br>');
        return `<li>${texto}</li>`;
      }).join('') + '</ul>';
    }
  },
  {
    nom: 'TRAM d’Alacant',
    url: 'https://raw.githubusercontent.com/WireNext/TramAlicanteIncidencias/refs/heads/main/avisos_tramalacant.json',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/TRAM_-_Metropolitano_de_Alicante_-T-.svg',
    formatter: (incidencias) => {
      if (!incidencias || incidencias.length === 0) return 'No hi ha incidències.';
      return '<ul>' + incidencias.map(i => {
        const texto = i.texto_alerta.replace(/\n/g, '<br>');
        return `<li>${texto}</li>`;
      }).join('') + '</ul>';
    }
  }
];

async function loadIncidencias() {
    const cont = document.getElementById('incidencias');
    cont.innerHTML = '';
    for (const fuente of fonts) {
        try {
            const res = await fetch(fuente.url);
            if (!res.ok) throw new Error("Error al cargar incidencias");
            const data = await res.json();
            const section = document.createElement('div');
            section.className = 'incidencia-section';
            section.innerHTML = `<h3><img src="${fuente.logo}" alt="${fuente.nom}" style="height:20px; vertical-align:middle;"> ${fuente.nom}</h3>`;
            section.innerHTML += fuente.formatter(data);
            cont.appendChild(section);
        } catch (e) {
            console.error("Error cargando incidencias de", fuente.nom, e);
        }
    }
}

// =============================
// 9. Iniciar app
// =============================
async function startApp() {
    await loadGTFSData('metrovalencia');
    await loadGTFSData('tramcastellon');
    await loadGTFSData('almassora');
    await loadGTFSData('tramalc');

    const map = initMap();
    drawStopsOnMap(map, 'metrovalencia');
    drawStopsOnMap(map, 'tramcastellon');
    drawStopsOnMap(map, 'almassora');
    drawStopsOnMap(map, 'tramalc');

    drawRoutes(map, 'metrovalencia');
    drawRoutes(map, 'tramcastellon');
    drawRoutes(map, 'almassora');
    drawRoutes(map, 'tramalc');

    displayRoutesInfo('metrovalencia');
    displayRoutesInfo('tramcastellon');
    displayRoutesInfo('almassora');
    displayRoutesInfo('tramalc');

    await loadIncidencias();
}

startApp();
