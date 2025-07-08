import { createSignal, onCleanup, createEffect, onMount, Show } from 'solid-js';
import { loadGoogleMaps } from '@/lib/services/googleServices';
import { generateGPX, generateKML } from '@/lib/utils';
import { t, askOllamaUi, FEATURES, AVOID, STYLES } from '@/lib/utils';
import type { lang } from '@/lib/utils';

interface AskOllamaProps {
  lang?: string;
}

// function GoogleDirectionsDemo() {
//   let mapRef: HTMLDivElement | undefined;
//   onMount(() => {
//     function initMap() {
//       const directionsService = new (window as any).google.maps.DirectionsService();
//       const directionsRenderer = new (window as any).google.maps.DirectionsRenderer();
//       const map = new (window as any).google.maps.Map(mapRef, {
//         zoom: 7,
//         center: { lat: 48.85, lng: 2.35 }, // Paris
//       });
//       directionsRenderer.setMap(map);
//       directionsService.route({
//         origin: { query: 'Paris, France' },
//         destination: { query: 'Lyon, France' },
//         travelMode: (window as any).google.maps.TravelMode.DRIVING,
//       }, (response: any, status: string) => {
//         if (status === 'OK') {
//           directionsRenderer.setDirections(response);
//         } else {
//           window.alert('Directions request failed due to ' + status);
//         }
//       });
//     }
//     loadGoogleMaps(initMap);
//   });
//   return <div ref={el => (mapRef = el as HTMLDivElement)} style={{ height: '400px', width: '100%' }} />;
// }

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
  const lang: lang = (['fr', 'es', 'jp'].includes(props.lang as string) ? props.lang as lang : 'en');
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [waypoints, setWaypoints] = createSignal<{ lat: number, lon: number, name: string }[]>([]);
  const [parsing, setParsing] = createSignal(false);
  const [mapCenter, setMapCenter] = createSignal<{ lat: number, lng: number } | null>(null);
  let mapRef: HTMLDivElement | undefined;
  let map: any = null;
  let marker: any = null;
  const [sessionToken, setSessionToken] = createSignal('');

  // Generate a new session token for each new search session
  function newSessionToken() {
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
    const res = await fetch('/api/google/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: query, sessionToken: sessionToken() })
    });
    const data = await res.json();
    const results = data.predictions || [];
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
    setDropdownOpen(false);
    setPlace(s.description);
    const res = await fetch('/api/google/places/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: s.place_id, sessiontoken: sessionToken() })
    });
    const data = await res.json();
    const details = data.result;
    setPlaceDetails({
      name: details.name,
      address: details.formatted_address,
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
    });
    setSuggestions([]);
    setSessionToken('');
  };

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
      const res = await fetch('/api/ai/ollama', {
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
      return;
    }
    // Geocode each name using Google Places backend proxy
    const geocoded: { lat: number, lon: number, name: string }[] = [];
    for (const name of names) {
      try {
        const res = await fetch('/api/google/places/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.lat && data.lon) {
          geocoded.push({ lat: data.lat, lon: data.lon, name: data.name });
        }
      } catch (err) {}
    }
    setWaypoints(geocoded);
    setParsing(false);
  });

  // DirectionsService/DirectionsRenderer logic
  let directionsRenderer: any = null;
  let directionsService: any = null;
  let singleCityMarker: any = null;
  createEffect(() => {
    if (!mapRef) return;
    // If there are 2+ waypoints, use DirectionsRenderer
    if (waypoints().length >= 2) {
      loadGoogleMaps(() => {
        if (!map) {
          map = new (window as any).google.maps.Map(mapRef, {
            center: { lat: waypoints()[0].lat, lng: waypoints()[0].lon },
            zoom: 7,
          });
        }
        if (!directionsService) {
          directionsService = new (window as any).google.maps.DirectionsService();
        }
        if (!directionsRenderer) {
          directionsRenderer = new (window as any).google.maps.DirectionsRenderer();
          directionsRenderer.setMap(map);
        }
        // Build waypoints for DirectionsService
        const origin = { lat: waypoints()[0].lat, lng: waypoints()[0].lon };
        const destination = { lat: waypoints()[waypoints().length - 1].lat, lng: waypoints()[waypoints().length - 1].lon };
        const wps = waypoints().slice(1, -1).map(wp => ({ location: { lat: wp.lat, lng: wp.lon }, stopover: true }));
        directionsService.route({
          origin,
          destination,
          waypoints: wps,
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
        }, (result: any, status: string) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
          } else {
            // fallback: just show markers for waypoints
            if (map) {
              waypoints().forEach(wp => {
                new (window as any).google.maps.Marker({
                  position: { lat: wp.lat, lng: wp.lon },
                  map,
                  title: wp.name,
                });
              });
            }
          }
        });
      });
    } else if (placeDetails()) {
      // If only one city is selected, center and show marker
      loadGoogleMaps(() => {
        const center = { lat: parseFloat(placeDetails().lat), lng: parseFloat(placeDetails().lng) };
        if (!map) {
          map = new (window as any).google.maps.Map(mapRef, {
            center,
            zoom: 10,
          });
        } else {
          map.setCenter(center);
          map.setZoom(10);
        }
        // Remove previous marker if any
        if (singleCityMarker) {
          singleCityMarker.setMap(null);
        }
        // Add new marker
        singleCityMarker = new (window as any).google.maps.Marker({
          position: center,
          map,
          title: placeDetails().name,
        });
      });
    }
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
    loadGoogleMaps(() => {
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
    <div class="flex flex-col md:flex-row gap-8 items-start justify-center min-h-screen w-full p-8">
      <div class="w-full md:w-1/2">
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="flex flex-col md:flex-row md:items-end gap-4 w-full">
            <div class="flex-1 min-w-0">
              <label class="block text-sm font-medium mb-1">{t(lang, 'place')}</label>
              <div class="dropdown w-full">
                <input
                  type="text"
                  class="input input-bordered w-full"
                  value={place()}
                  onInput={handleInput}
                  required
                  autocomplete="off"
                  placeholder={t(lang, 'searchCity')}
                  onFocus={() => setDropdownOpen(suggestions().length > 0)}
                  tabindex="0"
                />
                <ul
                  tabindex="0"
                  class={`dropdown-content menu bg-base-100 rounded-box z-1 w-full p-2 shadow-sm ${dropdownOpen() ? '' : 'hidden'}`}
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
            </div>
            <div class="flex flex-col md:flex-row gap-2 md:items-end h-full">
              <div>
                <label class="block text-sm font-medium mb-1">{t(lang, 'days')}</label>
                <input
                  type="number"
                  min="0"
                  class="input input-bordered w-full md:w-20"
                  value={days()}
                  onInput={e => setDays(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{t(lang, 'hours')}</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  class="input input-bordered w-full md:w-20"
                  value={hours()}
                  onInput={e => setHours(e.currentTarget.value)}
                />
              </div>
              <div class="flex flex-col items-start md:self-center mt-4 md:mt-0 md:ml-4">
                <label class="block text-sm font-medium mb-1">{t(lang, 'roundTrip')}</label>
                <label class="cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary"
                    checked={roundTrip()}
                    onChange={() => setRoundTrip(v => !v)}
                  />
                </label>
              </div>
            </div>
          </div>
          <div class="join join-vertical bg-base-100 w-full">
            {/* Features Accordion */}
            <div class="collapse collapse-arrow join-item border-base-300 border">
              <input type="radio" name="form-accordion" checked />
              <div class="collapse-title font-semibold">
                {t(lang, 'features')}
              </div>
              <div class="collapse-content">
                <div class="flex flex-wrap gap-2">
                  {FEATURES.map(f => (
                    <label class="cursor-pointer flex items-center gap-1">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary"
                        checked={features().includes(f.key)}
                        onChange={() => handleCheckbox(features(), setFeatures, f.key)}
                      />
                      {f.label[lang]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {/* Avoid Accordion */}
            <div class="collapse collapse-arrow join-item border-base-300 border">
              <input type="radio" name="form-accordion" />
              <div class="collapse-title font-semibold">
                {t(lang, 'avoid')}
              </div>
              <div class="collapse-content">
                <div class="flex flex-wrap gap-2">
                  {AVOID.map(a => (
                    <label class="cursor-pointer flex items-center gap-1">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary"
                        checked={avoid().includes(a.key)}
                        onChange={() => handleCheckbox(avoid(), setAvoid, a.key)}
                      />
                      {a.label[lang]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {/* Style Accordion */}
            <div class="collapse collapse-arrow join-item border-base-300 border">
              <input type="radio" name="form-accordion" />
              <div class="collapse-title font-semibold">
                {t(lang, 'style')}
              </div>
              <div class="collapse-content">
                <div class="flex gap-4">
                  {STYLES.map(s => (
                    <label class="cursor-pointer flex items-center gap-1">
                      <input
                        type="radio"
                        class="radio radio-primary"
                        name="style"
                        checked={style() === s.key}
                        onChange={() => setStyle(s.key)}
                      />
                      {s.label[lang]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
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
                const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "itinerary.gpx";
                a.click();
                URL.revokeObjectURL(url);
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
      {/* <div class="w-full md:w-1/2 flex flex-col items-center mt-8">
        <h2 class="text-xl font-bold mb-2">Google Directions Demo</h2>
        <div class="w-full" style={{ 'max-width': '500px' }}>
          <GoogleDirectionsDemo />
        </div>
      </div> */}
    </div>
  );
} 