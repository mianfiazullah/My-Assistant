
export async function safeFetchJson(response: Response) {
  const text = await response.text();
  if (!text || text === 'undefined' || text === 'null') {
    if (!response.ok) {
      throw new Error(`Server returned empty response with status ${response.status}`);
    }
    return {};
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw response:", text.substring(0, 500));
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status} and malformed JSON`);
    }
    throw new Error("Failed to parse server response as JSON");
  }
}
