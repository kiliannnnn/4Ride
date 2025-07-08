export type lang = 'en' | 'fr' | 'es' | 'jp';

export const askOllamaUi = {
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

export const FEATURES = [
    { key: 'mountains', label: { en: 'Mountains', fr: 'Montagnes', es: 'Montañas', jp: '山' } },
    { key: 'lakes', label: { en: 'Lakes', fr: 'Lacs', es: 'Lagos', jp: '湖' } },
    { key: 'ocean', label: { en: 'Ocean', fr: 'Océan', es: 'Océano', jp: '海' } },
    { key: 'forest', label: { en: 'Forest', fr: 'Forêt', es: 'Bosque', jp: '森' } },
    { key: 'city', label: { en: 'City', fr: 'Ville', es: 'Ciudad', jp: '都市' } },
];
export const AVOID = [
    { key: 'highway', label: { en: 'Highway', fr: 'Autoroute', es: 'Autopista', jp: '高速道路' } },
    { key: 'toll', label: { en: 'Toll', fr: 'Péage', es: 'Peaje', jp: '有料道路' } },
    { key: 'ferry', label: { en: 'Ferry', fr: 'Ferry', es: 'Ferry', jp: 'フェリー' } },
    { key: 'gravel', label: { en: 'Gravel', fr: 'Gravier', es: 'Grava', jp: '砂利' } },
];
export const STYLES = [
    { key: 'chill', label: { en: askOllamaUi.en.chill, fr: askOllamaUi.fr.chill, es: askOllamaUi.es.chill, jp: askOllamaUi.jp.chill } },
    { key: 'normal', label: { en: askOllamaUi.en.normal, fr: askOllamaUi.fr.normal, es: askOllamaUi.es.normal, jp: askOllamaUi.jp.normal } },
    { key: 'fast', label: { en: askOllamaUi.en.fast, fr: askOllamaUi.fr.fast, es: askOllamaUi.es.fast, jp: askOllamaUi.jp.fast } },
];

export function t(lang: lang, key: keyof typeof askOllamaUi['en']) {
    return askOllamaUi[lang]?.[key] || askOllamaUi['en'][key];
}

export function generateGPX(waypoints: { lat: number, lon: number, name: string }[]) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="4Ride" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte>\n    ${waypoints.map(wp => `\n      <rtept lat="${wp.lat}" lon="${wp.lon}">\n        <name>${wp.name}</name>\n      </rtept>`).join('')}\n  </rte>\n</gpx>`;
}

export function generateKML(waypoints: { lat: number, lon: number, name: string }[], name = 'Itinerary') {
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
