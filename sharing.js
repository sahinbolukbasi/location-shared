/**
 * sharing.js — Konum paylaşım modülü
 * WhatsApp, QR Code ve 6 haneli beta kod ile paylaşım
 */

const Sharing = (() => {

    // ========== BASE URL ==========
    function getBaseUrl() {
        const loc = window.location;
        const path = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
        return `${loc.origin}${path}`;
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
        // URL that will be encoded in QR — points to the map chooser page
        const openUrl = `${getBaseUrl()}open.html?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name || 'Konum')}`;

        // Clear previous QR
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
            // Try img fallback
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

    // ========== 6 DIGIT CODE (BETA) ==========
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

    function lookupCode(code) {
        const codes = getStoredCodes();
        return codes[code] || null;
    }

    // ========== PINNED LOCATIONS ==========
    function getSavedLocations() {
        try {
            return JSON.parse(localStorage.getItem('saved_locations')) || [];
        } catch {
            return [];
        }
    }

    function saveLocation(lat, lng, name, note) {
        const locations = getSavedLocations();
        // Check duplicate
        const exists = locations.find(
            l => Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lng - lng) < 0.0001
        );
        if (exists) return false;

        locations.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            lat,
            lng,
            name: name || 'Konum',
            note: note || '',
            savedAt: Date.now()
        });
        localStorage.setItem('saved_locations', JSON.stringify(locations));
        return true;
    }

    function updateLocation(id, newName, newNote) {
        const locations = getSavedLocations();
        const loc = locations.find(l => l.id === id);
        if (!loc) return false;
        if (newName !== undefined) loc.name = newName;
        if (newNote !== undefined) loc.note = newNote;
        localStorage.setItem('saved_locations', JSON.stringify(locations));
        return true;
    }

    function removeLocation(id) {
        let locations = getSavedLocations();
        locations = locations.filter(l => l.id !== id);
        localStorage.setItem('saved_locations', JSON.stringify(locations));
    }

    function isLocationSaved(lat, lng) {
        const locations = getSavedLocations();
        return locations.some(
            l => Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lng - lng) < 0.0001
        );
    }

    return {
        getShareUrl,
        shareViaWhatsApp,
        generateQRCode,
        downloadQR,
        generateCode,
        saveCodeToStorage,
        lookupCode,
        getSavedLocations,
        saveLocation,
        updateLocation,
        removeLocation,
        isLocationSaved
    };
})();
