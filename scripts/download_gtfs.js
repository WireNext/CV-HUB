const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const gtfsSources = {
    metrovalencia: 'http://www.metrovalencia.es/google_transit_feed/google_transit.zip',
    tramcastellon: 'https://gvinterbus.gva.es/estatico/gtfs.zip'
};

async function downloadAndExtract() {
    console.log('Iniciando descarga y extracción de archivos GTFS...');

    for (const [agency, url] of Object.entries(gtfsSources)) {
        const destDir = path.join(__dirname, '..', 'public', 'data', agency);
        
        // Limpiar el directorio antiguo
        if (fs.existsSync(destDir)) {
            fs.rmSync(destDir, { recursive: true, force: true });
        }
        fs.mkdirSync(destDir, { recursive: true });

        console.log(`Descargando datos de ${agency}...`);
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            const zipPath = path.join(destDir, 'data.zip');
            const writer = fs.createWriteStream(zipPath);

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(`Extrayendo archivos para ${agency}...`);
            await fs.createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: destDir }))
                .promise();

            fs.unlinkSync(zipPath); // Borrar el archivo .zip

            console.log(`¡Datos de ${agency} actualizados con éxito!`);
        } catch (error) {
            console.error(`Error al procesar los datos de ${agency}:`, error.message);
        }
    }
}

downloadAndExtract();