/**
 * app.js — Konum Paylaş ana uygulama
 */

(() => {
    'use strict';

    // ========== STATE ==========
    let map;
    let currentMarker = null;
    let savedMarkers = [];
    let selectedLocation = null;
    let searchTimeout = null;
    let isOnboardingVisible = true;
    let currentTileLayer = null;
    let isDarkTheme = localStorage.getItem('app_theme') !== 'light';

    // ========== DOM REFS ==========
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const dom = {
        map: $('#map'),
        searchInput: $('#search-input'),
        searchResults: $('#search-results'),
        btnClearSearch: $('#btn-clear-search'),
        btnMenu: $('#btn-menu'),
        btnMyLocation: $('#btn-my-location'),
        onboarding: $('#onboarding'),
        bottomSheet: $('#bottom-sheet'),
        locationName: $('#location-name'),
        locationCoords: $('#location-coords'),
        btnSavePin: $('#btn-save-pin'),
        btnShare: $('#btn-share'),
        btnNavigate: $('#btn-navigate'),
        btnCloseSheet: $('#btn-close-sheet'),
        fabPins: $('#fab-pins'),
        fabCode: $('#fab-code'),
        pinCount: $('#pin-count'),
        // Side menu
        sideMenuOverlay: $('#side-menu-overlay'),
        sideMenu: $('#side-menu'),
        menuSaved: $('#menu-saved'),
        menuEnterCode: $('#menu-enter-code'),
        menuAbout: $('#menu-about'),
        menuLang: $('#menu-lang'),
        menuTheme: $('#menu-theme'),
        themeIcon: $('#theme-icon'),
        themeLabel: $('#theme-label'),
        langLabel: $('#lang-label'),
        // Share modal
        shareModalOverlay: $('#share-modal-overlay'),
        shareModal: $('#share-modal'),
        btnCloseShare: $('#btn-close-share'),
        sharePreviewName: $('#share-preview-name'),
        shareLink: $('#share-link'),
        shareWhatsapp: $('#share-whatsapp'),
        shareQR: $('#share-qr'),
        shareCode: $('#share-code'),
        // QR modal
        qrModalOverlay: $('#qr-modal-overlay'),
        qrModal: $('#qr-modal'),
        btnCloseQR: $('#btn-close-qr'),
        qrContainer: $('#qr-container'),
        btnDownloadQR: $('#btn-download-qr'),
        // Code modal
        codeModalOverlay: $('#code-modal-overlay'),
        codeModal: $('#code-modal'),
        btnCloseCode: $('#btn-close-code'),
        generatedCode: $('#generated-code'),
        btnCopyCode: $('#btn-copy-code'),
        // Enter code modal
        enterCodeModalOverlay: $('#enter-code-modal-overlay'),
        enterCodeModal: $('#enter-code-modal'),
        btnCloseEnterCode: $('#btn-close-enter-code'),
        codeDigits: $$('.code-digit'),
        btnFindCode: $('#btn-find-code'),
        codeResult: $('#code-result'),
        // Saved modal
        savedModalOverlay: $('#saved-modal-overlay'),
        savedModal: $('#saved-modal'),
        btnCloseSaved: $('#btn-close-saved'),
        savedEmpty: $('#saved-empty'),
        savedList: $('#saved-list'),
        // About modal
        aboutModalOverlay: $('#about-modal-overlay'),
        aboutModal: $('#about-modal'),
        btnCloseAbout: $('#btn-close-about'),
        // Name modal
        nameModalOverlay: $('#name-modal-overlay'),
        nameModal: $('#name-modal'),
        btnCloseName: $('#btn-close-name'),
        nameInput: $('#name-input'),
        noteInput: $('#note-input'),
        nameAutoValue: $('#name-auto-value'),
        btnSaveWithAuto: $('#btn-save-with-auto'),
        btnSaveWithName: $('#btn-save-with-name'),
        // Edit modal
        editModalOverlay: $('#edit-modal-overlay'),
        editModal: $('#edit-modal'),
        btnCloseEdit: $('#btn-close-edit'),
        editNameInput: $('#edit-name-input'),
        editNoteInput: $('#edit-note-input'),
        btnSaveEdit: $('#btn-save-edit'),
        // Toast
        toast: $('#toast'),
        toastIcon: $('#toast-icon'),
        toastMessage: $('#toast-message')
    };

    // ========== INIT MAP ==========
    function initMap() {
        map = L.map('map', {
            center: [39.9334, 32.8597], // Ankara
            zoom: 6,
            zoomControl: false,
            attributionControl: false
        });

        // Attribution in corner
        L.control.attribution({
            position: 'bottomleft',
            prefix: false
        }).addTo(map).addAttribution('© <a href="https://carto.com/">CARTO</a>');

        map.on('click', handleMapClick);

        // Apply theme tile
        applyMapTile();

        // Load saved markers
        loadSavedMarkers();
        updatePinBadge();
    }

    // ========== MAP CLICK ==========
    function handleMapClick(e) {
        const { lat, lng } = e.latlng;
        setSelectedLocation(lat, lng);
        reverseGeocode(lat, lng);
        hideOnboarding();
    }

    function setSelectedLocation(lat, lng, name) {
        selectedLocation = { lat, lng, name: name || null };

        // Remove existing temp marker
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }

        // Create custom marker
        currentMarker = L.marker([lat, lng], {
            icon: createPinIcon()
        }).addTo(map);

        // Update bottom sheet
        dom.locationName.textContent = name || 'Konum yükleniyor...';
        dom.locationCoords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        // Check if saved
        updateSaveButton(lat, lng);

        // Show bottom sheet
        showBottomSheet();

        // Animate map
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), {
            duration: 0.8
        });
    }

    function createPinIcon(isSaved = false) {
        return L.divIcon({
            className: `custom-pin ${isSaved ? 'saved-pin' : ''}`,
            html: '<div class="pin-dot"></div><div class="pin-ring"></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
    }

    // ========== GEOCODING ==========
    async function reverseGeocode(lat, lng) {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { 'Accept-Language': 'tr' } }
            );
            const data = await res.json();
            if (data && data.display_name) {
                const name = formatAddress(data);
                dom.locationName.textContent = name;
                if (selectedLocation) {
                    selectedLocation.name = name;
                }
            }
        } catch {
            dom.locationName.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    }

    function formatAddress(data) {
        const a = data.address || {};
        const parts = [];
        if (a.road || a.pedestrian || a.footway) parts.push(a.road || a.pedestrian || a.footway);
        if (a.neighbourhood || a.suburb) parts.push(a.neighbourhood || a.suburb);
        if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
        if (parts.length === 0) {
            return data.display_name.split(',').slice(0, 3).join(', ');
        }
        return parts.join(', ');
    }

    async function searchLocation(query) {
        if (!query || query.length < 2) {
            dom.searchResults.classList.add('hidden');
            return;
        }
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                { headers: { 'Accept-Language': 'tr' } }
            );
            const results = await res.json();
            renderSearchResults(results);
        } catch {
            dom.searchResults.classList.add('hidden');
        }
    }

    function renderSearchResults(results) {
        if (!results.length) {
            dom.searchResults.classList.add('hidden');
            return;
        }
        dom.searchResults.innerHTML = results.map(r => `
            <div class="search-result-item" data-lat="${r.lat}" data-lng="${r.lon}">
                <span class="material-icons-round">place</span>
                <span>${r.display_name}</span>
            </div>
        `).join('');
        dom.searchResults.classList.remove('hidden');

        dom.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                const name = item.querySelector('span:last-child').textContent;
                setSelectedLocation(lat, lng, name);
                dom.searchInput.value = '';
                dom.searchResults.classList.add('hidden');
                dom.btnClearSearch.classList.add('hidden');
                hideOnboarding();
            });
        });
    }

    // ========== BOTTOM SHEET ==========
    function showBottomSheet() {
        dom.bottomSheet.classList.remove('hidden');
        dom.fabPins.classList.add('sheet-open');
        dom.fabCode.classList.add('sheet-open');
    }

    function hideBottomSheet() {
        dom.bottomSheet.classList.add('hidden');
        dom.fabPins.classList.remove('sheet-open');
        dom.fabCode.classList.remove('sheet-open');
    }

    // ========== ONBOARDING ==========
    function hideOnboarding() {
        if (!isOnboardingVisible) return;
        isOnboardingVisible = false;
        dom.onboarding.classList.remove('onboarding-visible');
        dom.onboarding.classList.add('onboarding-hidden');
        setTimeout(() => { dom.onboarding.style.display = 'none'; }, 500);
    }

    // ========== THEME ==========
    function applyMapTile() {
        if (currentTileLayer) map.removeLayer(currentTileLayer);
        const tileUrl = isDarkTheme
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        currentTileLayer = L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    }

    function toggleTheme() {
        isDarkTheme = !isDarkTheme;
        localStorage.setItem('app_theme', isDarkTheme ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
        document.querySelector('meta[name="theme-color"]').content = isDarkTheme ? '#0a0e1a' : '#f0f4f8';
        applyMapTile();
        updateThemeUI();
    }

    function updateThemeUI() {
        const t = Lang.t;
        dom.themeIcon.textContent = isDarkTheme ? 'dark_mode' : 'light_mode';
        dom.themeLabel.textContent = isDarkTheme ? t('darkMode') : t('lightMode');
        if (isDarkTheme) {
            dom.menuTheme.classList.add('active');
        } else {
            dom.menuTheme.classList.remove('active');
        }
    }

    function initTheme() {
        document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
        document.querySelector('meta[name="theme-color"]').content = isDarkTheme ? '#0a0e1a' : '#f0f4f8';
        updateThemeUI();
    }

    function updateLangUI() {
        const lang = Lang.getLang();
        const switchEl = dom.menuLang;
        dom.langLabel.textContent = lang === 'tr' ? 'T\u00fcrk\u00e7e' : 'English';
        if (lang === 'en') {
            switchEl.classList.add('en');
        } else {
            switchEl.classList.remove('en');
        }
        // Active class on options
        switchEl.querySelectorAll('.lang-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.lang === lang);
        });
    }

    // ========== i18n ==========
    function applyTranslations() {
        const t = Lang.t;
        // data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        // Search
        dom.searchInput.placeholder = t('searchPlaceholder');
        // Onboarding
        const onP = dom.onboarding.querySelector('p');
        if (onP) onP.innerHTML = t('onboardingText');
        // Menu header
        const menuH3 = document.querySelector('.menu-header h3');
        if (menuH3) menuH3.textContent = t('appName');
        // Bottom sheet buttons
        dom.btnSavePin.querySelector('span:last-child').textContent =
            dom.btnSavePin.classList.contains('saved') ? t('saved') : t('save');
        dom.btnShare.querySelector('span:last-child').textContent = t('share');
        dom.btnNavigate.querySelector('span:last-child').textContent = t('navigate');
        // Share modal
        document.querySelector('#share-modal .modal-header h3').textContent = t('shareTitle');
        document.querySelector('#share-link .share-option-title').textContent = t('shareLinkTitle');
        document.querySelector('#share-link .share-option-desc').textContent = t('shareLinkDesc');
        document.querySelector('#share-whatsapp .share-option-title').textContent = t('shareWhatsappTitle');
        document.querySelector('#share-whatsapp .share-option-desc').textContent = t('shareWhatsappDesc');
        document.querySelector('#share-qr .share-option-title').textContent = t('shareQRTitle');
        document.querySelector('#share-qr .share-option-desc').textContent = t('shareQRDesc');
        document.querySelector('#share-code .share-option-title').textContent = t('shareCodeTitle');
        document.querySelector('#share-code .share-option-desc').textContent = t('shareCodeDesc');
        // QR modal
        document.querySelector('#qr-modal .modal-header h3').textContent = t('qrTitle');
        const qrHints = document.querySelectorAll('.qr-hint');
        if (qrHints[0]) qrHints[0].textContent = t('qrHint');
        if (qrHints[1]) qrHints[1].textContent = t('qrHint2');
        dom.btnDownloadQR.querySelector('span:last-child').textContent = t('qrDownload');
        // Code modal
        document.querySelector('#code-modal .modal-header h3').textContent = t('codeTitle');
        const codeHint = document.querySelector('.code-hint');
        if (codeHint) codeHint.textContent = t('codeHint');
        dom.btnCopyCode.querySelector('span:last-child').textContent = t('codeCopy');
        const betaNotice = document.querySelector('.beta-notice p');
        if (betaNotice) betaNotice.textContent = t('codeBetaNotice');
        // Enter code modal
        document.querySelector('#enter-code-modal .modal-header h3').textContent = t('enterCodeTitle');
        const enterDesc = document.querySelector('.enter-code-desc');
        if (enterDesc) enterDesc.textContent = t('enterCodeDesc');
        dom.btnFindCode.querySelector('span:last-child').textContent = t('findCode');
        // Saved modal
        document.querySelector('#saved-modal .modal-header h3').textContent = t('savedTitle');
        const emptyP = dom.savedEmpty.querySelector('p');
        const emptyHint = dom.savedEmpty.querySelector('.empty-hint');
        if (emptyP) emptyP.textContent = t('savedEmpty');
        if (emptyHint) emptyHint.textContent = t('savedEmptyHint');
        // Name modal
        document.querySelector('#name-modal .modal-header h3').textContent = t('nameTitle');
        document.getElementById('name-modal-desc').textContent = t('nameDesc');
        dom.nameInput.placeholder = t('namePlaceholder');
        dom.noteInput.placeholder = t('notePlaceholder');
        document.getElementById('name-auto-label').firstChild.textContent = t('autoLabel') + ': ';
        dom.btnSaveWithAuto.querySelector('span:last-child').textContent = t('autoName');
        dom.btnSaveWithName.querySelector('span:last-child').textContent = t('save');
        // Edit modal
        document.querySelector('#edit-modal .modal-header h3').textContent = t('editTitle');
        dom.editNameInput.placeholder = t('editNamePlaceholder');
        dom.editNoteInput.placeholder = t('editNotePlaceholder');
        dom.btnSaveEdit.querySelector('span:last-child').textContent = t('update');
        // About modal
        document.querySelector('#about-modal .modal-header h3').textContent = t('aboutTitle');
        document.querySelector('.about-desc').textContent = t('aboutDesc');
        const features = document.querySelectorAll('.about-feature span:last-child');
        if (features[0]) features[0].textContent = t('aboutFeature1');
        if (features[1]) features[1].textContent = t('aboutFeature2');
        if (features[2]) features[2].textContent = t('aboutFeature3');
        document.querySelector('.about-credit p').textContent = t('aboutCredit');
        document.querySelector('.linkedin-link span').textContent = t('linkedinProfile');
    }

    // ========== SAVE PIN (with naming) ==========
    function updateSaveButton(lat, lng) {
        const saved = Sharing.isLocationSaved(lat, lng);
        if (saved) {
            dom.btnSavePin.classList.add('saved');
            dom.btnSavePin.querySelector('span:first-child').textContent = 'bookmark';
            dom.btnSavePin.querySelector('span:last-child').textContent = 'Kaydedildi';
        } else {
            dom.btnSavePin.classList.remove('saved');
            dom.btnSavePin.querySelector('span:first-child').textContent = 'bookmark_add';
            dom.btnSavePin.querySelector('span:last-child').textContent = 'Kaydet';
        }
    }

    function handleSavePin() {
        if (!selectedLocation) return;
        const { lat, lng } = selectedLocation;

        if (Sharing.isLocationSaved(lat, lng)) {
            showToast('Bu konum zaten kaydedilmiş', 'info');
            return;
        }

        // Open naming modal
        openNameModal();
    }

    function openNameModal() {
        dom.nameInput.value = '';
        dom.noteInput.value = '';
        dom.nameAutoValue.textContent = selectedLocation?.name || 'Bilinmeyen konum';
        openModal(dom.nameModalOverlay, dom.nameModal);
        setTimeout(() => dom.nameInput.focus(), 400);
    }

    function saveWithName(customName) {
        if (!selectedLocation) return;
        const { lat, lng, name: autoName } = selectedLocation;
        const finalName = customName || autoName || 'Konum';
        const note = dom.noteInput.value.trim();

        // Update selected location name
        selectedLocation.name = finalName;
        dom.locationName.textContent = finalName;

        const success = Sharing.saveLocation(lat, lng, finalName, note);
        if (success) {
            updateSaveButton(lat, lng);
            updatePinBadge();
            loadSavedMarkers();
            showToast('Konum kaydedildi', 'check_circle');
        }

        closeModal(dom.nameModalOverlay, dom.nameModal);
    }

    // ========== NAVIGATE ==========
    function navigateToLocation(lat, lng, name) {
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const openUrl = `${baseUrl}open.html?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name || 'Konum')}`;
        window.open(openUrl, '_blank');
    }

    // ========== EDIT LOCATION ==========
    let editingLocationId = null;

    function openEditModal(loc) {
        editingLocationId = loc.id;
        dom.editNameInput.value = loc.name || '';
        dom.editNoteInput.value = loc.note || '';
        openModal(dom.editModalOverlay, dom.editModal);
        setTimeout(() => dom.editNameInput.focus(), 400);
    }

    function handleSaveEdit() {
        if (!editingLocationId) return;
        const newName = dom.editNameInput.value.trim();
        if (!newName) {
            dom.editNameInput.style.borderColor = 'var(--red)';
            setTimeout(() => { dom.editNameInput.style.borderColor = ''; }, 1500);
            return;
        }
        const newNote = dom.editNoteInput.value.trim();
        Sharing.updateLocation(editingLocationId, newName, newNote);
        closeModal(dom.editModalOverlay, dom.editModal, () => {
            renderSavedList();
            loadSavedMarkers();
            showToast('Konum güncellendi', 'check_circle');
        });
        editingLocationId = null;
    }

    // ========== SAVED MARKERS ON MAP ==========
    function loadSavedMarkers() {
        // Remove old markers
        savedMarkers.forEach(m => map.removeLayer(m));
        savedMarkers = [];

        const locations = Sharing.getSavedLocations();
        locations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng], {
                icon: createPinIcon(true)
            }).addTo(map);

            marker.bindTooltip(loc.name, {
                className: 'pin-tooltip',
                direction: 'top',
                offset: [0, -20]
            });

            marker.on('click', () => {
                setSelectedLocation(loc.lat, loc.lng, loc.name);
            });

            savedMarkers.push(marker);
        });
    }

    function updatePinBadge() {
        const count = Sharing.getSavedLocations().length;
        if (count > 0) {
            dom.pinCount.textContent = count;
            dom.pinCount.classList.remove('hidden');
        } else {
            dom.pinCount.classList.add('hidden');
        }
    }

    // ========== SIDE MENU ==========
    function openSideMenu() {
        dom.sideMenuOverlay.classList.remove('hidden');
        dom.sideMenu.classList.add('open');
    }

    function closeSideMenu() {
        dom.sideMenuOverlay.classList.add('closing');
        dom.sideMenu.classList.remove('open');
        setTimeout(() => {
            dom.sideMenuOverlay.classList.add('hidden');
            dom.sideMenuOverlay.classList.remove('closing');
        }, 300);
    }

    // ========== MODAL HELPERS ==========
    function openModal(overlay, modal) {
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.classList.remove('closing');
    }

    function closeModal(overlay, modal, cb) {
        overlay.classList.add('closing');
        modal.classList.add('closing');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('closing');
            modal.classList.add('hidden');
            modal.classList.remove('closing');
            if (cb) cb();
        }, 300);
    }

    // ========== SHARE FLOW ==========
    function openShareModal() {
        if (!selectedLocation) return;
        dom.sharePreviewName.textContent = selectedLocation.name || 'Konum';
        openModal(dom.shareModalOverlay, dom.shareModal);
    }

    function handleShareLink() {
        if (!selectedLocation) return;
        const { lat, lng, name } = selectedLocation;
        const openUrl = Sharing.getShareUrl(lat, lng, name);
        const shareText = `📍 ${name || 'Konum'}`;

        if (navigator.share) {
            navigator.share({
                title: shareText,
                text: shareText,
                url: openUrl
            }).then(() => {
                closeModal(dom.shareModalOverlay, dom.shareModal);
            }).catch(() => {
                // User cancelled or error — do nothing
            });
        } else {
            navigator.clipboard.writeText(openUrl).then(() => {
                showToast(Lang.t('shareLinkCopied'), 'content_copy');
            }).catch(() => {
                // Fallback: show the URL in toast
                showToast(openUrl, 'link');
            });
            closeModal(dom.shareModalOverlay, dom.shareModal);
        }
    }

    function handleShareWhatsApp() {
        if (!selectedLocation) return;
        const { lat, lng, name } = selectedLocation;
        Sharing.shareViaWhatsApp(lat, lng, name);
        closeModal(dom.shareModalOverlay, dom.shareModal);
    }

    function handleShareQR() {
        if (!selectedLocation) return;
        closeModal(dom.shareModalOverlay, dom.shareModal, () => {
            openModal(dom.qrModalOverlay, dom.qrModal);
            // Small delay to let modal animation settle
            setTimeout(() => {
                Sharing.generateQRCode(dom.qrContainer, selectedLocation.lat, selectedLocation.lng, selectedLocation.name);
            }, 100);
        });
    }

    function handleShareCode() {
        if (!selectedLocation) return;
        closeModal(dom.shareModalOverlay, dom.shareModal, () => {
            const code = Sharing.generateCode();
            Sharing.saveCodeToStorage(code, selectedLocation.lat, selectedLocation.lng, selectedLocation.name);

            // Render code digits
            const digits = code.split('');
            dom.generatedCode.innerHTML = digits.map(d => `<span>${d}</span>`).join('');

            openModal(dom.codeModalOverlay, dom.codeModal);
        });
    }

    function handleCopyCode() {
        const code = Array.from(dom.generatedCode.querySelectorAll('span'))
            .map(s => s.textContent).join('');
        navigator.clipboard.writeText(code).then(() => {
            showToast('Kod kopyalandı', 'check_circle');
        }).catch(() => {
            // Fallback
            showToast('Kod: ' + code, 'pin');
        });
    }

    function handleDownloadQR() {
        Sharing.downloadQR(dom.qrContainer, selectedLocation?.name);
        showToast('QR kod indirildi', 'download_done');
    }

    // ========== ENTER CODE FLOW ==========
    function openEnterCodeModal() {
        // Reset
        dom.codeDigits.forEach(input => { input.value = ''; });
        dom.codeResult.classList.add('hidden');
        dom.btnFindCode.disabled = true;

        openModal(dom.enterCodeModalOverlay, dom.enterCodeModal);
        setTimeout(() => dom.codeDigits[0].focus(), 400);
    }

    function setupCodeDigitInputs() {
        dom.codeDigits.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, '');
                e.target.value = val;
                if (val && idx < 5) {
                    dom.codeDigits[idx + 1].focus();
                }
                checkCodeComplete();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    dom.codeDigits[idx - 1].focus();
                }
            });

            input.addEventListener('focus', () => {
                setTimeout(() => input.select(), 0);
            });
        });
    }

    function checkCodeComplete() {
        const code = Array.from(dom.codeDigits).map(i => i.value).join('');
        dom.btnFindCode.disabled = code.length < 6;
    }

    function handleFindCode() {
        const code = Array.from(dom.codeDigits).map(i => i.value).join('');
        if (code.length < 6) return;

        const result = Sharing.lookupCode(code);

        dom.codeResult.classList.remove('hidden');

        if (result) {
            // Found in local storage (own device)
            dom.codeResult.className = 'beta-warning';
            dom.codeResult.innerHTML = `
                <span class="material-icons-round" style="color: var(--green);">check_circle</span>
                <h4>${result.name}</h4>
                <p>${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}</p>
                <button class="primary-btn" style="margin-top: 12px;" onclick="window._goToCodeLocation(${result.lat}, ${result.lng}, '${result.name.replace(/'/g, "\\'")}')">
                    <span class="material-icons-round">place</span>
                    <span>Konuma Git</span>
                </button>
            `;
        } else {
            // Not found — beta warning
            dom.codeResult.className = 'beta-warning';
            dom.codeResult.innerHTML = `
                <span class="material-icons-round">science</span>
                <h4>Beta Sürümü</h4>
                <p>Bu özellik henüz beta aşamasındadır. Sunucu bağlantısı yakında eklenecektir. Şu anda yalnızca bu cihazda oluşturulan kodlar geçerlidir.</p>
            `;
        }
    }

    // Global function for code result button
    window._goToCodeLocation = (lat, lng, name) => {
        closeModal(dom.enterCodeModalOverlay, dom.enterCodeModal, () => {
            setSelectedLocation(lat, lng, name);
            hideOnboarding();
        });
    };

    // ========== SAVED LOCATIONS PANEL ==========
    function openSavedLocations() {
        renderSavedList();
        openModal(dom.savedModalOverlay, dom.savedModal);
    }

    function renderSavedList() {
        const locations = Sharing.getSavedLocations();
        if (locations.length === 0) {
            dom.savedEmpty.classList.remove('hidden');
            dom.savedList.classList.add('hidden');
            return;
        }

        dom.savedEmpty.classList.add('hidden');
        dom.savedList.classList.remove('hidden');

        dom.savedList.innerHTML = locations.map(loc => `
            <li class="saved-item" data-id="${loc.id}">
                <div class="saved-item-icon">
                    <span class="material-icons-round">place</span>
                </div>
                <div class="saved-item-info">
                    <h4>${loc.name}</h4>
                    <p>${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</p>
                    ${loc.note ? `<div class="saved-item-note"><span class="material-icons-round">sticky_note_2</span>${loc.note}</div>` : ''}
                </div>
                <div class="saved-item-actions">
                    <button class="icon-btn" data-action="navigate" title="Yol Tarifi">
                        <span class="material-icons-round">directions</span>
                    </button>
                    <button class="icon-btn" data-action="edit" title="Düzenle">
                        <span class="material-icons-round">edit</span>
                    </button>
                    <button class="icon-btn" data-action="share" title="Paylaş">
                        <span class="material-icons-round">share</span>
                    </button>
                    <button class="icon-btn" data-action="delete" title="Sil">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                </div>
            </li>
        `).join('');

        // Event delegation
        dom.savedList.querySelectorAll('.saved-item-actions .icon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.saved-item');
                const id = item.dataset.id;
                const action = btn.dataset.action;
                const loc = locations.find(l => l.id === id);
                if (!loc) return;

                switch (action) {
                    case 'navigate':
                        navigateToLocation(loc.lat, loc.lng, loc.name);
                        break;
                    case 'goto':
                        closeModal(dom.savedModalOverlay, dom.savedModal, () => {
                            setSelectedLocation(loc.lat, loc.lng, loc.name);
                        });
                        break;
                    case 'edit':
                        closeModal(dom.savedModalOverlay, dom.savedModal, () => {
                            openEditModal(loc);
                        });
                        break;
                    case 'share':
                        selectedLocation = { lat: loc.lat, lng: loc.lng, name: loc.name };
                        closeModal(dom.savedModalOverlay, dom.savedModal, () => {
                            openShareModal();
                        });
                        break;
                    case 'delete':
                        Sharing.removeLocation(id);
                        item.style.transform = 'translateX(100%)';
                        item.style.opacity = '0';
                        item.style.transition = '0.3s ease';
                        setTimeout(() => {
                            renderSavedList();
                            updatePinBadge();
                            loadSavedMarkers();
                            if (selectedLocation) {
                                updateSaveButton(selectedLocation.lat, selectedLocation.lng);
                            }
                        }, 300);
                        showToast('Konum silindi', 'delete');
                        break;
                }
            });
        });
    }

    // ========== MY LOCATION ==========
    function handleMyLocation() {
        if (!navigator.geolocation) {
            showToast('Konum servisi desteklenmiyor', 'error');
            return;
        }

        dom.btnMyLocation.querySelector('.material-icons-round').textContent = 'gps_fixed';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setSelectedLocation(lat, lng);
                reverseGeocode(lat, lng);
                hideOnboarding();
                dom.btnMyLocation.querySelector('.material-icons-round').textContent = 'my_location';
            },
            () => {
                showToast('Konum alınamadı', 'error');
                dom.btnMyLocation.querySelector('.material-icons-round').textContent = 'my_location';
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // ========== TOAST ==========
    let toastTimer;
    function showToast(message, icon = 'check_circle') {
        clearTimeout(toastTimer);
        dom.toast.classList.remove('hidden', 'toast-out');
        dom.toastMessage.textContent = message;
        dom.toastIcon.textContent = icon;
        // Force re-render for animation
        dom.toast.offsetHeight;
        dom.toast.style.animation = 'none';
        dom.toast.offsetHeight;
        dom.toast.style.animation = '';

        toastTimer = setTimeout(() => {
            dom.toast.classList.add('toast-out');
            setTimeout(() => dom.toast.classList.add('hidden'), 300);
        }, 2500);
    }

    // ========== RIPPLE EFFECT ==========
    function addRipple(e) {
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2) - rect.left - size / 2 + 'px';
        ripple.style.top = (e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2) - rect.top - size / 2 + 'px';
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    // ========== EVENT LISTENERS ==========
    function bindEvents() {
        // Search
        dom.searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            dom.btnClearSearch.classList.toggle('hidden', !val);
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchLocation(val), 400);
        });

        dom.btnClearSearch.addEventListener('click', () => {
            dom.searchInput.value = '';
            dom.searchResults.classList.add('hidden');
            dom.btnClearSearch.classList.add('hidden');
        });

        // My Location
        dom.btnMyLocation.addEventListener('click', handleMyLocation);

        // Side menu
        dom.btnMenu.addEventListener('click', openSideMenu);
        dom.sideMenuOverlay.addEventListener('click', closeSideMenu);

        // Menu items
        dom.menuSaved.addEventListener('click', () => {
            closeSideMenu();
            setTimeout(openSavedLocations, 350);
        });
        dom.menuEnterCode.addEventListener('click', () => {
            closeSideMenu();
            setTimeout(openEnterCodeModal, 350);
        });
        dom.menuAbout.addEventListener('click', () => {
            closeSideMenu();
            setTimeout(() => openModal(dom.aboutModalOverlay, dom.aboutModal), 350);
        });
        dom.menuLang.addEventListener('click', () => {
            Lang.toggle();
            applyTranslations();
            updateLangUI();
            updateThemeUI();
        });
        dom.menuTheme.addEventListener('click', () => {
            toggleTheme();
        });

        // Bottom sheet actions
        dom.btnSavePin.addEventListener('click', handleSavePin);
        dom.btnShare.addEventListener('click', openShareModal);
        dom.btnNavigate.addEventListener('click', () => {
            if (!selectedLocation) return;
            navigateToLocation(selectedLocation.lat, selectedLocation.lng, selectedLocation.name);
        });
        dom.btnCloseSheet.addEventListener('click', () => {
            hideBottomSheet();
            if (currentMarker) {
                map.removeLayer(currentMarker);
                currentMarker = null;
            }
            selectedLocation = null;
        });

        // FABs
        dom.fabPins.addEventListener('click', openSavedLocations);
        dom.fabCode.addEventListener('click', openEnterCodeModal);

        // Share modal
        dom.btnCloseShare.addEventListener('click', () => closeModal(dom.shareModalOverlay, dom.shareModal));
        dom.shareModalOverlay.addEventListener('click', () => closeModal(dom.shareModalOverlay, dom.shareModal));
        dom.shareLink.addEventListener('click', handleShareLink);
        dom.shareWhatsapp.addEventListener('click', handleShareWhatsApp);
        dom.shareQR.addEventListener('click', handleShareQR);
        dom.shareCode.addEventListener('click', handleShareCode);

        // QR modal
        dom.btnCloseQR.addEventListener('click', () => closeModal(dom.qrModalOverlay, dom.qrModal));
        dom.qrModalOverlay.addEventListener('click', () => closeModal(dom.qrModalOverlay, dom.qrModal));
        dom.btnDownloadQR.addEventListener('click', handleDownloadQR);

        // Code modal
        dom.btnCloseCode.addEventListener('click', () => closeModal(dom.codeModalOverlay, dom.codeModal));
        dom.codeModalOverlay.addEventListener('click', () => closeModal(dom.codeModalOverlay, dom.codeModal));
        dom.btnCopyCode.addEventListener('click', handleCopyCode);

        // Enter code modal
        dom.btnCloseEnterCode.addEventListener('click', () => closeModal(dom.enterCodeModalOverlay, dom.enterCodeModal));
        dom.enterCodeModalOverlay.addEventListener('click', () => closeModal(dom.enterCodeModalOverlay, dom.enterCodeModal));
        dom.btnFindCode.addEventListener('click', handleFindCode);
        setupCodeDigitInputs();

        // Saved modal
        dom.btnCloseSaved.addEventListener('click', () => closeModal(dom.savedModalOverlay, dom.savedModal));
        dom.savedModalOverlay.addEventListener('click', () => closeModal(dom.savedModalOverlay, dom.savedModal));

        // About modal
        dom.btnCloseAbout.addEventListener('click', () => closeModal(dom.aboutModalOverlay, dom.aboutModal));
        dom.aboutModalOverlay.addEventListener('click', () => closeModal(dom.aboutModalOverlay, dom.aboutModal));

        // Name modal
        dom.btnCloseName.addEventListener('click', () => closeModal(dom.nameModalOverlay, dom.nameModal));
        dom.nameModalOverlay.addEventListener('click', () => closeModal(dom.nameModalOverlay, dom.nameModal));
        dom.btnSaveWithAuto.addEventListener('click', () => {
            saveWithName(null); // use auto name
        });
        dom.btnSaveWithName.addEventListener('click', () => {
            const customName = dom.nameInput.value.trim();
            if (!customName) {
                dom.nameInput.focus();
                dom.nameInput.style.borderColor = 'var(--red)';
                setTimeout(() => { dom.nameInput.style.borderColor = ''; }, 1500);
                return;
            }
            saveWithName(customName);
        });
        // Enter key on name input
        dom.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const customName = dom.nameInput.value.trim();
                if (customName) saveWithName(customName);
            }
        });

        // Edit modal
        dom.btnCloseEdit.addEventListener('click', () => closeModal(dom.editModalOverlay, dom.editModal));
        dom.editModalOverlay.addEventListener('click', () => closeModal(dom.editModalOverlay, dom.editModal));
        dom.btnSaveEdit.addEventListener('click', handleSaveEdit);
        dom.editNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSaveEdit();
        });

        // Ripple to action buttons
        document.querySelectorAll('.action-btn, .primary-btn, .share-option, .secondary-btn')
            .forEach(btn => btn.addEventListener('click', addRipple));

        // Close search results on outside click
        document.addEventListener('click', (e) => {
            if (!dom.searchResults.contains(e.target) && e.target !== dom.searchInput) {
                dom.searchResults.classList.add('hidden');
            }
        });
    }

    // ========== INIT ==========
    function init() {
        initTheme();
        initMap();
        bindEvents();
        applyTranslations();
        updateLangUI();
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
