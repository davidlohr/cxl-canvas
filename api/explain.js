// This is a serverless function that acts as a secure proxy to the Gemini API.
// It can be deployed to platforms like Vercel or Netlify.

export default async function handler(request, response) {
  // 1. Check for the secret API key from environment variables.
  //    This is where your API key is kept safe on the server.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // If the key is not found, return an error.
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. We only allow POST requests for security.
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // 3. Get the prompt sent from your frontend application.
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Construct the URL and payload for the actual Google Gemini API call.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    // 5. Forward the request to the Gemini API.
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      // If Google's API returns an error, forward that error back.
      const errorText = await geminiResponse.text();
      console.error("Gemini API Error:", errorText);
      return new Response(JSON.stringify({ error: `Gemini API error: ${geminiResponse.statusText}` }), {
        status: geminiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Send the successful response from the Gemini API back to your frontend.
    const data = await geminiResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Serverless function error:", error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
