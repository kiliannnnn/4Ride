import { createSignal, onCleanup, createEffect, onMount, Show } from 'solid-js';

interface AskOllamaProps {
  lang?: string;
}

type SupportedLang = 'en' | 'fr' | 'es' | 'jp';

const GEONAMES_USERNAME = 'kiliannnnn';

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

  // Fetch city suggestions from GeoNames
  const fetchSuggestions = async (query: string) => {
    if (!query) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    const url = `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&featureClass=P&maxRows=5&username=${GEONAMES_USERNAME}&lang=${lang}`;
    const res = await fetch(url);
    const data = await res.json();
    setSuggestions(data.geonames || []);
    setDropdownOpen((data.geonames || []).length > 0);
  };

  const handleInput = (e: any) => {
    setPlace(e.target.value);
    setPlaceDetails(null);
    fetchSuggestions(e.target.value);
  };

  const handleSuggestionClick = (s: any) => {
    setPlace(`${s.name}, ${s.countryName}${s.adminName1 ? ', ' + s.adminName1 : ''}`);
    setPlaceDetails(s);
    setSuggestions([]);
    setDropdownOpen(false);
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
        ? `${placeDetails().name}, ${placeDetails().countryName}${placeDetails().adminName1 ? ', ' + placeDetails().adminName1 : ''} (${placeDetails().lat}, ${placeDetails().lng})`
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
    if (!response()) {
      setWaypoints([]);
      return;
    }
    setParsing(true);
    // Parse answer for city/road names (split by > or ->)
    const steps = response().split(/>|->/).map(s => s.trim()).filter(Boolean);
    // Geocode each step (city) using GeoNames if not already coordinates
    const geocoded: { lat: number, lon: number, name: string }[] = [];
    for (const step of steps) {
      // If already in (lat, lon) format, extract
      const match = step.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
      if (match) {
        geocoded.push({ lat: parseFloat(match[1]), lon: parseFloat(match[2]), name: step.replace(/\s*\(.*\)$/, '') });
        continue;
      }
      // Otherwise, geocode using GeoNames
      const url = `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(step)}&maxRows=1&username=${GEONAMES_USERNAME}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.geonames && data.geonames.length > 0) {
          const g = data.geonames[0];
          geocoded.push({ lat: parseFloat(g.lat), lon: parseFloat(g.lng), name: step });
        }
      } catch {}
    }
    setWaypoints(geocoded);
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
                    {s.name}, {s.countryName}{s.adminName1 ? ', ' + s.adminName1 : ''}
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
        {waypoints().length > 1 && !parsing() && (
          <button
            class="btn btn-secondary mt-4 w-full"
            onClick={() => downloadGPX(generateGPX(waypoints()))}
          >
            Export as GPX
          </button>
        )}
      </div>
      <div class="w-full md:w-1/2 flex flex-col items-center">
        <h2 class="text-xl font-bold mb-2">Map</h2>
        <div class="w-full" style={{ 'max-width': '500px' }}>
          <div ref={el => (mapRef = el as HTMLDivElement)} style={{ height: '400px', width: '100%' }} />
        </div>
      </div>
    </div>
  );
} 