
// ─── IndexedDB Tile Cache ───
const DB_NAME = 'OfflineMapTiles';
const DB_VERSION = 1;
const STORE_NAME = 'tiles';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function storeTile(key, blob) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function getTile(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function countTiles() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
    });
}

function clearAllTiles() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// ─── Offline-focused Tile Layer ───
const CachedTileLayer = L.TileLayer.extend({
    createTile: function (coords, done) {
        const tile = document.createElement('img');
        const url = this.getTileUrl(coords);
        const theme = this.options.theme || 'light';
        const key = `${theme}_${coords.z}/${coords.x}/${coords.y}`;

        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        // Check IndexedDB first (legacy cache), then local folder (standard URL)
        getTile(key).then(blob => {
            if (blob) {
                tile.src = URL.createObjectURL(blob);
                done(null, tile);
            } else {
                // Just use the URL which points to the local 'tiles/' folder now
                tile.src = url;
                tile.onload = () => done(null, tile);
                tile.onerror = () => {
                    // If local folder doesn't have it, we could try network 
                    // but the user wants "Fully Offline", so we'll just show error
                    done(new Error('Tile not available offline'), tile);
                };
            }
        }).catch(() => {
            tile.src = url;
            tile.onload = () => done(null, tile);
            tile.onerror = () => done(new Error('Tile error'), tile);
        });

        return tile;
    }
});

// ─── Initialize Map ───
let map, userMarker, userCircle, tileLayer;
let isTracking = false;
let watchId = null;
let isDarkMode = false;

const TILE_SOURCES = {
    light: {
        url: 'tiles/light/{z}/{x}/{y}.png',
        attribution: '&copy; Local Offline Tiles',
        subdomains: ''
    },
    dark: {
        url: 'tiles/dark/{z}/{x}/{y}.png',
        attribution: '&copy; Local Offline Tiles',
        subdomains: ''
    }
};

let sharedMarker = null;

