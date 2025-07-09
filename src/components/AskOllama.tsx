import { createSignal, onCleanup, createEffect, onMount, Show } from 'solid-js';
import { loadGoogleMaps } from '@/lib/services/googleServices';
import { generateGPX, generateKML } from '@/lib/utils';
import { t, askOllamaUi, FEATURES, AVOID, STYLES } from '@/lib/utils';
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

  // Parse AI answer for waypoints and geocode them (for NLP tab)
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

  return (
    <div class="relative w-full overflow-hidden flex items-center justify-center" style={{ 'min-height': 'calc(100vh - 128px)', height: 'calc(100vh - 128px)' }}>
      {/* Background image */}
      <div class="absolute inset-0 z-0">
        <img src="/assets/images/biker.webp" alt="Background" class="w-full h-full object-cover object-center opacity-50" />
      </div>
      {/* Main card */}
      <div class="overflow-hidden relative z-10 w-full max-w-4xl md:max-w-5xl lg:max-w-6xl p-8 md:p-0 rounded-3xl shadow-2xl bg-base-100/90 backdrop-blur-lg flex flex-col md:flex-row items-start justify-center h-full" style={{ 'max-width': '1100px', 'max-height': '90%' }}>
        <div class="w-full md:w-1/2">
          <div class="tabs tabs-lift w-full">
            <label class="tab cursor-pointer" classList={{'tab-active': activeTab() === 'natural'}}>
              <input type="radio" name="askollama_tabs" checked={activeTab() === 'natural'} onChange={() => setActiveTab('natural')} />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 me-2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
              Natural
            </label>
            <label class="tab cursor-pointer" classList={{'tab-active': activeTab() === 'form'}}>
              <input type="radio" name="askollama_tabs" checked={activeTab() === 'form'} onChange={() => setActiveTab('form')} />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 me-2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg>
              Form
            </label>
          </div>
          <div class="tab-content bg-base-100 border-base-300 p-6 flex flex-col h-[500px] md:h-[600px]" style={{ display: activeTab() === 'natural' ? 'flex' : 'none' }}>
            {/* Current itinerary display */}
            <Show when={availableItineraries().length > 0}>
              <div class="mb-4">
                <div class="font-semibold mb-2 text-lg">Available Itineraries:</div>
                <div class="flex flex-col gap-4">
                  {availableItineraries().map((it, idx) => (
                    <div class={`border rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 transition-all ${selectedItineraryIdx() === idx ? 'border-primary bg-primary/10 shadow-lg' : 'border-base-300 bg-base-200'}`}
                         style={{ cursor: 'pointer' }}
                         onClick={() => {
                           setSelectedItineraryIdx(idx);
                           setItinerary(it.cities);
                         }}>
                      <div class="flex-1">
                        <div class="font-semibold mb-1">{it.label || `Itinerary ${idx + 1}`}</div>
                        <div class="text-xs text-gray-500 mb-1">Route preview:</div>
                        <div class="flex flex-wrap gap-1 text-sm">
                          {it.cities.map((city, i) => (
                            <>
                              <span class="px-2 py-1 bg-base-100 rounded border border-base-300">{city}</span>
                              {i < it.cities.length - 1 && <span class="mx-1 text-primary">→</span>}
                            </>
                          ))}
                        </div>
                      </div>
                      <button class={`btn btn-sm ${selectedItineraryIdx() === idx ? 'btn-primary' : 'btn-outline'}`}>Select</button>
                    </div>
                  ))}
                </div>
                <div class="mt-2 text-xs text-gray-500">Click a box to select and show on map</div>
                <div class="mt-4">
                  <div class="font-semibold mb-1">Current Itinerary:</div>
                  <ol class="list-decimal list-inside text-sm">
                    {itinerary().map((city, i) => <li>{city}</li>)}
                  </ol>
                </div>
              </div>
            </Show>
            {/* Chat messages */}
            <div class="flex-1 overflow-y-auto mb-4 space-y-2 pr-2">
              {chatMessages().map((msg, i) => (
                <div class={msg.role === 'user' ? 'chat chat-end' : 'chat chat-start'}>
                  <div class={msg.role === 'user' ? 'chat-bubble chat-bubble-primary' : 'chat-bubble chat-bubble-secondary'}>
                    {msg.text}
                  </div>
                </div>
              ))}
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
            <form class="flex gap-2 items-end" style={{ 'margin-top': 'auto' }} onSubmit={async e => {
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
                class="input input-bordered w-full"
                placeholder="Type your question..."
                value={naturalInput()}
                onInput={e => setNaturalInput(e.currentTarget.value)}
                disabled={isStreaming()}
                autocomplete="off"
              />
              <button type="submit" class="btn btn-primary" disabled={isStreaming() || !naturalInput().trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
            </form>
            {errorNatural() && <div class="alert alert-error mt-2">{t(lang, 'error')}: {errorNatural()}</div>}
          </div>
          <div class="tab-content bg-base-100 border-base-300 p-6" style={{ display: activeTab() === 'form' ? 'block' : 'none' }}>
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
            }} class="space-y-4">
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
            {errorForm() && <div class="alert alert-error mt-4">{t(lang, 'error')}: {errorForm()}</div>}
            {responseForm() && (
              <div class="alert alert-success mt-4 whitespace-pre-line">
                {t(lang, 'response')}:<br />{responseForm()}
              </div>
            )}
            {parsingForm() && (
              <div class="flex items-center gap-2 mt-4"><span class="loading loading-spinner loading-md text-info"></span> <span>Calculating itinerary...</span></div>
            )}
            {waypoints().length > 0 && !parsingForm() && activeTab() === 'form' && (
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
        </div>
        <div class="w-full md:w-1/2 flex flex-col items-center h-full">
          <div ref={el => (mapRef = el as HTMLDivElement)} class="w-full h-full min-h-[300px]" />
        </div>
      </div>
    </div>
  );
} 