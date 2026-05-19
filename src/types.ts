export interface BillData {
  referenceNumber: string;
  consumerName: string;
  address: string;
  billingMonth: string;
  load?: string;
  tariff?: string;
}

export interface DetectionCase {
  id: string;
  userId: string;
  billData: BillData;
  createdAt: string;
  updatedAt?: string;
  status: string;
  firNumber: string;
  registeredFirNo?: string;
  // ... other fields
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}