function shareLocation() {
    const center = map.getCenter();
    const alt = document.getElementById('infoAlt').textContent;
    const altParam = alt !== 'Unavailable' ? `,${alt.replace('m', '')}` : '';

    const shareUrl = `${window.location.origin}${window.location.pathname}?shared=${center.lat.toFixed(6)},${center.lng.toFixed(6)}${altParam}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Share link copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy link', 'error');
    });
}

function checkSharedLocation() {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');

    if (shared) {
        const parts = shared.split(',');
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            const alt = parts[2] ? parts[2] + 'm' : null;

            if (!isNaN(lat) && !isNaN(lng)) {
                const latlng = [lat, lng];

                if (sharedMarker) map.removeLayer(sharedMarker);

                sharedMarker = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'shared-marker',
                        html: '<div class="shared-marker-pulse"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map);

                const popupContent = alt ? `<b>Shared Location</b><br>Altitude: ${alt}` : `<b>Shared Location</b>`;
                sharedMarker.bindPopup(popupContent).openPopup();

                map.setView(latlng, 15);
                showToast('Viewing shared location', 'success');
            }
        }
    }
}

async function initMap() {
    await openDB();

    // Default center (India)
    const defaultLat = 20.5937;
    const defaultLng = 78.9629;

    map = L.map('map', {
        center: [defaultLat, defaultLng],
        zoom: 5,
        zoomControl: false,
        attributionControl: true
    });

    // Use light OpenStreetMap tiles by default
    const src = TILE_SOURCES.light;
    tileLayer = new CachedTileLayer(src.url, {
        attribution: src.attribution,
        subdomains: src.subdomains,
        maxZoom: 19,
        theme: 'light'
    });
    tileLayer.addTo(map);

    // Update info on map events
    map.on('moveend', updateMapInfo);
    map.on('zoomend', updateMapInfo);
    map.on('click', (e) => {
        if (isSelectingStart) {
            setWaypoint('start', e.latlng);
            startSelecting('end'); // Auto switch to end
        } else if (isSelectingEnd) {
            setWaypoint('end', e.latlng);
            stopSelecting();
        } else {
            document.getElementById('infoLat').textContent = e.latlng.lat.toFixed(6);
            document.getElementById('infoLng').textContent = e.latlng.lng.toFixed(6);
        }
    });

    updateMapInfo();
    updateCacheCount();
    updateOnlineStatus();

    // Listen for online/offline
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check for shared location from URL
    checkSharedLocation();

    // Try to get user location on load (only if no shared location)
    if (!window.location.search.includes('shared')) {
        locateUser();
    }
}

// ─── Solar & Time Logic ───
function updateClock() {
    const now = new Date();
    document.getElementById('infoTime').textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

function getSolarTimes(lat, lng) {
    const date = new Date();
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

    // Simplified Solar Calculation (approximate)
    const zenith = 90.83333333333333; // sunset/sunrise zenith
    const D2R = Math.PI / 180;
    const R2D = 180 / Math.PI;

    // 1. calculate the day of the year
    const N = dayOfYear;

    // 2. convert the longitude to hour value and calculate an approximate time
    const lngHour = lng / 15;
    const t_rise = N + ((6 - lngHour) / 24);
    const t_set = N + ((18 - lngHour) / 24);

    const calculateForTime = (t, isSunrise) => {
        // 3. calculate the Sun's mean anomaly
        const M = (0.9856 * t) - 3.289;

        // 4. calculate the Sun's true longitude
        let L = M + (1.916 * Math.sin(M * D2R)) + (0.020 * Math.sin(2 * M * D2R)) + 282.634;
        if (L > 360) L -= 360;
        if (L < 0) L += 360;

        // 5a. calculate the Sun's right ascension
        let RA = R2D * Math.atan(0.91764 * Math.tan(L * D2R));
        if (RA > 360) RA -= 360;
        if (RA < 0) RA += 360;

        // 5b. right ascension value needs to be in the same quadrant as L
        const Lquadrant = (Math.floor(L / 90)) * 90;
        const RAquadrant = (Math.floor(RA / 90)) * 90;
        RA = RA + (Lquadrant - RAquadrant);

        // 5c. right ascension value needs to be converted into hours
        RA = RA / 15;

        // 6. calculate the Sun's declination
        const sinDec = 0.39782 * Math.sin(L * D2R);
        const cosDec = Math.cos(Math.asin(sinDec));

        // 7a. calculate the Sun's local hour angle
        const cosH = (Math.cos(zenith * D2R) - (sinDec * Math.sin(lat * D2R))) / (cosDec * Math.cos(lat * D2R));

        if (cosH > 1) return null; // Sun never rises
        if (cosH < -1) return null; // Sun never sets

        // 7b. finish calculating H and convert into hours
        let H;
        if (isSunrise) H = 360 - R2D * Math.acos(cosH);
        else H = R2D * Math.acos(cosH);
        H = H / 15;

        // 8. calculate local mean time of rising/setting
        const T = H + RA - (0.06571 * t) - 6.622;

        // 9. adjust back to UTC
        let UT = T - lngHour;
        if (UT > 24) UT -= 24;
        if (UT < 0) UT += 24;

        // 10. convert UT value to local time zone of system
        const now = new Date();
        const offset = -now.getTimezoneOffset() / 60;
        let localT = UT + offset;
        if (localT > 24) localT -= 24;
        if (localT < 0) localT += 24;

        const h = Math.floor(localT);
        const m = Math.floor((localT - h) * 60);
        const s = new Date();
        s.setHours(h, m, 0);
        return s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return {
        sunrise: calculateForTime(t_rise, true),
        sunset: calculateForTime(t_set, false)
    };
}

function updateMapInfo() {
    const center = map.getCenter();
    document.getElementById('infoLat').textContent = center.lat.toFixed(6);
    document.getElementById('infoLng').textContent = center.lng.toFixed(6);
    document.getElementById('infoZoom').textContent = map.getZoom();

    const solar = getSolarTimes(center.lat, center.lng);
    document.getElementById('infoSunrise').textContent = solar.sunrise || 'N/A';
    document.getElementById('infoSunset').textContent = solar.sunset || 'N/A';
}

async function updateCacheCount() {
    const count = await countTiles();
    document.getElementById('infoCached').textContent = count.toLocaleString();
    document.getElementById('cacheCount').textContent = count.toLocaleString();
}

function updateOnlineStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (navigator.onLine) {
        dot.className = 'status-dot online';
        text.textContent = 'Online';
    } else {
        dot.className = 'status-dot cached';
        text.textContent = 'Offline (Cached)';
    }
}

// ─── GPS Location ───
function locateUser() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }

    const btnLocate = document.getElementById('btnLocate');
    btnLocate.classList.add('active');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude, accuracy, altitude } = pos.coords;
            map.setView([latitude, longitude], 15);

            // Update UI info
            document.getElementById('infoLat').textContent = latitude.toFixed(6);
            document.getElementById('infoLng').textContent = longitude.toFixed(6);
            document.getElementById('infoAlt').textContent = altitude ? altitude.toFixed(1) + ' m' : 'Unavailable';

            if (userMarker) {
                userMarker.setLatLng([latitude, longitude]);
                userCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
            } else {
                // Custom user icon
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `<div style="
                                width: 18px; height: 18px;
                                background: linear-gradient(135deg, #60a5fa, #a78bfa);
                                border: 3px solid rgba(255,255,255,0.9);
                                border-radius: 50%;
                                box-shadow: 0 0 16px rgba(96, 165, 250, 0.6);
                            "></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });

                userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
                userCircle = L.circle([latitude, longitude], {
                    radius: accuracy,
                    color: 'rgba(96, 165, 250, 0.3)',
                    fillColor: 'rgba(96, 165, 250, 0.08)',
                    fillOpacity: 0.5,
                    weight: 1
                }).addTo(map);
            }

            showToast('📍 Location found', 'success');
            btnLocate.classList.remove('active');
        },
        (err) => {
            showToast('Location error: ' + err.message, 'error');
            btnLocate.classList.remove('active');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ─── Tile Caching ───
async function cacheCurrentView() {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    await cacheTilesInBounds(bounds, zoom, zoom);
}

async function cacheArea() {
    const bounds = map.getBounds();
    const currentZoom = map.getZoom();
    const minZoom = Math.max(1, currentZoom - 2);
    const maxZoom = Math.min(17, currentZoom + 3);
    await cacheTilesInBounds(bounds, minZoom, maxZoom);
}

async function cacheTilesInBounds(bounds, minZoom, maxZoom) {
    const tiles = [];

    for (let z = minZoom; z <= maxZoom; z++) {
        const minTile = latLngToTile(bounds.getSouthWest(), z);
        const maxTile = latLngToTile(bounds.getNorthEast(), z);

        for (let x = minTile.x; x <= maxTile.x; x++) {
            for (let y = maxTile.y; y <= minTile.y; y++) {
                tiles.push({ x, y, z });
            }
        }
    }

    // Limit to 2000 tiles
    if (tiles.length > 2000) {
        showToast(`Too many tiles (${tiles.length}). Zoom in more.`, 'error');
        return;
    }

    const progress = document.getElementById('progressContainer');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    progress.classList.add('active');

    let cached = 0;
    const total = tiles.length;

    showToast(`Caching ${total} tiles...`, 'success');

    for (const tile of tiles) {
        const theme = isDarkMode ? 'dark' : 'light';
        const key = `${theme}_${tile.z}/${tile.x}/${tile.y}`;
        const existing = await getTile(key);
        if (!existing) {
            const src = isDarkMode ? TILE_SOURCES.dark : TILE_SOURCES.light;
            const subs = src.subdomains.split('');
            const s = subs[Math.floor(Math.random() * subs.length)];
            const url = src.url.replace('{s}', s).replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y).replace('{r}', '');
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const blob = await res.blob();
                    await storeTile(key, blob);
                }
            } catch (e) {
                // Skip failed tiles
            }
        }
        cached++;
        const pct = Math.round((cached / total) * 100);
        fill.style.width = pct + '%';
        text.textContent = `${cached} / ${total} tiles`;
    }

    fill.style.width = '100%';
    text.textContent = 'Done!';
    await updateCacheCount();
    showToast(`✅ Cached ${total} tiles`, 'success');

    setTimeout(() => {
        progress.classList.remove('active');
        fill.style.width = '0%';
    }, 2000);
}

