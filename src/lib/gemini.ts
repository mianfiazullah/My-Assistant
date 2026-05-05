import { safeFetchJson } from './safeFetch';

export async function extractBillData(base64Image: string) {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }

  console.log(`Extracting bill data via backend proxy. Image data length: ${base64Data.length}`);

  const response = await fetch('/api/extract-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data })
  });

  if (!response.ok) {
    const errorData = await safeFetchJson(response).catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.statusText}`);
  }

  return safeFetchJson(response);
}
