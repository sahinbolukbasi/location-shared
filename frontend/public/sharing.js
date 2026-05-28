/**
 * sharing.js — Konum paylaşım modülü
 * Tasarımı değiştirmeden backend entegrasyon katmanı
 */

const Sharing = (() => {
    const API_PREFIX = '/api/v1';
    const ACCESS_TOKEN_KEY = 'access_token';
    const REFRESH_TOKEN_KEY = 'refresh_token';
    const USER_KEY = 'auth_user';
    const REMOTE_CACHE_KEY = 'remote_locations_cache';

    // ========== BASE URL ==========
    function getBaseUrl() {
        const loc = window.location;
        const path = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
        return `${loc.origin}${path}`;
    }

    function getApiBaseUrl() {
        const envBase = window.__API_BASE_URL;
        if (envBase) return envBase;

        if (window.location.protocol.startsWith('http')) {
            return `${window.location.protocol}//${window.location.hostname}:8000`;
        }

        return 'http://localhost:8000';
    }

    async function request(path, options = {}) {
        const method = options.method || 'GET';
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {})
        };

        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        if (options.auth) {
            const token = getAccessToken();
            if (!token) {
                throw new Error('Önce giriş yapmalısın.');
            }
            headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${getApiBaseUrl()}${API_PREFIX}${path}`, {
            method,
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined
        });

        if (res.status === 204) return null;

        let payload = null;
        try {
            payload = await res.json();
        } catch {
            payload = null;
        }

        if (!res.ok) {
            throw new Error(payload?.detail || `HTTP ${res.status}`);
        }

        return payload;
    }

    // ========== AUTH ==========
    function getAccessToken() {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
    }

    function setTokens(accessToken, refreshToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    function setCurrentUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        } catch {
            return null;
        }
    }

    function clearAuth() {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(REMOTE_CACHE_KEY);
    }

    function isAuthenticated() {
        return Boolean(getAccessToken());
    }

    async function login(email, password) {
        const token = await request('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
        setTokens(token.access_token, token.refresh_token);
        return syncCurrentUser();
    }

    async function register(email, password, fullName) {
        const token = await request('/auth/register', {
            method: 'POST',
            body: { email, password, full_name: fullName }
        });
        setTokens(token.access_token, token.refresh_token);
        return syncCurrentUser();
    }

    async function syncCurrentUser() {
        if (!isAuthenticated()) return null;
        try {
            const profile = await request('/auth/me', { auth: true });
            setCurrentUser(profile);
            return profile;
        } catch (error) {
            if ((error.message || '').toLowerCase().includes('401')) {
                clearAuth();
                return null;
            }
            throw error;
        }
    }

    function logout() {
        clearAuth();
    }

    // ========== SHARE URL ==========
    function getShareUrl(lat, lng, name) {
        return `${getBaseUrl()}open.html?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name || 'Konum')}`;
    }

    // ========== WHATSAPP ==========
    function shareViaWhatsApp(lat, lng, name) {
        const openUrl = getShareUrl(lat, lng, name);
        const message = `📍 ${name || 'Konum'}\n\n${openUrl}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    }

    // ========== QR CODE ==========
    let qrInstance = null;

    function generateQRCode(containerEl, lat, lng, name) {
        const openUrl = `${getBaseUrl()}open.html?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name || 'Konum')}`;
        containerEl.innerHTML = '';

        try {
            qrInstance = new QRCode(containerEl, {
                text: openUrl,
                width: 200,
                height: 200,
                colorDark: '#0a0e1a',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (err) {
            console.error('QR oluşturma hatası:', err);
            containerEl.innerHTML = '<p style="color:red;padding:20px;">QR oluşturulamadı</p>';
        }
    }

    function downloadQR(containerEl, name) {
        const canvas = containerEl.querySelector('canvas');
        if (!canvas) {
            const img = containerEl.querySelector('img');
            if (img) {
                const link = document.createElement('a');
                link.download = `konum-${(name || 'paylasim').replace(/\s+/g, '-').toLowerCase()}.png`;
                link.href = img.src;
                link.click();
            }
            return;
        }
        const link = document.createElement('a');
        link.download = `konum-${(name || 'paylasim').replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // ========== 6 DIGIT CODE ==========
    function generateCode() {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += Math.floor(Math.random() * 10).toString();
        }
        return code;
    }

    function saveCodeToStorage(code, lat, lng, name) {
        const codes = getStoredCodes();
        codes[code] = {
            lat,
            lng,
            name: name || 'Konum',
            createdAt: Date.now()
        };
        localStorage.setItem('location_codes', JSON.stringify(codes));
    }

    function getStoredCodes() {
        try {
            return JSON.parse(localStorage.getItem('location_codes')) || {};
        } catch {
            return {};
        }
    }

    async function createShareCode(lat, lng, name) {
        if (!isAuthenticated()) {
            const code = generateCode();
            saveCodeToStorage(code, lat, lng, name);
            return {
                code,
                latitude: lat,
                longitude: lng,
                location_name: name || 'Konum',
                source: 'local'
            };
        }

        return request('/share-codes', {
            method: 'POST',
            auth: true,
            body: {
                latitude: lat,
                longitude: lng,
                location_name: name || 'Konum'
            }
        });
    }

    async function lookupCode(code) {
        if (/^\d{6}$/.test(code)) {
            try {
                const payload = await request(`/share-codes/${code}`);
                return {
                    lat: payload.latitude,
                    lng: payload.longitude,
                    name: payload.location_name,
                    source: 'backend'
                };
            } catch (error) {
                const message = (error.message || '').toLowerCase();
                if (!message.includes('not found') && !message.includes('expired') && !message.includes('404') && !message.includes('410')) {
                    throw error;
                }
            }
        }

        const local = getStoredCodes()[code] || null;
        if (!local) return null;
        return {
            lat: local.lat,
            lng: local.lng,
            name: local.name,
            source: 'local'
        };
    }

    // ========== PINNED LOCATIONS ==========
    function getLocalSavedLocations() {
        try {
            return JSON.parse(localStorage.getItem('saved_locations')) || [];
        } catch {
            return [];
        }
    }

    function setRemoteCache(items) {
        localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(items));
    }

    function getRemoteCache() {
        try {
            return JSON.parse(localStorage.getItem(REMOTE_CACHE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function mapLocation(item) {
        return {
            id: item.id,
            lat: item.latitude,
            lng: item.longitude,
            name: item.name,
            note: item.note || '',
            savedAt: Date.parse(item.created_at || '') || Date.now()
        };
    }

    async function refreshSavedLocations() {
        if (!isAuthenticated()) return getLocalSavedLocations();
        const rows = await request('/locations', { auth: true });
        const mapped = rows.map(mapLocation);
        setRemoteCache(mapped);
        return mapped;
    }

    function getSavedLocations() {
        if (!isAuthenticated()) return getLocalSavedLocations();
        return getRemoteCache();
    }

    async function saveLocation(lat, lng, name, note) {
        if (!isAuthenticated()) {
            const locations = getLocalSavedLocations();
            const exists = locations.find(
                (l) => Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lng - lng) < 0.0001
            );
            if (exists) return false;

            locations.unshift({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                lat,
                lng,
                name: name || 'Konum',
                note: note || '',
                savedAt: Date.now()
            });
            localStorage.setItem('saved_locations', JSON.stringify(locations));
            return true;
        }

        await request('/locations', {
            method: 'POST',
            auth: true,
            body: {
                name: name || 'Konum',
                note: note || null,
                latitude: lat,
                longitude: lng
            }
        });
        await refreshSavedLocations();
        return true;
    }

    async function updateLocation(id, newName, newNote) {
        if (!isAuthenticated()) {
            const locations = getLocalSavedLocations();
            const loc = locations.find((l) => l.id === id);
            if (!loc) return false;
            if (newName !== undefined) loc.name = newName;
            if (newNote !== undefined) loc.note = newNote;
            localStorage.setItem('saved_locations', JSON.stringify(locations));
            return true;
        }

        const current = getRemoteCache().find((x) => x.id === id);
        if (!current) return false;

        await request(`/locations/${id}`, {
            method: 'PATCH',
            auth: true,
            body: {
                name: newName ?? current.name,
                note: newNote ?? current.note,
                latitude: current.lat,
                longitude: current.lng
            }
        });

        await refreshSavedLocations();
        return true;
    }

    async function removeLocation(id) {
        if (!isAuthenticated()) {
            const locations = getLocalSavedLocations().filter((l) => l.id !== id);
            localStorage.setItem('saved_locations', JSON.stringify(locations));
            return;
        }

        await request(`/locations/${id}`, {
            method: 'DELETE',
            auth: true
        });
        await refreshSavedLocations();
    }

    function isLocationSaved(lat, lng) {
        const locations = getSavedLocations();
        return locations.some(
            (l) => Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lng - lng) < 0.0001
        );
    }

    return {
        getShareUrl,
        shareViaWhatsApp,
        generateQRCode,
        downloadQR,
        generateCode,
        saveCodeToStorage,
        createShareCode,
        lookupCode,
        getSavedLocations,
        refreshSavedLocations,
        saveLocation,
        updateLocation,
        removeLocation,
        isLocationSaved,
        isAuthenticated,
        getCurrentUser,
        login,
        register,
        syncCurrentUser,
        logout
    };
})();
