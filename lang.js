/**
 * lang.js — i18n / Çoklu Dil Desteği
 */
const Lang = (() => {
    'use strict';

    const translations = {
        tr: {
            // Search
            searchPlaceholder: 'Konum ara...',
            // Onboarding
            onboardingText: 'Haritaya dokunarak konum seçin',
            // Bottom sheet
            locationLoading: 'Konum yükleniyor...',
            locationNotSelected: 'Konum Seçilmedi',
            save: 'Kaydet',
            saved: 'Kaydedildi',
            share: 'Paylaş',
            navigate: 'Yol Tarifi',
            // Side menu
            appName: 'Konum Paylaş',
            version: 'Beta v1.0',
            menuSaved: 'Kayıtlı Konumlar',
            menuEnterCode: 'Kod ile Konum Bul',
            menuAbout: 'Hakkında',
            menuLanguage: 'English',
            menuTheme: 'Karanlık Mod',
            darkMode: 'Karanlık Mod',
            lightMode: 'Aydınlık Mod',
            // Share modal
            shareTitle: 'Konumu Paylaş',
            shareWhatsappTitle: 'WhatsApp',
            shareWhatsappDesc: 'WhatsApp ile paylaş',
            shareQRTitle: 'QR Kod',
            shareQRDesc: 'QR kod oluştur ve paylaş',
            shareCodeTitle: 'Paylaşım Kodu',
            shareCodeDesc: '6 haneli kod oluştur',
            // QR modal
            qrTitle: 'QR Kod',
            qrHint: 'Bu QR kodu okutarak konuma ulaşabilirsiniz',
            qrHint2: '📍 Google, Apple veya Yandex Haritalar\'da açılır',
            qrDownload: 'QR Kodu İndir',
            // Code modal
            codeTitle: 'Paylaşım Kodu',
            codeHint: 'Bu kodu paylaşarak konumunuzu gönderin',
            codeCopy: 'Kodu Kopyala',
            codeBetaNotice: 'Bu özellik beta aşamasındadır. Sunucu henüz aktif değildir, kod yalnızca bu cihazda geçerlidir.',
            codeCopied: 'Kod kopyalandı',
            // Enter code modal
            enterCodeTitle: 'Kod ile Konum Bul',
            enterCodeDesc: 'Size gönderilen 6 haneli kodu girin',
            findCode: 'Kodu Bul',
            betaTitle: 'Beta Sürümü',
            betaDesc: 'Bu özellik henüz beta aşamasındadır. Sunucu bağlantısı yakında eklenecektir. Şu anda yalnızca bu cihazda oluşturulan kodlar geçerlidir.',
            goToLocation: 'Konuma Git',
            // Saved modal
            savedTitle: 'Kayıtlı Konumlar',
            savedEmpty: 'Henüz kayıtlı konumunuz yok',
            savedEmptyHint: 'Haritadan bir konum seçip kaydedin',
            // Name modal
            nameTitle: 'Konumu Adlandır',
            nameDesc: 'Bu konuma bir ad verin',
            namePlaceholder: 'Örn: Ev, İş, Kafe...',
            notePlaceholder: 'Not ekleyin (örn: 3. kat, arka kapıdan gir...)',
            autoName: 'Otomatik Ad',
            autoLabel: 'Otomatik',
            // Edit modal
            editTitle: 'Konumu Düzenle',
            editNamePlaceholder: 'Konum adı',
            editNotePlaceholder: 'Not ekleyin...',
            update: 'Güncelle',
            // About modal
            aboutTitle: 'Hakkında',
            aboutDesc: 'Haritadan seçtiğiniz konumları kolayca paylaşın. WhatsApp, QR kod veya paylaşım kodu ile arkadaşlarınıza gönderin.',
            aboutFeature1: 'Haritadan seç',
            aboutFeature2: 'Kolayca paylaş',
            aboutFeature3: 'Konumları kaydet',
            aboutCredit: 'Şahin Bölükbaşı tarafından yapılmıştır',
            linkedinProfile: 'LinkedIn Profili',
            // Toasts
            toastSaved: 'Konum kaydedildi',
            toastDeleted: 'Konum silindi',
            toastUpdated: 'Konum güncellendi',
            toastAlreadySaved: 'Bu konum zaten kaydedilmiş',
            toastNoGeo: 'Konum servisi desteklenmiyor',
            toastGeoFailed: 'Konum alınamadı',
            toastQRDownloaded: 'QR kod indirildi',
            // Open page
            openTitle: 'Konum Paylaşıldı',
            openSubtitle: 'Konumu açmak için bir harita seçin',
            openGoogle: 'Google Haritalar',
            openGoogleDesc: 'Google Maps ile aç',
            openApple: 'Apple Haritalar',
            openAppleDesc: 'Apple Maps ile aç',
            openYandex: 'Yandex Haritalar',
            openYandexDesc: 'Yandex Maps ile aç',
            openHome: 'Konum Paylaş Uygulamasını Aç',
            openNotFound: 'Konum Bulunamadı',
            openInvalidLink: 'Geçersiz konum bağlantısı',
            // Misc
            unknownLocation: 'Bilinmeyen konum',
            location: 'Konum',
        },
        en: {
            searchPlaceholder: 'Search location...',
            onboardingText: 'Tap on the map to select a location',
            locationLoading: 'Loading location...',
            locationNotSelected: 'No Location Selected',
            save: 'Save',
            saved: 'Saved',
            share: 'Share',
            navigate: 'Directions',
            appName: 'Share Location',
            version: 'Beta v1.0',
            menuSaved: 'Saved Locations',
            menuEnterCode: 'Find by Code',
            menuAbout: 'About',
            menuLanguage: 'Türkçe',
            menuTheme: 'Dark Mode',
            darkMode: 'Dark Mode',
            lightMode: 'Light Mode',
            shareTitle: 'Share Location',
            shareWhatsappTitle: 'WhatsApp',
            shareWhatsappDesc: 'Share via WhatsApp',
            shareQRTitle: 'QR Code',
            shareQRDesc: 'Generate and share QR code',
            shareCodeTitle: 'Share Code',
            shareCodeDesc: 'Generate 6-digit code',
            qrTitle: 'QR Code',
            qrHint: 'Scan this QR code to reach the location',
            qrHint2: '📍 Opens in Google, Apple or Yandex Maps',
            qrDownload: 'Download QR Code',
            codeTitle: 'Share Code',
            codeHint: 'Share this code to send your location',
            codeCopy: 'Copy Code',
            codeBetaNotice: 'This feature is in beta. Server is not yet active, the code is only valid on this device.',
            codeCopied: 'Code copied',
            enterCodeTitle: 'Find by Code',
            enterCodeDesc: 'Enter the 6-digit code you received',
            findCode: 'Find Code',
            betaTitle: 'Beta Version',
            betaDesc: 'This feature is currently in beta. Server connection will be added soon. Currently only codes created on this device are valid.',
            goToLocation: 'Go to Location',
            savedTitle: 'Saved Locations',
            savedEmpty: 'No saved locations yet',
            savedEmptyHint: 'Select and save a location from the map',
            nameTitle: 'Name Location',
            nameDesc: 'Give this location a name',
            namePlaceholder: 'e.g. Home, Work, Cafe...',
            notePlaceholder: 'Add a note (e.g. 3rd floor, use back door...)',
            autoName: 'Auto Name',
            autoLabel: 'Auto',
            editTitle: 'Edit Location',
            editNamePlaceholder: 'Location name',
            editNotePlaceholder: 'Add a note...',
            update: 'Update',
            aboutTitle: 'About',
            aboutDesc: 'Easily share locations from the map. Send to your friends via WhatsApp, QR code or share code.',
            aboutFeature1: 'Select on map',
            aboutFeature2: 'Share easily',
            aboutFeature3: 'Save locations',
            aboutCredit: 'Made by Şahin Bölükbaşı',
            linkedinProfile: 'LinkedIn Profile',
            toastSaved: 'Location saved',
            toastDeleted: 'Location deleted',
            toastUpdated: 'Location updated',
            toastAlreadySaved: 'This location is already saved',
            toastNoGeo: 'Geolocation not supported',
            toastGeoFailed: 'Could not get location',
            toastQRDownloaded: 'QR code downloaded',
            openTitle: 'Location Shared',
            openSubtitle: 'Choose a map to open the location',
            openGoogle: 'Google Maps',
            openGoogleDesc: 'Open with Google Maps',
            openApple: 'Apple Maps',
            openAppleDesc: 'Open with Apple Maps',
            openYandex: 'Yandex Maps',
            openYandexDesc: 'Open with Yandex Maps',
            openHome: 'Open Share Location App',
            openNotFound: 'Location Not Found',
            openInvalidLink: 'Invalid location link',
            unknownLocation: 'Unknown location',
            location: 'Location',
        }
    };

    let currentLang = localStorage.getItem('app_lang') || 
        (navigator.language.startsWith('tr') ? 'tr' : 'en');

    function t(key) {
        return translations[currentLang]?.[key] || translations['tr'][key] || key;
    }

    function getLang() {
        return currentLang;
    }

    function setLang(lang) {
        currentLang = lang;
        localStorage.setItem('app_lang', lang);
    }

    function toggle() {
        const newLang = currentLang === 'tr' ? 'en' : 'tr';
        setLang(newLang);
        return newLang;
    }

    return { t, getLang, setLang, toggle };
})();
