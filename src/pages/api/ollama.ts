import type { APIRoute } from 'astro';

const featureLabels: Record<string, string> = {
  mountains: 'mountains', lakes: 'lakes', ocean: 'ocean', forest: 'forest', city: 'city',
};
const avoidLabels: Record<string, string> = {
  highway: 'highways', toll: 'toll roads', ferry: 'ferries', gravel: 'gravel',
};
const styleLabels: Record<string, string> = {
  chill: 'chill', normal: 'normal', fast: 'fast boy',
};

function buildPrompt({ place, days, hours, features, avoid, style, lang, roundTrip }: any) {
  let durationText = '';
  if (days && hours) durationText = `${days} days and ${hours} hours`;
  else if (days) durationText = `${days} days`;
  else if (hours) durationText = `${hours} hours`;
  else durationText = '';
  const featuresText = features?.length ? `${features.map((f: string) => featureLabels[f] || f).join(', ')}` : '';
  const avoidText = avoid?.length ? `${avoid.map((a: string) => avoidLabels[a] || a).join(', ')}` : '';
  const styleText = style ? styleLabels[style] || style : '';
  let roundTripText = '';
  if (roundTrip === false) roundTripText = ' for a one-way trip';
  else if (roundTrip === true) roundTripText = ' for a round trip';
  let langInstruction = '';
  if (lang === 'fr') langInstruction = 'Answer in French.';
  else if (lang === 'es') langInstruction = 'Answer in Spanish.';
  else if (lang === 'jp') langInstruction = 'Answer in Japanese.';
  else langInstruction = 'Answer in English.';

  return `Suggest a short idea for a motorcycle ride${durationText ? ' (' + durationText + ')' : ''} around ${place}${featuresText ? ', passing by ' + featuresText : ''}${avoidText ? ', avoiding ' + avoidText : ''}${styleText ? ', style ' + styleText : ''}${roundTripText}. The answer must be short, in the desired language, and must list the main roads and cities to link in order, as this will be used to generate a GPX file later. ${langInstruction}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { place, days, hours, features, avoid, style, lang, roundTrip } = await request.json();
    if (!place || (!days && !hours)) {
      return new Response(JSON.stringify({ error: 'Missing place or duration' }), { status: 400 });
    }
    const prompt = buildPrompt({ place, days, hours, features, avoid, style, lang, roundTrip });
    console.log('[OLLAMA PROMPT]', prompt); // Debug log
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi4',
        prompt,
        stream: true
      })
    });
    if (!ollamaRes.ok || !ollamaRes.body) {
      const errorText = await ollamaRes.text();
      return new Response(JSON.stringify({ error: errorText }), { status: 500 });
    }
    // Stream Ollama's response to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Ollama streams JSON lines: { response: "..." }
          for (const line of chunk.split('\n')) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  fullText += json.response;
                  controller.enqueue(json.response);
                }
              } catch {}
            }
          }
        }
        controller.close();
      }
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}; 