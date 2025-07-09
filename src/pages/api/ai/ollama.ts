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

  return `Suggest a short idea for a motorcycle ride${durationText ? ' (' + durationText + ')' : ''} around ${place}${featuresText ? ', passing by ' + featuresText : ''}${avoidText ? ', avoiding ' + avoidText : ''}${styleText ? ', style ' + styleText : ''}${roundTripText}. The answer must be ONLY a valid JSON array (no markdown, no explanation, no code block, just the JSON array): ["City or Town Name", ...]. List only the main cities or towns to link in order (no roads, forests, or other features), as this will be used to generate a GPX file. Do not include coordinates. ${langInstruction}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { mode = 'form' } = body;
    let prompt = '';
    let langInstruction = '';
    if (body.lang === 'fr') langInstruction = 'Answer in French.';
    else if (body.lang === 'es') langInstruction = 'Answer in Spanish.';
    else if (body.lang === 'jp') langInstruction = 'Answer in Japanese.';
    else langInstruction = 'Answer in English.';

    if (mode === 'natural-convo') {
      const { history, itinerary, message, lang } = body;
      // Build a conversational prompt with advanced trip planning instructions
      let langInstruction = '';
      if (lang === 'fr') langInstruction = 'Réponds en français.';
      else if (lang === 'es') langInstruction = 'Responde en español.';
      else if (lang === 'jp') langInstruction = '日本語で答えてください。';
      else langInstruction = 'Answer in English.';
      const convo = (history || []).map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
      const itineraryText = Array.isArray(itinerary) && itinerary.length > 0 ? `The current itinerary is: [${itinerary.map((c: string) => '"' + c + '"').join(', ')}].` : '';
      prompt = `You are an expert motorcycle road trip planner.\n
Your goal is to generate logical, enjoyable, and smooth motorcycle loops of 150-200 km, lasting 3-4 hours (excluding breaks), starting and ending at the same city. Prioritize twisty, mountain, and scenic roads. Integrate as many accessible mountain passes (e.g., Semnoz, Forclaz, etc.) as possible. Avoid highways, long straight national roads, and dense urban areas. Never repeat the same road unless absolutely necessary. Avoid illogical loops or U-turns. Favor routes with a good sequence of curves and little traffic.\n
${itineraryText}\n${convo}\nUser: ${message}\n
Suggest multiple (at least 2) different itineraries, and for each, present the pros and cons.\n
For each itinerary, at the end of your answer, output ONLY the list of main cities or towns to pass through, in order, as a valid JSON array (no markdown, no explanation, no code block, just the JSON array), clearly marked as 'Cities for itinerary 1:' and 'Cities for itinerary 2:' etc.\n${langInstruction}`;
    } else if (mode === 'nlp-convo') {
      const { history, itinerary, message, lang } = body;
      // Build a conversational prompt
      let langInstruction = '';
      if (lang === 'fr') langInstruction = 'Answer in French.';
      else if (lang === 'es') langInstruction = 'Answer in Spanish.';
      else if (lang === 'jp') langInstruction = 'Answer in Japanese.';
      else langInstruction = 'Answer in English.';
      const convo = (history || []).map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
      const itineraryText = Array.isArray(itinerary) && itinerary.length > 0 ? `The current itinerary is: [${itinerary.map((c: string) => '"' + c + '"').join(', ')}].` : '';
      prompt = `You are a motorcycle trip planner.\n${itineraryText}\n${convo}\nUser: ${message}\n${langInstruction}\nReturn ONLY the new itinerary as a JSON array of city or town names, no explanation, no markdown, no code block.`;
    } else if (mode === 'nlp') {
      const { question, lang } = body;
      if (!question) {
        return new Response(JSON.stringify({ error: 'Missing question' }), { status: 400 });
      }
      // System instruction for consistent output
      prompt = `You are a motorcycle trip planner. ${question.trim()}\nThe answer must be ONLY a valid JSON array (no markdown, no explanation, no code block, just the JSON array): [\"City or Town Name\", ...]. List only the main cities or towns to link in order (no roads, forests, or other features), as this will be used to generate a GPX file. Do not include coordinates.\n${langInstruction}`;
    } else {
      const { place, days, hours, features, avoid, style, lang, roundTrip } = body;
      if (!place || (!days && !hours)) {
        return new Response(JSON.stringify({ error: 'Missing place or duration' }), { status: 400 });
      }
      prompt = buildPrompt({ place, days, hours, features, avoid, style, lang, roundTrip });
    }
    console.log(prompt);
    const ollamaIp = import.meta.env.PUBLIC_OLLAMA_IP;
    const ollamaPort = import.meta.env.PUBLIC_OLLAMA_PORT;
    const ollamaModel = import.meta.env.PUBLIC_OLLAMA_MODEL;
    const ollamaRes = await fetch(`http://${ollamaIp}:${ollamaPort}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
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