function latLngToTile(latlng, zoom) {
    const lat = latlng.lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    return {
        x: Math.floor((latlng.lng + 180) / 360 * n),
        y: Math.floor((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n)
    };
}

async function clearTileCache() {
    const overlay = document.getElementById('modalOverlay');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    overlay.classList.add('active');

    return new Promise((resolve) => {
        const handleCancel = () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        const handleConfirm = async () => {
            overlay.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            await clearAllTiles();
            await updateCacheCount();
            showToast('🗑️ Cache cleared', 'success');
            resolve(true);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) handleCancel();
        };
    });
}

// ─── Routing Logic ───
let routeStart = null;
let routeEnd = null;
let routeLayer = null;
let startMarker = null;
let endMarker = null;
let isSelectingStart = false;
let isSelectingEnd = false;

function toggleRouting() {
    const panel = document.getElementById('routingPanel');
    const isActive = panel.classList.toggle('hidden');
    document.getElementById('btnRouting').classList.toggle('active', !isActive);

    if (!isActive) {
        // When opening, default to selecting Start if empty
        if (!routeStart) startSelecting('start');
    } else {
        stopSelecting();
    }
}

function startSelecting(type) {
    stopSelecting();
    if (type === 'start') {
        isSelectingStart = true;
        document.getElementById('btnSelectStart').classList.add('selecting');
        showToast('Click map to set START', 'success');
    } else {
        isSelectingEnd = true;
        document.getElementById('btnSelectEnd').classList.add('selecting');
        showToast('Click map to set DESTINATION', 'success');
    }
    map.getContainer().style.cursor = 'crosshair';
}

