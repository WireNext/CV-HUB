// Variable para almacenar los datos GTFS
const gtfsData = {
    metrovalencia: {},
    tramcastellon: {}
};

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
            // Implementa aquí tu lógica de parseo de CSV
            // Por ejemplo, usando una librería como 'Papa Parse' o un parser simple
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

    // Aquí es donde dibujarías las líneas y paradas una vez cargados los datos
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

    // Aquí iría la lógica para dibujar las líneas de las rutas usando `shapes.txt`
    // Esta parte es más compleja y requiere unir los datos de `shapes.txt` y `trips.txt`
}

// Función principal para iniciar la aplicación
async function startApp() {
    // Cargar los datos de todas las agencias
    await loadGTFSData('metrovalencia');
    await loadGTFSData('tramcastellon');

    // Inicializar el mapa una vez que los datos estén listos
    initMap();

    // Ahora puedes usar los datos para generar horarios y otra información
    console.log("Datos GTFS cargados:", gtfsData);
}

// Iniciar
startApp();