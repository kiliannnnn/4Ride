import { createSignal, onCleanup, createEffect, onMount, Show } from 'solid-js';
import { loadGoogleMaps } from '@/lib/services/googleServices';
import { generateGPX, generateKML } from '@/lib/utils';
import { t, askOllamaUi, FEATURES, AVOID, STYLES, newSessionToken } from '@/lib/utils';
import type { lang } from '@/lib/utils';

interface AskOllamaProps {
  lang?: string;
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
  const [loading, setLoading] = createSignal(false);
  const lang: lang = (['fr', 'es', 'jp'].includes(props.lang as string) ? props.lang as lang : 'en');
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [waypoints, setWaypoints] = createSignal<{ lat: number, lon: number, name: string }[]>([]);
  const [mapCenter, setMapCenter] = createSignal<{ lat: number, lng: number } | null>(null);
  let mapRef: HTMLDivElement | undefined;
  let map: any = null;
  let marker: any = null;
  const [sessionToken, setSessionToken] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'natural' | 'form'>('natural');
  const [responseNatural, setResponseNatural] = createSignal('');
  const [errorNatural, setErrorNatural] = createSignal('');
  const [responseForm, setResponseForm] = createSignal('');
  const [errorForm, setErrorForm] = createSignal('');
  const [parsingNatural, setParsingNatural] = createSignal(false);
  const [parsingForm, setParsingForm] = createSignal(false);
  const [chatMessages, setChatMessages] = createSignal<{ role: 'user' | 'ai', text: string }[]>([]);
  const [naturalInput, setNaturalInput] = createSignal('');
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [itinerary, setItinerary] = createSignal<string[]>([]); // current itinerary as city names
  const [lastItinerary, setLastItinerary] = createSignal<string[]>([]); // for map update comparison
  const [availableItineraries, setAvailableItineraries] = createSignal<{ cities: string[], label: string }[]>([]);
  const [selectedItineraryIdx, setSelectedItineraryIdx] = createSignal(0);
  const [userLocation, setUserLocation] = createSignal<{ lat: number, lon: number, city?: string } | null>(null);
  const [showExportModal, setShowExportModal] = createSignal(false);
  const [exportLoading, setExportLoading] = createSignal(false);
  const [detailedRoute, setDetailedRoute] = createSignal<{ lat: number, lon: number }[] | null>(null);
  const [exportError, setExportError] = createSignal('');

