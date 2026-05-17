export const createOrGetFolder = async (accessToken: string, folderName: string) => {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google Drive access expired. Please reconnect in Settings.');
    throw new Error('Failed to search Drive folder');
  }
  const data = await response.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!createRes.ok) throw new Error('Failed to create Drive folder');
  const createData = await createRes.json();
  return createData.id;
};

export const uploadToGoogleDrive = async (accessToken: string, folderId: string, base64Data: string, fileName: string, mimeType: string) => {
  const metadata = { name: fileName, parents: [folderId] };
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  const fileData = Uint8Array.from(atob(base64Data.split(',')[1]), c => c.charCodeAt(0));
  const fileBlob = new Blob([fileData], { type: mimeType });

  const form = new FormData();
  form.append('metadata', metadataBlob);
  form.append('file', fileBlob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google Drive access expired. Please reconnect in Settings.');
    throw new Error('Failed to upload file to Google Drive');
  }
  return response.json();
};
