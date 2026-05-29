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

export const createOrGetSpreadsheet = async (accessToken: string, folderId: string, sheetName: string) => {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and '${folderId}' in parents and trashed=false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google Drive access expired. Please reconnect in Settings.');
    throw new Error('Failed to search Spreadsheet');
  }
  const data = await response.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: sheetName, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folderId] }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error('Failed to create Spreadsheet: ' + errText);
  }
  const createData = await createRes.json();
  return createData.id;
};

export const appendRowToSpreadsheet = async (accessToken: string, spreadsheetId: string, headers: string[], row: any[]) => {
  const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:ZZ1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!getRes.ok) {
    const errText = await getRes.text();
    throw new Error('Failed to read Spreadsheet headers: ' + errText);
  }
  const getData = await getRes.json();
  const hasHeaders = getData.values && getData.values.length > 0 && getData.values[0].length > 0;

  const valuesToAppend = [];
  if (!hasHeaders) {
    valuesToAppend.push(headers);
  }
  valuesToAppend.push(row);

  const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: valuesToAppend
    })
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    throw new Error('Failed to append to Spreadsheet: ' + errText);
  }
  return await appendRes.json();
};

export const listFilesFromGoogleDrive = async (accessToken: string, folderId: string) => {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,createdTime,webContentLink,webViewLink,thumbnailLink)&orderBy=createdTime desc`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google Drive access expired. Please reconnect in Settings.');
    throw new Error('Failed to list Drive files');
  }
  const data = await response.json();
  return data.files || [];
};

export const deleteFileFromGoogleDrive = async (accessToken: string, fileId: string) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('Google Drive Delete Error:', response.status, errorBody);
    if (response.status === 401) throw new Error('Google Drive access expired. Please reconnect.');
    throw new Error(`Failed to delete Drive file: ${errorBody.error?.message || response.statusText || 'Unknown error'}`);
  }
  return true;
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
