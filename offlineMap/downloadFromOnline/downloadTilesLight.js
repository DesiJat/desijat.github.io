const fs = require('fs');
const https = require('https');
const path = require('path');

const BASE_DIR = '/Users/apple/data/camera/public/map/tiles/light';
const LAT = 30.703852;
const LNG = 76.708162;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const RADIUS = 5; // Increased radius to cover more area

const TILE_URL = 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png';

function latLngToTile(lat, lng, zoom) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

async function downloadTile(z, x, y) {
    const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const dir = path.join(BASE_DIR, `${z}/${x}`);
    const filePath = path.join(dir, `${y}.png`);

    if (fs.existsSync(filePath)) {
        // Double check file size - if it's 6987 bytes, it's the blocked tile, delete it
        const stats = fs.statSync(filePath);
        if (stats.size !== 6987) return;
        fs.unlinkSync(filePath);
    }

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        // const headers = {};
        const headers = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            "cache-control": "max-age=0",
            "if-none-match": '"21a13d2ccfa7a0bb82ef9315853f6c37"',
            "priority": "u=0, i",
            "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        }
        https.get(url, { headers }, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${z}/${x}/${y}.png`);
                resolve();
            });
        }).on('error', err => {
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
}

async function run() {
    console.log(`Starting download for area around ${LAT}, ${LNG}...`);
    for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
        const center = latLngToTile(LAT, LNG, z);
        const tasks = [];
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            for (let dy = -RADIUS; dy <= RADIUS; dy++) {
                tasks.push(downloadTile(z, center.x + dx, center.y + dy));
            }
        }
        await Promise.all(tasks).catch(err => console.error(err.message));
    }
    console.log('✅ Download complete!');
}

run();

