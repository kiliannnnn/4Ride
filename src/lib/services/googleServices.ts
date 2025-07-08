/**
 * Loads the Google Maps JavaScript API dynamically if it is not already loaded.
 * Ensures that the API is loaded only once, and calls the provided callback once the API is ready.
 * If the script is already being loaded, waits for it to finish loading before calling the callback.
 * 
 * @param callback - Function to call once Google Maps API is loaded and ready.
 */
export function loadGoogleMaps(callback: () => void) {
    if ((window as any).google && (window as any).google.maps) {
        callback();
        return;
    }
    if (document.getElementById('google-maps-script')) {
        // Wait for script to load
        const check = setInterval(() => {
            if ((window as any).google && (window as any).google.maps) {
                clearInterval(check);
                callback();
            }
        }, 100);
        return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.PUBLIC_GOOGLE_MAPS_KEY}&libraries=places`;
    script.defer = true;
    script.async = true;
    script.onload = callback;
    document.body.appendChild(script);
}

/**
 * Decodes a Google Maps encoded polyline string into an array of {lat, lon} points.
 * @param encoded The encoded polyline string
 * @returns Array of points with lat and lon
 */
export function decodePolyline(encoded: string) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lon: lng / 1e5 });
    }
    return points;
}