function stopSelecting() {
    isSelectingStart = false;
    isSelectingEnd = false;
    document.getElementById('btnSelectStart').classList.remove('selecting');
    document.getElementById('btnSelectEnd').classList.remove('selecting');
    map.getContainer().style.cursor = '';
}

async function setWaypoint(type, latlng) {
    const label = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    if (type === 'start') {
        routeStart = latlng;
        document.getElementById('routeFrom').value = label;
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'start-marker',
                html: '<div style="background:#2563eb; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>',
                iconSize: [12, 12]
            })
        }).addTo(map);
    } else {
        routeEnd = latlng;
        document.getElementById('routeTo').value = label;
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'end-marker',
                html: '<div style="background:#ef4444; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>',
                iconSize: [12, 12]
            })
        }).addTo(map);
    }
}

function parseCoordinates(val) {
    if (!val) return null;
    const parts = val.split(/[\s,]+/);
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }
    return null;
}

async function copyCoord(type) {
    const val = document.getElementById(type === 'lat' ? 'infoLat' : 'infoLng').textContent;
    if (val === '—') return;
    try {
        await navigator.clipboard.writeText(val);
        showToast(`Copied ${type === 'lat' ? 'Latitude' : 'Longitude'}`, 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
}

async function getRoute() {
    if (!routeStart || !routeEnd) {
        showToast('Please set both Start and End points', 'error');
        return;
    }

    try {
        showToast('Calculating offline route...', 'success');
        
        // Fetch local network data
        const response = await fetch('data/network.geojson');
        const data = await response.json();

        // Simple distance-based nearest point routing (Mock logic for fully offline)
        // In a real scenario, you'd use a library like @turf/turf or a precomputed graph
        // For now, we simulate finding a path through the GeoJSON network
        
        const coordinates = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.polyline(coordinates, {
            color: '#2563eb',
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Mock route data for display
        const mockRoute = {
            distance: 15000,
            duration: 1200,
            legs: [{
                steps: [
                    { maneuver: { instruction: "Head north on local network" }, distance: 5000, name: "Local Road" },
                    { maneuver: { instruction: "Turn right toward destination" }, distance: 10000, name: "Main St" }
                ]
            }]
        };
        displayInstructions(mockRoute);
        
    } catch (err) {
        console.error(err);
        showToast('Offline routing data missing', 'error');
    }
}

function displayInstructions(route) {
    const list = document.getElementById('instructionList');
    const container = document.getElementById('routeInstructions');
    list.innerHTML = '';

    document.getElementById('routeDist').textContent = (route.distance / 1000).toFixed(1) + ' km';
    document.getElementById('routeTime').textContent = Math.round(route.duration / 60) + ' min';

    route.legs[0].steps.forEach(step => {
        const item = document.createElement('li');
        item.className = 'instruction-item';

        // Fallback for missing instruction string
        let instr = step.maneuver.instruction;
        if (!instr) {
            const type = step.maneuver.type || 'continue';
            const modifier = step.maneuver.modifier || '';
            const road = step.name ? ` onto ${step.name}` : '';

            const actions = {
                'turn': 'Turn',
                'depart': 'Head',
                'arrive': 'Arrive at destination',
                'merge': 'Merge',
                'on ramp': 'Take ramp',
                'off ramp': 'Take exit'
            };

            if (type === 'arrive') {
                instr = 'Arrive at destination';
            } else if (type === 'depart') {
                instr = `Head northwest${road}`;
            } else {
                const action = actions[type] || 'Continue';
                instr = `${action} ${modifier}${road}`.trim();
            }
        }

        item.innerHTML = `
                    <span class="instruction-icon">➔</span>
                    <span>${instr} (${Math.round(step.distance)}m)</span>
                `;
        list.appendChild(item);
    });

    container.classList.add('active');
}

function clearRoute() {
    if (routeLayer) map.removeLayer(routeLayer);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    routeStart = null;
    routeEnd = null;
    document.getElementById('routeFrom').value = '';
    document.getElementById('routeTo').value = '';
    document.getElementById('routeInstructions').classList.remove('active');
    document.getElementById('routeDist').textContent = '0 km';
    document.getElementById('routeTime').textContent = '0 min';
    stopSelecting();
}

// ─── Search (Nominatim) ───
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                // Fetch local locations
                const res = await fetch('data/locations.json');
                const data = await res.json();
                
                const filtered = data.filter(item => 
                    item.name.toLowerCase().includes(query) || 
                    item.display_name.toLowerCase().includes(query)
                ).slice(0, 5);

                if (filtered.length === 0) {
                    searchResults.style.display = 'none';
                    return;
                }

                searchResults.innerHTML = filtered.map(item => `
                            <div class="search-result-item" onclick="goToLocation(${item.lat}, ${item.lon}, '${item.display_name.replace(/'/g, "\\'")}')">
                                <div class="name">${item.name}</div>
                                <div class="detail">${item.display_name}</div>
                            </div>
                        `).join('');
                searchResults.style.display = 'block';
            } catch (err) {
                console.error(err);
                // showToast('Search requires internet', 'error');
            }
        }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSearch();
        }
    });
});

