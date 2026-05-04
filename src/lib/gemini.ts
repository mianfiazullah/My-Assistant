export async function extractBillData(base64Image: string) {
  const model = "gemini-3-flash-preview";
  
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }
  console.log(`Extracting bill data using backend. Image data length: ${base64Data.length} characters.`);

  const response = await fetch('/api/extract-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, model })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Backend error: ${errorData.error || response.statusText}`);
  }

  return response.json();
}
