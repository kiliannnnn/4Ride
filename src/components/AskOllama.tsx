import { createSignal, onCleanup, createEffect, onMount, Show } from 'solid-js';

interface AskOllamaProps {
  lang?: string;
}

type SupportedLang = 'en' | 'fr' | 'es' | 'jp';

const askOllamaUi = {
  en: {
    title: "Ask Ollama (phi4)",
    place: "Place",
    days: "Days",
    hours: "Hours",
    features: "Points of interest",
    avoid: "To avoid",
    style: "Ride style",
    roundTrip: "Round trip",
    ask: "Ask",
    asking: "Asking...",
    error: "Error",
    response: "Response",
    chill: "Chill",
    normal: "Normal",
    fast: "Fast boy",
    searchCity: "Search for a city...",
  },
  fr: {
    title: "Demander à Ollama (phi4)",
    place: "Lieu",
    days: "Jours",
    hours: "Heures",
    features: "Points d’intérêt",
    avoid: "À éviter",
    style: "Style de conduite",
    roundTrip: "Aller-retour",
    ask: "Demander",
    asking: "Recherche...",
    error: "Erreur",
    response: "Réponse",
    chill: "Détente",
    normal: "Normal",
    fast: "Rapide",
    searchCity: "Rechercher une ville...",
  },
  es: {
    title: "Preguntar a Ollama (phi4)",
    place: "Lugar",
    days: "Días",
    hours: "Horas",
    features: "Puntos de interés",
    avoid: "Evitar",
    style: "Estilo de conducción",
    roundTrip: "Ida y vuelta",
    ask: "Preguntar",
    asking: "Preguntando...",
    error: "Error",
    response: "Respuesta",
    chill: "Tranquilo",
    normal: "Normal",
    fast: "Rápido",
    searchCity: "Buscar una ciudad...",
  },
  jp: {
    title: "Ollama (phi4) に質問",
    place: "場所",
    days: "日数",
    hours: "時間",
    features: "見どころ",
    avoid: "避ける",
    style: "走行スタイル",
    roundTrip: "往復",
    ask: "質問する",
    asking: "質問中...",
    error: "エラー",
    response: "回答",
    chill: "のんびり",
    normal: "普通",
    fast: "速い",
    searchCity: "都市を検索...",
  },
} as const;

function t(lang: SupportedLang, key: keyof typeof askOllamaUi['en']) {
  return askOllamaUi[lang]?.[key] || askOllamaUi['en'][key];
}

const FEATURES = [
  { key: 'mountains', label: { en: 'Mountains', fr: 'Montagnes', es: 'Montañas', jp: '山' } },
  { key: 'lakes', label: { en: 'Lakes', fr: 'Lacs', es: 'Lagos', jp: '湖' } },
  { key: 'ocean', label: { en: 'Ocean', fr: 'Océan', es: 'Océano', jp: '海' } },
  { key: 'forest', label: { en: 'Forest', fr: 'Forêt', es: 'Bosque', jp: '森' } },
  { key: 'city', label: { en: 'City', fr: 'Ville', es: 'Ciudad', jp: '都市' } },
];
const AVOID = [
  { key: 'highway', label: { en: 'Highway', fr: 'Autoroute', es: 'Autopista', jp: '高速道路' } },
  { key: 'toll', label: { en: 'Toll', fr: 'Péage', es: 'Peaje', jp: '有料道路' } },
  { key: 'ferry', label: { en: 'Ferry', fr: 'Ferry', es: 'Ferry', jp: 'フェリー' } },
  { key: 'gravel', label: { en: 'Gravel', fr: 'Gravier', es: 'Grava', jp: '砂利' } },
];
const STYLES = [
  { key: 'chill', label: { en: askOllamaUi.en.chill, fr: askOllamaUi.fr.chill, es: askOllamaUi.es.chill, jp: askOllamaUi.jp.chill } },
  { key: 'normal', label: { en: askOllamaUi.en.normal, fr: askOllamaUi.fr.normal, es: askOllamaUi.es.normal, jp: askOllamaUi.jp.normal } },
  { key: 'fast', label: { en: askOllamaUi.en.fast, fr: askOllamaUi.fr.fast, es: askOllamaUi.es.fast, jp: askOllamaUi.jp.fast } },
];