function goToLocation(lat, lng, name) {
    map.setView([lat, lng], 14);
    L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>${name.split(',')[0]}</b>`)
        .openPopup();
    toggleSearch();
    showToast(`📍 ${name.split(',')[0]}`, 'success');
}

// ─── UI Controls ───
function toggleSearch() {
    const box = document.getElementById('searchBox');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        document.getElementById('searchInput').focus();
        document.getElementById('btnSearch').classList.add('active');
    } else {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('btnSearch').classList.remove('active');
    }
}

function toggleCachePanel() {
    const panel = document.getElementById('cachePanel');
    panel.classList.toggle('hidden');
    document.getElementById('btnLayers').classList.toggle('active', !panel.classList.contains('hidden'));
}

function toggleInfo() {
    const panel = document.getElementById('infoPanel');
    panel.classList.toggle('hidden');
    document.getElementById('btnInfo').classList.toggle('active', !panel.classList.contains('hidden'));
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    const src = isDarkMode ? TILE_SOURCES.dark : TILE_SOURCES.light;
    map.removeLayer(tileLayer);
    tileLayer = new CachedTileLayer(src.url, {
        attribution: src.attribution,
        subdomains: src.subdomains,
        maxZoom: 19,
        theme: isDarkMode ? 'dark' : 'light'
    });
    tileLayer.addTo(map);

    // Update button icon
    document.getElementById('btnTheme').textContent = isDarkMode ? '☀️' : '🌙';

    // Toggle body class for UI adaptation
    document.body.classList.toggle('light-mode', !isDarkMode);

    showToast(isDarkMode ? '🌙 Dark mode' : '☀️ Light mode', 'success');
}

// ─── Toast ───
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.className = 'toast';
    }, 2500);
}

// ─── Button Listeners ───
document.getElementById('btnLocate').addEventListener('click', locateUser);
document.getElementById('btnSearch').addEventListener('click', toggleSearch);
document.getElementById('btnTheme').addEventListener('click', toggleTheme);
document.getElementById('btnLayers').addEventListener('click', toggleCachePanel);
document.getElementById('btnZoomIn').addEventListener('click', () => map.zoomIn());
document.getElementById('btnZoomOut').addEventListener('click', () => map.zoomOut());
document.getElementById('btnRouting').addEventListener('click', toggleRouting);
document.getElementById('btnInfo').addEventListener('click', toggleInfo);

// ─── Routing Listeners ───
document.getElementById('btnGetRoute').addEventListener('click', getRoute);
document.getElementById('btnClearRoute').addEventListener('click', clearRoute);
document.getElementById('btnSwapRoute').addEventListener('click', () => {
    const temp = routeStart;
    routeStart = routeEnd;
    routeEnd = temp;
    if (routeStart) setWaypoint('start', routeStart);
    if (routeEnd) setWaypoint('end', routeEnd);
    if (routeStart && routeEnd) getRoute();
});
document.getElementById('btnCurrentStart').addEventListener('click', () => {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setWaypoint('start', latlng);
        map.setView(latlng, 15);
        showToast('Start set to current location', 'success');
    }, err => {
        showToast('Could not get location', 'error');
    });
});

// ─── Manual Input Logic ───
['routeFrom', 'routeTo'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('change', () => {
        const type = id === 'routeFrom' ? 'start' : 'end';
        const latlng = parseCoordinates(input.value);
        if (latlng) {
            setWaypoint(type, latlng);
            map.panTo(latlng);
        }
    });
    input.addEventListener('focus', stopSelecting);
});

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
        case 'f': case 'F': toggleSearch(); break;
        case 'l': case 'L': locateUser(); break;
        case 'i': case 'I': toggleInfo(); break;
        case 'Escape': stopSelecting(); break;
    }
});

// ─── Init ───
initMap();
