export async function extractBillData(base64Image: string) {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }

  console.log(`Extracting bill data via API Proxy. Image data length: ${base64Data.length}`);

  try {
    const response = await fetch('/api/extract-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract bill data from server");
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(error.message || "Failed to extract bill data");
  }
}

export async function chatWithGemini(input: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get chat response");
    }
    
    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    throw new Error(error.message || "Failed to get chat response");
  }
}

export async function generateGeminiContent(prompt: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate content");
    }
    
    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
}