  onMount(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch('/api/google/places/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon })
          });
          const data = await res.json();
          setUserLocation({ lat, lon, city: data.name || undefined });
        } catch {
          setUserLocation({ lat, lon });
        }
      });
    }
  });

  const autoPrompts = [
    "I want to go on a short ride around my location",
    "Suggest a scenic mountain loop",
    "Show me a route with lakes and forests",
    "I want a challenging ride with mountain passes"
  ];

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

  // Parse AI answer for waypoints and geocode them (for natural tab)
  createEffect(async () => {
    // Only run if itinerary changed
    if (itinerary().length === 0 || JSON.stringify(itinerary()) === JSON.stringify(lastItinerary())) {
      setWaypoints([]);
      setParsingNatural(false);
      return;
    }
    setParsingNatural(true);
    const geocoded: { lat: number, lon: number, name: string }[] = [];
    for (const name of itinerary()) {
      try {
        const res = await fetch('/api/google/places/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.lat && data.lon) {
          geocoded.push({ lat: data.lat, lon: data.lon, name: data.name });
        } // else skip point if not found
      } catch (err) { /* skip point if error */ }
    }
    setWaypoints(geocoded);
    setParsingNatural(false);
  });
  // Parse AI answer for waypoints and geocode them (for Form tab)
  createEffect(async () => {
    if (!responseForm() || loading()) {
      setWaypoints([]);
      setParsingForm(false);
      return;
    }
    setParsingForm(true);
    let names: string[] = [];
    let raw = responseForm().trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    }
    try {
      names = JSON.parse(raw);
      if (!Array.isArray(names)) throw new Error('Not an array');
    } catch (err) {
      setWaypoints([]);
      setParsingForm(false);
      return;
    }
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
      } catch (err) { }
    }
    setWaypoints(geocoded);
    setParsingForm(false);
  });

  // DirectionsService/DirectionsRenderer logic
  let directionsRenderer: any = null;
  let directionsService: any = null;
  let singleCityMarker: any = null;
  createEffect(() => {
    if (!mapRef) return;
    // Only use valid waypoints (2+)
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
    } else if (waypoints().length === 1) {
      // If only one city is selected, center and show marker
      loadGoogleMaps(() => {
        const center = { lat: waypoints()[0].lat, lng: waypoints()[0].lon };
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
          title: waypoints()[0].name,
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

  // Helper to send a prompt to the AI
  async function sendPrompt(prompt: string) {
    setNaturalInput('');
    setIsStreaming(true);
    setResponseNatural('');
    setErrorNatural('');
    setChatMessages([...chatMessages(), { role: 'user', text: prompt }]);
    try {
      const res = await fetch('/api/ai/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'natural-convo',
          history: chatMessages(),
          itinerary: itinerary(),
          message: prompt,
          lang
        })
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      setResponseNatural('');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setResponseNatural(fullText);
      }
      // Parse all JSON arrays in the response
      const found: { cities: string[], label: string }[] = [];
      const regex = /Cities for itinerary (\d+):\s*(\[[^\]]*\])/g;
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        try {
          const arr = JSON.parse(match[2]);
          if (Array.isArray(arr)) {
            found.push({ cities: arr, label: `Itinerary ${match[1]}` });
          }
        } catch {}
      }
      if (found.length === 0) {
        const arrMatch = fullText.match(/\[([^\]]+)\]/);
        if (arrMatch) {
          try {
            const arr = JSON.parse(arrMatch[0]);
            if (Array.isArray(arr)) {
              found.push({ cities: arr, label: 'Itinerary 1' });
            }
          } catch {}
        }
      }
      setAvailableItineraries(found);
      if (found.length > 0) {
        setSelectedItineraryIdx(0);
        setItinerary(found[0].cities);
      }
      setChatMessages(msgs => [...msgs, { role: 'ai', text: fullText }]);
    } catch (err: any) {
      setErrorNatural(err.message || 'Unknown error');
    } finally {
      setIsStreaming(false);
    }
  }

  // Helper to fetch detailed route from backend
  async function fetchDetailedRoute() {
    if (!waypoints() || waypoints().length < 2) return null;
    setExportLoading(true);
    setExportError('');
    try {
      const res = await fetch('/api/google/directions/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: waypoints() })
      });
      const data = await res.json();
      if (data.points && Array.isArray(data.points)) {
        setDetailedRoute(data.points);
        return data.points;
      } else {
        setExportError('No route found');
        return null;
      }
    } catch (err: any) {
      setExportError(err.message || 'Unknown error');
      return null;
    } finally {
      setExportLoading(false);
    }
  }

  // Helper to open Google Maps with waypoints
  function openGoogleMaps() {
    if (!waypoints() || waypoints().length < 2) return;
    const base = 'https://www.google.com/maps/dir/';
    const path = waypoints().map(wp => `${wp.lat},${wp.lon}`).join('/');
    window.open(base + path, '_blank');
  }

  return (
    <div class="relative w-full overflow-hidden flex items-center justify-center min-h-screen p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Background image */}
      <div class="absolute inset-0 z-0">
        <img src="/assets/images/biker.webp" alt="Background" class="w-full h-full object-cover object-center opacity-50" />
      </div>
      {/* Main card */}
      <div class="overflow-hidden relative z-10 w-full max-w-sm sm:max-w-6xl md:max-w-7xl lg:max-w-8xl rounded-lg sm:rounded-3xl shadow-2xl bg-base-100/90 backdrop-blur-lg flex flex-col md:flex-row items-stretch justify-center min-h-[calc(100vh-32px)] sm:min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-96px)] lg:min-h-[calc(100vh-128px)]" style={{ 'max-width': '1400px' }}>
        <div class="w-full md:w-1/2 flex flex-col min-h-0 flex-1">
          <div class="w-full flex items-center justify-between mb-0 p-0">
            <div class="tabs tabs-lift flex">
              <label class="tab cursor-pointer text-xs sm:text-sm" classList={{'tab-active': activeTab() === 'natural'}}>
                <input type="radio" name="askollama_tabs" checked={activeTab() === 'natural'} onChange={() => setActiveTab('natural')} />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3 sm:size-4 me-1 sm:me-2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                <span class="hidden sm:inline">Natural</span>
                <span class="sm:hidden">AI</span>
              </label>
              <label class="tab cursor-pointer text-xs sm:text-sm" classList={{'tab-active': activeTab() === 'form'}}>
                <input type="radio" name="askollama_tabs" checked={activeTab() === 'form'} onChange={() => setActiveTab('form')} />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3 sm:size-4 me-1 sm:me-2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg>
                Form
              </label>
            </div>
            <button class="btn btn-outline btn-xs sm:btn-sm m-1" title="Export/Share" onClick={() => setShowExportModal(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 sm:w-5 sm:h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-8m0 0l-3.5 3.5M12 8l3.5 3.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="ml-1 hidden lg:inline">Export/Share</span>
            </button>
          </div>
          <div class="tab-content bg-base-100 border-base-300 p-2 sm:p-4 md:p-6 flex flex-col flex-1 h-full min-h-0" style={{ display: activeTab() === 'natural' ? 'flex' : 'none' }}>
            {/* Chat messages */}
            <div class="flex-1 overflow-y-auto mb-2 sm:mb-4 space-y-1 sm:space-y-2 pr-1 sm:pr-2 min-h-0">
              {chatMessages().map((msg, i) => (
                <div class={msg.role === 'user' ? 'chat chat-end' : 'chat chat-start'}>
                  <div class={`chat-bubble text-xs sm:text-sm ${msg.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-secondary'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {/* Display available itineraries as AI message */}
              <Show when={availableItineraries().length > 0 && !isStreaming()}>
                <div class="chat chat-start">
                  <div class="chat-bubble chat-bubble-accent text-xs sm:text-sm">
                    <div class="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">🗺️ Available Itineraries:</div>
                    <div class="flex flex-col gap-2 sm:gap-3">
                      {availableItineraries().map((it, idx) => (
                        <div class={`border rounded-lg p-2 sm:p-3 transition-all cursor-pointer ${selectedItineraryIdx() === idx ? 'border-primary bg-primary/20 shadow-md' : 'border-base-300 bg-base-100/50'}`}
                             onClick={() => {
                               setSelectedItineraryIdx(idx);
                               setItinerary(it.cities);
                             }}>
                          <div class="font-semibold mb-1 sm:mb-2 text-xs">{it.label || `Itinerary ${idx + 1}`}</div>
                          <div class="flex flex-wrap gap-1 text-xs">
                            {it.cities.map((city, i) => (
                              <>
                                <span class="px-2 py-1 bg-base-200 rounded text-xs">{city}</span>
                                {i < it.cities.length - 1 && <span class="mx-1 text-primary font-bold">→</span>}
                              </>
                            ))}
                          </div>
                          {selectedItineraryIdx() === idx && (
                            <div class="mt-2">
                              <span class="badge badge-primary badge-sm">✓ Selected</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div class="mt-2 text-xs opacity-70">Click on an itinerary above to select it and view it on the map.</div>
                  </div>
                </div>
              </Show>
              {/* Streaming AI message */}
              {isStreaming() && (
                <div class="chat chat-start">
                  <div class="chat-bubble chat-bubble-secondary">
                    {responseNatural()}
                    <span class="ml-2 loading loading-dots loading-xs align-middle"></span>
                  </div>
                </div>
              )}
            </div>
            {/* Input area */}
            <div class="flex gap-1 sm:gap-2 mb-2 overflow-x-auto whitespace-nowrap" style={{ "scrollbar-width": 'none'}}>
              {autoPrompts.map(prompt => {
                let displayPrompt = prompt;
                const needsLocation = prompt.includes('my location');
                return (
                  <button
                    type="button"
                    class="badge badge-outline badge-sm sm:badge-lg cursor-pointer px-2 sm:px-3 py-1 sm:py-2 rounded-full text-xs hover:bg-primary hover:text-primary-content transition flex-shrink-0"
                    onClick={async () => {
                      if (needsLocation && !userLocation()) {
                        alert('Location access is required for this prompt. Please enable location access in your browser settings.');
                        return;
                      }
                      if (needsLocation && userLocation()) {
                        const loc = userLocation();
                        if (loc) {
                          if (typeof loc.city === 'string' && loc.city.length > 0) {
                            displayPrompt = prompt.replace('my location', loc.city);
                          } else {
                            displayPrompt = prompt.replace('my location', `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`);
                          }
                        }
                      }
                      sendPrompt(displayPrompt);
                    }}
                  >
                    <span class="hidden sm:inline">{displayPrompt}</span>
                    <span class="sm:hidden">{displayPrompt.split(' ').slice(0, 2).join(' ')}...</span>
                  </button>
                );
              })}
            </div>
            <form class="flex gap-1 sm:gap-2 items-end flex-shrink-0" style={{ 'margin-top': 0 }} onSubmit={async e => {
              e.preventDefault();
              const message = naturalInput().trim();
              if (!message) return;
              setChatMessages([...chatMessages(), { role: 'user', text: message }]);
              setNaturalInput('');
              setIsStreaming(true);
              setResponseNatural('');
              setErrorNatural('');
              try {
                const res = await fetch('/api/ai/ollama', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mode: 'natural-convo',
                    history: chatMessages(),
                    itinerary: itinerary(),
                    message,
                    lang
                  })
                });
                if (!res.body) throw new Error('No response body');
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                setResponseNatural('');
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  fullText += chunk;
                  setResponseNatural(fullText);
                }
                // Parse all JSON arrays in the response
                const found: { cities: string[], label: string }[] = [];
                const regex = /Cities for itinerary (\d+):\s*(\[[^\]]*\])/g;
                let match;
                while ((match = regex.exec(fullText)) !== null) {
                  try {
                    const arr = JSON.parse(match[2]);
                    if (Array.isArray(arr)) {
                      found.push({ cities: arr, label: `Itinerary ${match[1]}` });
                    }
                  } catch {}
                }
                // Fallback: try to find any JSON array if none matched
                if (found.length === 0) {
                  const arrMatch = fullText.match(/\[([^\]]+)\]/);
                  if (arrMatch) {
                    try {
                      const arr = JSON.parse(arrMatch[0]);
                      if (Array.isArray(arr)) {
                        found.push({ cities: arr, label: 'Itinerary 1' });
                      }
                    } catch {}
                  }
                }
                setAvailableItineraries(found);
                if (found.length > 0) {
                  setSelectedItineraryIdx(0);
                  setItinerary(found[0].cities);
                }
                setChatMessages(msgs => [...msgs, { role: 'ai', text: fullText }]);
              } catch (err: any) {
                setErrorNatural(err.message || 'Unknown error');
              } finally {
                setIsStreaming(false);
              }
            }}>
              <input
                type="text"
                name="natural_question"
                class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm"
                placeholder="Type your question..."
                value={naturalInput()}
                onInput={e => setNaturalInput(e.currentTarget.value)}
                disabled={isStreaming()}
                autocomplete="off"
              />
              <button type="submit" class="btn btn-primary btn-sm sm:btn-md" disabled={isStreaming() || !naturalInput().trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 sm:w-5 sm:h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
            </form>
            {errorNatural() && <div class="alert alert-error mt-2 text-xs sm:text-sm">{t(lang, 'error')}: {errorNatural()}</div>}
          </div>
          <div class="tab-content bg-base-100 border-base-300 p-2 sm:p-4 md:p-6 flex flex-col flex-1 h-full min-h-0" style={{ display: activeTab() === 'form' ? 'flex' : 'none' }}>
            <form onSubmit={async (e: Event) => {
              e.preventDefault();
              setLoading(true);
              setErrorForm('');
              setResponseForm('');
              try {
                const placeString = placeDetails()
                  ? `${placeDetails().name}, ${placeDetails().address} (${placeDetails().lat}, ${placeDetails().lng})`
                  : place();
                const res = await fetch('/api/ai/ollama', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mode: 'form',
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
                setResponseForm('');
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  fullText += chunk;
                  setResponseForm(fullText);
                }
              } catch (err: any) {
                setErrorForm(err.message || 'Unknown error');
              } finally {
                setLoading(false);
              }
            }} class="space-y-3 sm:space-y-4">
              <div class="flex flex-col gap-3 sm:gap-4 w-full">
                <div class="w-full">
                  <label class="block text-xs sm:text-sm font-medium mb-1">{t(lang, 'place')}</label>
                  <div class="dropdown w-full">
                    <input
                      type="text"
                      class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm"
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
                      class={`dropdown-content menu bg-base-100 rounded-box z-1 w-full p-2 shadow-sm text-xs sm:text-sm ${dropdownOpen() ? '' : 'hidden'}`}
                    >
                      {suggestions().map(s => (
                        <li>
                          <a
                            class="p-2 hover:bg-base-200 cursor-pointer text-xs sm:text-sm"
                            onMouseDown={() => handleSuggestionClick(s)}
                          >
                            {s.description}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label class="block text-xs sm:text-sm font-medium mb-1">{t(lang, 'days')}</label>
                    <input
                      type="number"
                      min="0"
                      class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm"
                      value={days()}
                      onInput={e => setDays(e.currentTarget.value)}
                    />
                  </div>
                  <div>
                    <label class="block text-xs sm:text-sm font-medium mb-1">{t(lang, 'hours')}</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm"
                      value={hours()}
                      onInput={e => setHours(e.currentTarget.value)}
                    />
                  </div>
                  <div class="flex flex-col justify-end">
                    <label class="block text-xs sm:text-sm font-medium mb-1">{t(lang, 'roundTrip')}</label>
                    <label class="cursor-pointer flex items-center gap-2 h-8 sm:h-12">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary checkbox-sm sm:checkbox-md"
                        checked={roundTrip()}
                        onChange={() => setRoundTrip(v => !v)}
                      />
                      <span class="text-xs sm:text-sm">Round trip</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="join join-vertical bg-base-100 w-full">
                {/* Features Accordion */}
                <div class="collapse collapse-arrow join-item border-base-300 border">
                  <input type="radio" name="form-accordion" checked />
                  <div class="collapse-title font-semibold text-sm sm:text-base">
                    {t(lang, 'features')}
                  </div>
                  <div class="collapse-content">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FEATURES.map(f => (
                        <label class="cursor-pointer flex items-center gap-2 text-xs sm:text-sm">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-primary checkbox-sm sm:checkbox-md"
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
                  <div class="collapse-title font-semibold text-sm sm:text-base">
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
              <button type="submit" class="btn btn-primary btn-sm sm:btn-md w-full text-xs sm:text-sm" disabled={loading()}>
                {loading() ? t(lang, 'asking') : t(lang, 'ask')}
              </button>
            </form>
            {errorForm() && <div class="alert alert-error mt-3 sm:mt-4 text-xs sm:text-sm">{t(lang, 'error')}: {errorForm()}</div>}
            {responseForm() && (
              <div class="alert alert-success mt-3 sm:mt-4 whitespace-pre-line text-xs sm:text-sm">
                {t(lang, 'response')}:<br />{responseForm()}
              </div>
            )}
            {parsingForm() && (
              <div class="flex items-center gap-2 mt-3 sm:mt-4 text-xs sm:text-sm"><span class="loading loading-spinner loading-sm sm:loading-md text-info"></span> <span>Calculating itinerary...</span></div>
            )}
          </div>
        </div>
        <div class="w-full md:w-1/2 flex flex-col min-h-0 md:min-h-full mt-4 md:mt-0 flex-1">
          <div ref={el => (mapRef = el as HTMLDivElement)} class="w-full flex-1 min-h-[300px] rounded-lg md:rounded-none" />
        </div>
      </div>
      {/* Export/Share Modal (daisyUI dialog) */}
      <dialog id="export_modal" class="modal" open={showExportModal()} onClose={() => setShowExportModal(false)}>
        <div class="modal-box max-w-sm sm:max-w-md">
          <h3 class="font-bold text-base sm:text-lg mb-3 sm:mb-4">Export or Share Route</h3>
          <div class="flex flex-row gap-3 sm:gap-6 justify-center items-center mb-2">
            {/* GPX Button */}
            <button
              class="btn btn-circle btn-md sm:btn-lg btn-secondary tooltip w-12 h-12 sm:w-16 sm:h-16"
              aria-label="Export as GPX"
              data-tip="Export as GPX"
              disabled={exportLoading()}
              onClick={async () => {
                const points = detailedRoute() || await fetchDetailedRoute();
                if (!points) return;
                const gpx = generateGPX(points.map((pt: { lat: number, lon: number }, i: number) => ({ lat: pt.lat, lon: pt.lon, name: `Point ${i+1}` })));
                const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'itinerary.gpx';
                a.click();
                URL.revokeObjectURL(url);
                setShowExportModal(false);
              }}
            >
              <span class="font-bold text-sm sm:text-xl">GPX</span>
            </button>
            {/* KML Button */}
            <button
              class="btn btn-circle btn-md sm:btn-lg btn-accent tooltip w-12 h-12 sm:w-16 sm:h-16"
              aria-label="Export as KML"
              data-tip="Export as KML"
              disabled={exportLoading()}
              onClick={async () => {
                const points = detailedRoute() || await fetchDetailedRoute();
                if (!points) return;
                const kml = generateKML(points.map((pt: { lat: number, lon: number }, i: number) => ({ lat: pt.lat, lon: pt.lon, name: `Point ${i+1}` })));
                const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'itinerary.kml';
                a.click();
                URL.revokeObjectURL(url);
                setShowExportModal(false);
              }}
            >
              <span class="font-bold text-sm sm:text-xl">KML</span>
            </button>
            {/* Google Maps Button */}
            <button
              class="btn btn-circle btn-md sm:btn-lg btn-info tooltip w-12 h-12 sm:w-16 sm:h-16"
              aria-label="Share to Google Maps"
              data-tip="Share to Google Maps"
              onClick={() => { openGoogleMaps(); setShowExportModal(false); }}
            >
              {/* Fallback: map marker icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 sm:w-8 sm:h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 21.75c-4.5-6-7.5-9.75-7.5-13.125A7.5 7.5 0 0112 1.125a7.5 7.5 0 017.5 7.5c0 3.375-3 7.125-7.5 13.125z" />
                <circle cx="12" cy="8.625" r="2.25" />
              </svg>
            </button>
          </div>
          {exportError() && <div class="alert alert-error mt-2 text-xs sm:text-sm">{exportError()}</div>}
          {exportLoading() && <div class="flex items-center gap-2 mt-2 text-xs sm:text-sm"><span class="loading loading-spinner loading-sm sm:loading-md text-info"></span> <span>Loading route...</span></div>}
          <div class="modal-action mt-3 sm:mt-4">
            <form method="dialog">
              <button class="btn btn-sm sm:btn-md" onClick={() => setShowExportModal(false)}>Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" onClick={() => setShowExportModal(false)}>
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
} 