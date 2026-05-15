export interface FeederReading {
  id: string;
  feederName: string;
  reading: number;
  date: string; // ISO format
  userId: string;
  tentative?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  expiryDate: string;
  subDivision?: string;
}

export interface MonthWiseUnit {
  month: string;
  units: number | string;
  bill?: number | string;
  adj?: string | number;
  payment?: number | string;
  reading?: string | number;
}

export interface BillData {
  consumerName: string;
  address: string;
  referenceNumber: string;
  unitsConsumed: number;
  amountDue: number;
  billingMonth: string;
  sanctionedLoad: string;
  connectionType: string;
  customerId?: string;
  tariff?: string;
  currentBill?: number;
  deferredAmount?: number;
  monthWiseUnitsConsumed?: string;
  monthWiseUnits?: MonthWiseUnit[];
  presentReading?: string;
  previousReading?: string;
  difference?: string;
  meterNoOnBill?: string;
  subDivisionName?: string;
  feederName?: string;
  meterStatus?: string;
}

export interface LoadItem {
  name: string;
  qty: string | number;
  watts: string | number;
  total: string | number;
}

export interface DetectionCase {
  id: string;
  userId: string;
  employeeName: string;
  employeeDesignation: string;
  photoUrl: string;
  billData: BillData;
  dateOfChecking: string;
  detectionDate: string;
  discrepancy: string[];
  othersDiscrepancy?: string;
  checkedBy: string[];
  meterType: string;
  capacity: string;
  meterStatus?: string;
  presentReading: string;
  presentReadingAtSite?: string;
  previousReading: string;
  difference: string;
  email: string;
  mobileNo: string;
  meterMake: string;
  meterNumber: string;
  name: string;
  address: string;
  sanctionLoad: string;
  connectedLoad: string;
  loadFactor: string;
  customerId: string;
  tariff: string;
  witnesses: string[];
  remarks: string;
  createdAt: string;
  updatedAt?: string;
  firNumber: string;
  billingMonth?: string;
  noticeNo?: string;
  noticeDated?: string;
  firNo?: string;
  firDated?: string;
  referenceNumber: string;
  registeredFirNo?: string;
  registeredFirDated?: string;
  policeStation?: string;
  noOfAC?: string;
  splitAcCount?: string;
  windowAcCount?: string;
  acType?: 'Split' | 'Window' | 'Others' | string;
  othersAcType?: string;
  othersCheckedBy?: string;
  detectionPeriodFrom?: string;
  detectionPeriodTo?: string;
  detectionPeriodMonths?: string;
  acPeriodFrom?: string;
  acPeriodTo?: string;
  acPeriodMonths?: string;
  unitsOfAcPeriod?: string;
  unitsAssessed?: string;
  unitsAlreadyCharged?: string;
  netUnitsToBeCharged?: string;
  feederName?: string;
  meterSlowBy?: string;
  employeeCnic?: string;
  employeeMobile?: string;
  loadItems?: LoadItem[];
  lossAmount?: string;
  seizureCableSize?: string;
  seizureCableColor?: string;
  seizureCableLength?: string;
  nameUrdu?: string;
  addressUrdu?: string;
  employeeNameUrdu?: string;
  presentOccupier?: string;
  presentOccupierUrdu?: string;
}
