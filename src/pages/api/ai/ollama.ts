import type { APIRoute } from 'astro';
import { createPromptHistory, updatePromptHistory } from '@/lib/services/promptsHistoryServices';

const featureLabels: Record<string, string> = {
  mountains: 'mountains',
  lakes: 'lakes',
  ocean: 'ocean',
  forest: 'forest',
  city: 'city',
};

const avoidLabels: Record<string, string> = {
  highway: 'highways',
  toll: 'toll roads',
  ferry: 'ferries',
  gravel: 'gravel',
};

const styleLabels: Record<string, string> = {
  chill: 'chill',
  normal: 'normal',
  fast: 'fast boy',
};

function buildPrompt({ place, days, hours, features, avoid, style, langInstruction, roundTrip }: any) {
  let durationText = '';
  if (days && hours) durationText = `${days} days and ${hours} hours`;
  else if (days) durationText = `${days} days`;
  else if (hours) durationText = `${hours} hours`;
  else durationText = '';

  const featuresText = features?.length ? `${features.map((f: string) => featureLabels[f] || f).join(', ')}` : '';
  const avoidText = avoid?.length ? `${avoid.map((a: string) => avoidLabels[a] || a).join(', ')}` : '';
  const styleText = style ? styleLabels[style] || style : '';
  const roundTripText = roundTrip === false ? 'one-way trip' : 'round trip';

  return `
You are an expert motorcycle road trip planner.

Generate a ${roundTripText} motorcycle ride from ${place}${durationText ? ' lasting ' + durationText : ''}${featuresText ? ', passing by ' + featuresText : ''}${avoidText ? ', avoiding ' + avoidText : ''}${styleText ? ', in a ' + styleText + ' style' : ''}.

Constraints:
- Never pass twice on the same road unless absolutely necessary.
- Avoid highways, long straight roads, tolls, ferries, and dense urban zones.
- Prioritize twisty roads, mountain passes, panoramic routes, forest roads, and alpine scenery.
- Make the trip logical and enjoyable for a motorcyclist: curves, elevation changes, scenic variety.
- Ensure the route is realistically adapted to the specified duration or distance. Do not include faraway cities that would be inconsistent with the ride time.

Output ONLY a valid JSON array of the main cities or towns to pass through (no markdown, no explanation, no code block): ["City1", "City2", "City3", ...].

${langInstruction}
`.trim();
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { mode = 'form' } = body;
    let prompt = '';
    let langInstruction = '';
    let userInput = '';

    // Check if user is authenticated for saving history
    const userId = locals.sb_user?.id;

    if (body.lang === 'fr') langInstruction = 'Answer in French.';
    else if (body.lang === 'es') langInstruction = 'Answer in Spanish.';
    else if (body.lang === 'jp') langInstruction = 'Answer in Japanese.';
    else langInstruction = 'Answer in English.';

    if (mode === 'natural-convo') {
      const { history, itinerary, message } = body;
      userInput = message || '';
      const convo = (history || []).map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
      const itineraryText = Array.isArray(itinerary) && itinerary.length > 0
        ? `The current itinerary is: [${itinerary.map((c: string) => '"' + c + '"').join(', ')}].`
        : '';
      prompt = `
You are an expert motorcycle road trip planner.

Your goal is to generate logical, enjoyable, and smooth motorcycle loops, or one-way rides when specified.

Constraints:
- Never pass twice on the same road unless absolutely necessary.
- Avoid highways, long straight national roads, tolls, ferries, and dense urban areas.
- Prioritize twisty roads, mountain passes, panoramic routes, forest roads, and alpine scenery.
- Make the trip logical and enjoyable for a motorcyclist: curves, elevation changes, and scenic variety.
- Ensure the itinerary matches the requested time or distance realistically. Avoid faraway cities that would not fit the expected duration.

${itineraryText}

${convo}

User: ${message}

Suggest 2 different itineraries, and for each, present the pros and cons.

At the end of your answer, output ONLY the list of main cities or towns to pass through for each itinerary, in order, as a valid JSON array (no markdown, no explanation, no code block), clearly marked as:
Cities for itinerary 1: ["...", "..."]
Cities for itinerary 2: ["...", "..."]

${langInstruction}
`.trim();
    } else if (mode === 'form') {
      const { place, days, hours, features, avoid, style, roundTrip } = body;
      if (!place || (!days && !hours)) {
        return new Response(JSON.stringify({ error: 'Missing place or duration' }), { status: 400 });
      }
      userInput = `Place: ${place}, Days: ${days || 0}, Hours: ${hours || 0}, Features: ${features?.join(', ') || 'none'}, Avoid: ${avoid?.join(', ') || 'none'}, Style: ${style || 'normal'}, Round trip: ${roundTrip !== false}`;
      prompt = buildPrompt({ place, days, hours, features, avoid, style, langInstruction, roundTrip });
    }

    console.log(prompt);

    // Save prompt history if user is authenticated
    let promptHistoryId: number | null = null;
    if (userId) {
      try {
        const promptHistory = await createPromptHistory({
          prompt,
          user_input: userInput,
          user_id: userId,
          answer: null // Will be updated later with the response
        });
        promptHistoryId = promptHistory?.id || null;
      } catch (error) {
        console.error('Failed to save prompt history:', error);
        // Continue with the request even if saving fails
      }
    }

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

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  fullText += json.response;
                  controller.enqueue(json.response);
                }
              } catch { }
            }
          }
        }
        
        // Update prompt history with the complete response if we have a history record
        if (userId && promptHistoryId) {
          try {
            await updatePromptHistory(promptHistoryId, {
              answer: fullText
            });
          } catch (error) {
            console.error('Failed to update prompt history with response:', error);
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