function generateGPX(waypoints: { lat: number, lon: number, name: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="4Ride" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte>\n    ${waypoints.map(wp => `\n      <rtept lat="${wp.lat}" lon="${wp.lon}">\n        <name>${wp.name}</name>\n      </rtept>`).join('')}\n  </rte>\n</gpx>`;
}

function generateKML(waypoints: { lat: number, lon: number, name: string }[], name = 'Itinerary') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>${name}</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${waypoints.map(wp => `${wp.lon},${wp.lat},0`).join('\n          ')}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

function downloadGPX(gpxString: string, filename = 'itinerary.gpx') {
  const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadGoogleMaps(apiKey: string, callback: () => void) {
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
  script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
  script.async = true;
  script.onload = callback;
  document.body.appendChild(script);
}

// Add this helper to decode Google polyline
function decodePolyline(encoded: string) {
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
    points.push({ lat: lat / 1e5, lon: lng / 1e5, name: '' });
  }
  return points;
}

function GoogleDirectionsDemo() {
  let mapRef: HTMLDivElement | undefined;
  onMount(() => {
    function initMap() {
      const directionsService = new (window as any).google.maps.DirectionsService();
      const directionsRenderer = new (window as any).google.maps.DirectionsRenderer();
      const map = new (window as any).google.maps.Map(mapRef, {
        zoom: 7,
        center: { lat: 48.85, lng: 2.35 }, // Paris
      });
      directionsRenderer.setMap(map);
      directionsService.route({
        origin: { query: 'Paris, France' },
        destination: { query: 'Lyon, France' },
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
      }, (response: any, status: string) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
          // Extract polyline points
          const route = response.routes[0].overview_path;
          // console.log('Demo route polyline points:');
          // route.forEach((point: any) => {
          //   console.log(`${point.lng()},${point.lat()},0`);
          // });
        } else {
          window.alert('Directions request failed due to ' + status);
        }
      });
    }
    loadGoogleMaps(import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY as string, initMap);
  });
  return <div ref={el => (mapRef = el as HTMLDivElement)} style={{ height: '400px', width: '100%' }} />;
}

// Add Google Places Autocomplete and Details fetchers
async function fetchGooglePlaceSuggestions(input: string, sessionToken: string) {
  // Call backend proxy to avoid CORS
  const res = await fetch('/api/places-autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, sessionToken })
  });
  const data = await res.json();
  return data.predictions || [];
}

async function fetchGooglePlaceDetails(placeId: string, sessionToken: string) {
  const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${apiKey}&sessiontoken=${sessionToken}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result;
}

export default function AskOllama(props: AskOllamaProps) {
  const [place, setPlace] = createSignal('');
  const [placeDetails, setPlaceDetails] = createSignal<any | null>(null);
  const [suggestions, setSuggestions] = createSignal<any[]>([]);
  const [days, setDays] = createSignal('');
  const [hours, setHours] = createSignal('');
  const [features, setFeatures] = createSignal<string[]>([]);
  const [avoid, setAvoid] = createSignal<string[]>([]);
  const [style, setStyle] = createSignal('');
  const [roundTrip, setRoundTrip] = createSignal(true);
  const [response, setResponse] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const lang: SupportedLang = (['fr', 'es', 'jp'].includes(props.lang as string) ? props.lang as SupportedLang : 'en');
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;
  const [waypoints, setWaypoints] = createSignal<{ lat: number, lon: number, name: string }[]>([]);
  const [parsing, setParsing] = createSignal(false);
  const [mapCenter, setMapCenter] = createSignal<{ lat: number, lng: number } | null>(null);
  let mapRef: HTMLDivElement | undefined;
  let map: any = null;
  let marker: any = null;
  const [sessionToken, setSessionToken] = createSignal('');

  // Generate a new session token for each new search session
  function newSessionToken() {
    // Simple random string for session token
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Fetch city suggestions from Google Places
  const fetchSuggestions = async (query: string) => {
    if (!query) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    if (!sessionToken()) setSessionToken(newSessionToken());
    const results = await fetchGooglePlaceSuggestions(query, sessionToken());
    setSuggestions(results);
    setDropdownOpen(results.length > 0);
  };

  // Handle input change for autocomplete
  const handleInput = (e: any) => {
    setPlace(e.target.value);
    setPlaceDetails(null);
    if (!sessionToken()) setSessionToken(newSessionToken());
    fetchSuggestions(e.target.value);
  };

  // Handle suggestion click: fetch details and set placeDetails
  const handleSuggestionClick = async (s: any) => {
    setPlace(s.description);
    const details = await fetchGooglePlaceDetails(s.place_id, sessionToken());
    setPlaceDetails({
      name: details.name,
      address: details.formatted_address,
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
    });
    setSuggestions([]);
    setDropdownOpen(false);
    setSessionToken(''); // Reset session token for next search
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setDropdownOpen(false);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => window.removeEventListener('mousedown', handleClickOutside));
  }

  const handleCheckbox = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const placeString = placeDetails()
        ? `${placeDetails().name}, ${placeDetails().address} (${placeDetails().lat}, ${placeDetails().lng})`
        : place();
      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place: placeString,
          days: days(),
          hours: hours(),
          features: features(),
          avoid: avoid(),
          style: style(),
          roundTrip: roundTrip(),
          lang
        })
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      setResponse('');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setResponse(fullText);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Parse AI answer for waypoints and geocode them
  createEffect(async () => {
    // Only run when response is non-empty and loading is false (AI finished streaming)
    if (!response() || loading()) {
      setWaypoints([]);
      setParsing(false);
      return;
    }
    setParsing(true);
    console.log('Parsing itinerary from AI response...');
    console.log('AI response:', response());
    let names: string[] = [];
    let raw = response().trim();
    // Remove Markdown code block if present
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    }
    try {
      names = JSON.parse(raw);
      if (!Array.isArray(names)) throw new Error('Not an array');
    } catch (err) {
      setWaypoints([]);
      setParsing(false);
      console.log('Failed to parse AI response as JSON array:', err);
      return;
    }
    // Geocode each name using Google Places backend proxy
    const geocoded: { lat: number, lon: number, name: string }[] = [];
    for (const name of names) {
      try {
        const res = await fetch('/api/places-geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.lat && data.lon) {
          geocoded.push({ lat: data.lat, lon: data.lon, name: data.name });
        } else {
          console.log('No Google Places result for', name);
        }
      } catch (err) {
        console.log('Geocoding error for', name, err);
      }
    }
    // If we have at least two cities, fetch the route from Google Directions
    if (geocoded.length > 1) {
      try {
        const res = await fetch('/api/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints: geocoded })
        });
        const data = await res.json();
        if (data.points) {
          setWaypoints(data.points);
        }
      } catch (err) {
        setWaypoints(geocoded);
        console.log('Error fetching route from Google Directions:', err);
      }
    } else {
      setWaypoints(geocoded);
    }
    setParsing(false);
  });

  // Update map center when a place is selected
  createEffect(() => {
    if (placeDetails()) {
      setMapCenter({ lat: parseFloat(placeDetails().lat), lng: parseFloat(placeDetails().lng) });
    }
  });

  // Initialize and update Google Map and marker
  createEffect(() => {
    const center = mapCenter();
    if (!mapRef) return;
    loadGoogleMaps(import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY as string, () => {
      if (!map) {
        map = new (window as any).google.maps.Map(mapRef, {
          center: center || { lat: 48.8566, lng: 2.3522 },
          zoom: 10,
        });
        if (center) {
          marker = new (window as any).google.maps.Marker({
            position: center,
            map,
          });
        }
      } else if (center) {
        map.setCenter(center);
        if (marker) {
          marker.setPosition(center);
        } else {
          marker = new (window as any).google.maps.Marker({
            position: center,
            map,
          });
        }
      }
    });
  });

  return (
    <div class="flex flex-col md:flex-row gap-8 items-start justify-center">
      <div class="w-full md:w-1/2">
        <form onSubmit={handleSubmit} class="space-y-4">
          <div ref={dropdownRef} class="dropdown w-full" style={{ position: 'relative' }}>
            <label class="block text-sm font-medium mb-1">{t(lang, 'place')}</label>
            <input
              type="text"
              class="input input-bordered w-full"
              value={place()}
              onInput={handleInput}
              required
              autocomplete="off"
              placeholder={t(lang, 'searchCity')}
              onFocus={() => setDropdownOpen(suggestions().length > 0)}
            />
            <ul
              class={`dropdown-content menu bg-base-100 border w-full mt-1 rounded-box shadow z-10 ${dropdownOpen() ? '' : 'hidden'}`}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                'pointer-events': dropdownOpen() ? 'auto' : 'none'
              }}
            >
              {suggestions().map(s => (
                <li>
                  <a
                    class="p-2 hover:bg-base-200 cursor-pointer"
                    onMouseDown={() => handleSuggestionClick(s)}
                  >
                    {s.description}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">{t(lang, 'days')}</label>
              <input
                type="number"
                min="0"
                class="input input-bordered w-full"
                value={days()}
                onInput={e => setDays(e.currentTarget.value)}
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">{t(lang, 'hours')}</label>
              <input
                type="number"
                min="0"
                max="23"
                class="input input-bordered w-full"
                value={hours()}
                onInput={e => setHours(e.currentTarget.value)}
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{t(lang, 'features')}</label>
            <div class="flex flex-wrap gap-2">
              {FEATURES.map(f => (
                <label class="cursor-pointer flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={features().includes(f.key)}
                    onChange={() => handleCheckbox(features(), setFeatures, f.key)}
                  />
                  {f.label[lang]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{t(lang, 'avoid')}</label>
            <div class="flex flex-wrap gap-2">
              {AVOID.map(a => (
                <label class="cursor-pointer flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={avoid().includes(a.key)}
                    onChange={() => handleCheckbox(avoid(), setAvoid, a.key)}
                  />
                  {a.label[lang]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{t(lang, 'style')}</label>
            <div class="flex gap-4">
              {STYLES.map(s => (
                <label class="cursor-pointer flex items-center gap-1">
                  <input
                    type="radio"
                    name="style"
                    checked={style() === s.key}
                    onChange={() => setStyle(s.key)}
                  />
                  {s.label[lang]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={roundTrip()}
                onChange={() => setRoundTrip(v => !v)}
              />
              {t(lang, 'roundTrip')}
            </label>
          </div>
          <button type="submit" class="btn btn-primary w-full" disabled={loading()}>
            {loading() ? t(lang, 'asking') : t(lang, 'ask')}
          </button>
        </form>
        {error() && <div class="alert alert-error mt-4">{t(lang, 'error')}: {error()}</div>}
        {response() && (
          <div class="alert alert-success mt-4 whitespace-pre-line">
            {t(lang, 'response')}:<br />{response()}
          </div>
        )}
        {parsing() && (
          <div class="flex items-center gap-2 mt-4"><span class="loading loading-spinner loading-md text-info"></span> <span>Calculating itinerary...</span></div>
        )}
        {waypoints().length > 0 && !parsing() && (
          <>
            <button
              class="btn btn-secondary mt-4 w-full"
              onClick={() => {
                const gpx = generateGPX(waypoints());
                downloadGPX(gpx);
              }}
            >
              Export as GPX
            </button>
            <button
              class="btn btn-accent mt-2 w-full"
              onClick={() => {
                const kml = generateKML(waypoints());
                const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'itinerary.kml';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export as KML
            </button>
          </>
        )}
      </div>
      <div class="w-full md:w-1/2 flex flex-col items-center">
        <h2 class="text-xl font-bold mb-2">Map</h2>
        <div class="w-full" style={{ 'max-width': '500px' }}>
          <div ref={el => (mapRef = el as HTMLDivElement)} style={{ height: '400px', width: '100%' }} />
        </div>
      </div>
      <div class="w-full md:w-1/2 flex flex-col items-center mt-8">
        <h2 class="text-xl font-bold mb-2">Google Directions Demo</h2>
        <div class="w-full" style={{ 'max-width': '500px' }}>
          <GoogleDirectionsDemo />
        </div>
      </div>
    </div>
  );
} 