import { forwardRef } from 'react';
import { cn } from '../lib/utils';
import { BillData, MonthWiseUnit, LoadItem } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { translateToUrdu } from '../lib/urduUtils';

interface ProformaProps {
  type: 'DETECTION BILL PROFORMA' | 'NOTICE' | 'FIR Request' | 'FIR Urdu' | 'Detection Register';
  data: {
    id: string;
    name: string;
    address: string;
    referenceNumber: string;
    customerId: string;
    tariff: string;
    sanctionLoad: string;
    connectedLoad: string;
    loadFactor: string;
    dateOfChecking: string;
    checkedBy: string | string[];
    meterType: string;
    capacity: string;
    meterMake: string;
    meterNumber: string;
    presentReading: string;
    presentReadingAtSite?: string;
    previousReading: string;
    discrepancy: string[];
    remarks: string;
    mobileNo: string;
    email: string;
    employeeName: string;
    employeeDesignation: string;
    employeeCnic?: string;
    employeeMobile?: string;
    witnesses: string[];
    noticeNo?: string;
    noticeDated?: string;
    firNo?: string;
    firDated?: string;
    registeredFirNo?: string;
    registeredFirDated?: string;
    policeStation?: string;
    noOfAC?: string;
    splitAcCount?: string;
    windowAcCount?: string;
    acType?: 'Split' | 'Window' | 'Others' | string;
    detectionPeriodFrom?: string;
    detectionPeriodTo?: string;
    detectionPeriodMonths?: string;
    unitsAssessed?: string;
    unitsAlreadyCharged?: string;
    netUnitsToBeCharged?: string;
    lossAmount?: string;
    seizureCableSize?: string;
    seizureCableColor?: string;
    seizureCableLength?: string;
    nameUrdu?: string;
    addressUrdu?: string;
    presentOccupier?: string;
    presentOccupierUrdu?: string;
    employeeNameUrdu?: string;
    meterSlowBy?: string;
    acPeriodFrom?: string;
    acPeriodTo?: string;
    acPeriodMonths?: string;
    unitsOfAcPeriod?: string;
    billingMonth?: string;
    photoUrl?: string;
    difference: string;
    monthWiseUnits?: MonthWiseUnit[];
    loadItems?: LoadItem[];
    subDivisionName?: string;
    feederName?: string;
    billData?: BillData;
    meterStatus?: string;
    currentBill?: number;
    deferredAmount?: number;
    meterNoOnBill?: string;
  };
  aiUrduTranslations?: Record<string, string>;
}

export const ProformaTemplates = forwardRef<HTMLDivElement, ProformaProps>(({ type, data, aiUrduTranslations }, ref) => {
  const caseUrl = `${window.location.origin}/cases?id=${data.id}`;
  const isNetPositive = data.netUnitsToBeCharged && !isNaN(Number(data.netUnitsToBeCharged)) && Number(data.netUnitsToBeCharged) >= 0;

  const renderQRCode = () => (
    <div className="flex flex-col items-center gap-1">
      <QRCodeSVG value={caseUrl} size={64} />
      <span className="text-[8px] text-neutral-500">Scan for Details</span>
    </div>
  );
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    } else if (parts.length === 2) {
      if (parts[0].length === 4) {
        return `${parts[1]}-${parts[0]}`;
      }
    }
    return dateString;
  };

  const formatDateToSmall = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const m = date.getMonth() + 1;
      const y = date.getFullYear().toString().slice(-2);
      return `${m}-${y}`;
    }
    // Fallback for custom formats
    const parts = dateString.split(/[- ]/);
    if (parts.length >= 2) {
      return dateString;
    }
    return dateString;
  };

  const formatFeederName = (name?: string) => {
    if (!name) return '';
    // If name starts with a numeric code, wrap it in parentheses
    return name.replace(/^(\d+)\s+/, '($1) ');
  };
  
  const formatDiscrepancies = (discrepancies: string[]) => {
    return discrepancies.map(d => {
      if (d === 'Meter Slow By' && data.meterSlowBy) {
        return `Meter ${data.meterSlowBy} Slow`;
      }
      return d;
    }).join(', ');
  };

  const formatBillLabel = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const str = val.toString().toUpperCase().trim();
    
    // Exact matches or includes for labels
    if (str === 'P-DISC' || str.includes('P-DISC')) {
      return <span className="text-red-600 font-bold">P-DISC</span>;
    }
    if (str === 'MC' || str === 'MCO' || str.includes('MC')) {
      return <span className="text-red-600 font-bold">MCO</span>;
    }
    if (str === 'DF' || str.includes('DF') || str === 'EST. DEF' || str.includes('EST. DEF')) {
      return <span className="text-red-600 font-bold">Est. Def</span>;
    }
    if (str === 'SS' || str.includes('SS')) {
      return <span className="text-red-600 font-bold">SS</span>;
    }
    if (str === 'NC' || str === 'NEW CONNECTION' || str.includes('NC') || str.includes('NEW CONNECTION')) {
      return <span className="text-red-600 font-bold">New Connection</span>;
    }
    if (str === 'RC' || str === 'RCO' || str.includes('RC') || str.includes('RCO')) {
      return <span className="text-red-600 font-bold">RCO</span>;
    }
    if (str === 'EX' || str.includes('EX')) {
        return <span className="text-red-600 font-bold">EX</span>;
    }
    
    return val;
  };

  const getCalculatedReadings = () => {
    const readingsMap: Record<string, number> = {};
    if (!data.billingMonth) return readingsMap;

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const billingParts = data.billingMonth.toUpperCase().split(/[- ]+/).filter(Boolean);
    if (billingParts.length < 2) return readingsMap;

    const startMonthName = billingParts[0].substring(0, 3);
    const startYearStr = billingParts[1].length === 4 ? billingParts[1].slice(-2) : billingParts[1];
    const startMonthIndex = months.indexOf(startMonthName);
    const startYear = parseInt(startYearStr);

    if (startMonthIndex === -1 || isNaN(startYear)) return readingsMap;

    const getUnitsData = (m: string, y: string) => {
      // Find units in data.monthWiseUnits
      const u = (data.monthWiseUnits || []).find(item => {
        if (!item.month) return false;
        let s = item.month.trim().toUpperCase();
        let mMatch = s.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
        let numMMatch = !mMatch ? s.match(/^0?([1-9]|1[0-2])[-/]/) : null;
        let yMatch = s.match(/(20[2-9][0-9]|[2-9][0-9])/);
        
        const numberToMonth: Record<string, string> = {
          "1": "JAN", "2": "FEB", "3": "MAR",
          "4": "APR", "5": "MAY", "6": "JUN",
          "7": "JUL", "8": "AUG", "9": "SEP",
          "10": "OCT", "11": "NOV", "12": "DEC"
         };
        
        let uMonth = mMatch ? mMatch[1] : (numMMatch ? numberToMonth[numMMatch[1]] : null);
        let uYear = yMatch ? yMatch[1].slice(-2) : null;
        
        return uMonth === m && uYear === y.slice(-2);
      });
      
      const checkStopLabel = (val: any) => {
        if (!val) return false;
        const s = val.toString().toUpperCase();
        // Stop on MCO, MC, Est.Def, RCO, RC
        return s.includes('MCO') || s.includes('MC') || s.includes('EST. DEF') || s.includes('EST.DEF') || s.includes('DF') || s.includes('RCO') || s.includes('RC');
      };

      if (u) {
        const unitsStr = u.units?.toString().toUpperCase() || '0';
        const readingStr = u.reading?.toString().toUpperCase() || '';
        
        // Ignore words like DF, EX, MC, MCO, SS when calculating
        const units = parseInt(unitsStr.replace(/,/g, '').replace(/EST\.?\s*DEF\.?/g, '').replace(/DF/g, '').replace(/EX/g, '').replace(/MCO?/g, '').replace(/SS/g, '') || '0') || 0;
        
        // Stop calculation if Reading cell or units cell has status labels
        const hasStopLabel = checkStopLabel(readingStr) || checkStopLabel(unitsStr);
        
        return { units, exists: true, hasStopLabel };
      }
      
      // If none found in monthWiseUnits, check if it matches the current billing month's difference
      if (m === startMonthName && (y === startYearStr || y === `20${startYearStr}`)) {
        const valStr = data.difference?.toString().toUpperCase() || '0';
        const presReadingStr = data.presentReading?.toString().toUpperCase() || '';
        const units = parseInt(valStr.replace(/,/g, '').replace(/EST\.?\s*DEF\.?/g, '').replace(/DF/g, '').replace(/EX/g, '').replace(/MCO?/g, '').replace(/SS/g, '') || '0') || 0;
        const hasStopLabel = checkStopLabel(presReadingStr) || checkStopLabel(valStr);
        return { units, exists: true, hasStopLabel };
      }
      
      return { units: 0, exists: false, hasStopLabel: false };
    };

    const startReadingStr = data.presentReading?.toString().toUpperCase() || '';
    const checkStopLabel = (val: string) => {
      return val.includes('MCO') || val.includes('MC') || val.includes('EST. DEF') || val.includes('EST.DEF') || val.includes('DF') || val.includes('RCO') || val.includes('RC');
    };
    const hasStartStopLabel = checkStopLabel(startReadingStr);

    const startReading = parseInt(startReadingStr.replace(/,/g, '').replace(/DF/g, '').replace(/EX/g, '').replace(/MCO?/g, '').replace(/SS/ig, '') || '0') || 0;
    readingsMap[`${months[startMonthIndex]} ${startYear}`] = startReading;

    // Backward calculation
    let tempReading = startReading;
    let bMonth = startMonthIndex;
    let bYear = startYear;
    
    // If the meter is replaced, the prior units belong to the old meter or a mix,
    // so subtracting them from the new meter's present reading yields incorrect previous readings.
    if (!data.meterStatus?.toUpperCase()?.includes('REPLACED') && !hasStartStopLabel) {
      const isPresentDF = data.presentReading?.toString().toUpperCase().includes('DF');
      for (let i = 0; i < 48; i++) {
        const { units, exists, hasStopLabel } = getUnitsData(months[bMonth], bYear.toString());
        if (!exists || hasStopLabel) break; // STOP if label found in current month going backward
        
        let prevReading = tempReading - units;
        if (prevReading < 0) prevReading = 0;
        
        bMonth--;
        if (bMonth < 0) {
          bMonth = 11;
          bYear--;
        }
        if (bYear < 23) break;

        // If present reading was DF, or any month in between was DF, the derived reading is questionable
        // But for calculation purposes we keep it, however in getReadingVal we will check for DF
        readingsMap[`${months[bMonth]} ${bYear}`] = isPresentDF && i === 0 ? -1 : prevReading;
        tempReading = prevReading;
      }
    }

    // Forward calculation
    tempReading = startReading;
    let fMonth = startMonthIndex;
    let fYear = startYear;
    for (let i = 0; i < 48; i++) {
      // Check if current month in forward loop should stop (e.g. forward from a month that was capped)
      const currentMonthData = getUnitsData(months[fMonth], fYear.toString());
      if (currentMonthData.hasStopLabel && i > 0) break; 

      // To get the reading for next month (fMonth + 1), we need units for THAT next month
      let nextMonthIndex = fMonth + 1;
      let nextYearValue = fYear;
      if (nextMonthIndex > 11) {
        nextMonthIndex = 0;
        nextYearValue++;
      }
      
      const { units, exists, hasStopLabel } = getUnitsData(months[nextMonthIndex], nextYearValue.toString());
      if (!exists || hasStopLabel) break; // STOP if next month has label
      
      const nextReadingValue = Math.max(0, tempReading + units);
      
      fMonth = nextMonthIndex;
      fYear = nextYearValue;
      if (fYear > 27) break;

      readingsMap[`${months[fMonth]} ${fYear}`] = nextReadingValue;
      tempReading = nextReadingValue;
    }

    return readingsMap;
  };

  const calculatedReadings = getCalculatedReadings();

  const renderDetectionBill = () => (
    <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[10px] md:text-[11px] leading-tight p-6 md:p-[20mm]">
      <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
        <div className="text-center flex-1">
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">DETECTION BILL PROFORMA</h1>
          <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
          <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
          <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
          <p className="font-bold text-[9px] flex items-center justify-center gap-1">
            <span className="text-xs">☎</span> <span dir="ltr">049-2382776</span>
          </p>
        </div>
        {renderQRCode()}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Reference No. : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.referenceNumber}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Customer I.D : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.customerId}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Tariff : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.tariff}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Sanctioned Load : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.sanctionLoad}{data.sanctionLoad && !data.sanctionLoad.toString().toUpperCase().includes('KW') ? '-KW' : ''}</span></div>
        </div>
        <div className="flex gap-3 items-start font-bold">
          <span className="whitespace-nowrap">Consumer Name & Address : -</span>
          <span className="border-b border-black text-black inline">{data.name}, {data.address}</span>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Date of checking : -</span><span className="border-b border-black whitespace-nowrap text-black">{formatDate(data.dateOfChecking)}</span></div>
          <div className="flex gap-3 items-end font-bold min-w-0">
            <span className="whitespace-nowrap">Checked by : -</span>
            <span className="border-b border-black text-black whitespace-nowrap">
              {Array.isArray(data.checkedBy) && data.checkedBy.length > 0 ? data.checkedBy.join(', ') : (typeof data.checkedBy === 'string' && data.checkedBy ? data.checkedBy : '____________________')}
            </span>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <span className="whitespace-nowrap font-bold">Discrepancy : -</span>
          <span className={cn("border-b border-black font-bold inline", formatDiscrepancies(data.discrepancy).toUpperCase().includes('REPLACED') ? "text-red-600" : "text-black")}>{formatDiscrepancies(data.discrepancy)}</span>
        </div>
        <div className="flex justify-between gap-1 text-[8pt]">
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase">Present Reading:</span><span className="border-b border-black whitespace-nowrap text-black">{formatBillLabel(data.presentReadingAtSite)}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase">Meter No:</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterNumber}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase">Make:</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterMake}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase">Type:</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterType}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase">Capacity:</span><span className="border-b border-black whitespace-nowrap text-black">{data.capacity}</span></div>
        </div>
        <div className="flex justify-between gap-1 text-[7pt]">
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase text-[7.5pt]">Meter Status:</span><span className={cn("border-b border-black whitespace-nowrap text-black", (data.meterStatus?.toUpperCase()?.includes('REPLACED') || data.meterStatus?.toUpperCase() === 'DF') ? "text-red-600" : "text-black")}>{formatBillLabel(data.meterStatus)}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase text-[7.5pt]">Notice No:</span><span className="border-b border-black whitespace-nowrap text-black">{data.noticeNo || '۔۔۔۔۔۔۔۔'}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap uppercase text-[7.5pt]">Dated:</span><span className="border-b border-black whitespace-nowrap text-black">{formatDate(data.noticeDated) || '۔۔۔۔۔۔۔۔۔۔۔۔'}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold overflow-hidden"><span className="whitespace-nowrap uppercase text-[7.5pt]">FIR T/O No:</span><span className="border-b border-black whitespace-nowrap text-black overflow-hidden text-ellipsis">{data.firNo || '۔۔۔۔۔۔۔۔'}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold overflow-hidden"><span className="whitespace-nowrap uppercase text-[7.5pt]">FIR T/O Dated:</span><span className="border-b border-black whitespace-nowrap text-black overflow-hidden text-ellipsis">{formatDate(data.firDated) || '۔۔۔۔۔۔۔۔۔۔۔۔'}</span></div>
        </div>
        <div className="flex justify-between gap-1 text-[7pt]">
          <div className={cn("flex gap-1 items-end min-w-0 font-bold", !data.registeredFirNo ? "text-red-600 font-bold" : "text-black")}>
            <span className="whitespace-nowrap uppercase text-[7.5pt]">Registered FIR No:</span>
            <span className="border-b border-black whitespace-nowrap">{data.registeredFirNo || "(FIR PENDING)"}</span>
          </div>
          <div className={cn("flex gap-1 items-end min-w-0 font-bold", !data.registeredFirNo ? "text-red-600 font-bold" : "text-black")}>
            <span className="whitespace-nowrap uppercase text-[7.5pt]">Dated:</span>
            <span className="border-b border-black whitespace-nowrap">{data.registeredFirNo ? (formatDate(data.registeredFirDated) || '۔۔۔۔۔۔۔۔۔۔۔۔') : "(FIR PENDING)"}</span>
          </div>
          <div className={cn("flex gap-1 items-end min-w-0 font-bold overflow-hidden", !data.registeredFirNo ? "text-red-600 font-bold" : "text-black")}>
            <span className="whitespace-nowrap uppercase text-[7.5pt]">Name Of Police Station:</span>
            <span className="border-b border-black overflow-hidden text-ellipsis whitespace-nowrap">{(data.firNo && !data.registeredFirNo) ? (data.policeStation || '____________________') : (data.policeStation || '۔۔۔۔۔۔۔۔۔۔۔۔')}</span>
          </div>
        </div>
        <div className="flex justify-between gap-4">
          {data.noOfAC && parseInt(data.noOfAC) > 0 ? (
            <div className="flex gap-3 items-end">
              <span className="whitespace-nowrap font-bold">NO of AC : -</span>
              <span className="border-b border-black whitespace-nowrap text-black font-bold">
                {data.noOfAC} {parseInt(data.noOfAC || '0') === 1 ? 'No.' : 'Nos.'} 
                {(() => {
                  const split = parseInt(data.splitAcCount || '0');
                  const window = parseInt(data.windowAcCount || '0');
                  const parts = [];
                  if (split > 0) parts.push(`${split} ${split === 1 ? 'No.' : 'Nos.'} Split`);
                  if (window > 0) parts.push(`${window} ${window === 1 ? 'No.' : 'Nos.'} Window`);
                  if (parts.length > 0) return ` ( ${parts.join(' + ')} )`;
                  return data.acType && data.acType !== 'Blank' ? ` (${data.acType})` : '';
                })()}
              </span>
            </div>
          ) : <div />}
          <div className="flex gap-3 items-end"><span className="whitespace-nowrap font-bold">Detection Bill Period : -</span><span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{formatDate(data.detectionPeriodFrom)}</span> To <span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{formatDate(data.detectionPeriodTo)}</span> <span className="font-bold">(<span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{data.detectionPeriodMonths}</span> Months)</span></div>
        </div>
        {data.noOfAC && parseInt(data.noOfAC) > 0 && (data.acPeriodFrom || data.acPeriodTo) && (
          <div className="flex justify-between gap-4">
            <div className="flex gap-3 items-end">
              <span className="whitespace-nowrap font-bold">AC Period : -</span>
              <span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{formatDate(data.acPeriodFrom)}</span> To <span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{formatDate(data.acPeriodTo)}</span> <span className="font-bold">(<span className="border-b border-black text-center whitespace-nowrap text-black font-bold">{data.acPeriodMonths}</span> Months)</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="font-bold text-center mb-1 text-[11px] font-sans">CONSUMPTION DATA</h3>
        <table className="w-full border-collapse border border-black text-center text-[11px] font-bold">
          <thead>
            <tr className="border border-black">
              <th rowSpan={2} className="border border-black w-14">Month</th>
              <th colSpan={2} className="border border-black font-bold">
                {(() => {
                   const y = parseInt(data.billingMonth?.split(/[- ]+/).filter(Boolean)[1] || '2026');
                   return y > 100 ? y - 2 : `20${y - 2}`;
                })()}
              </th>
              <th colSpan={2} className="border border-black font-bold">
                {(() => {
                   const y = parseInt(data.billingMonth?.split(/[- ]+/).filter(Boolean)[1] || '2026');
                   return y > 100 ? y - 1 : `20${y - 1}`;
                })()}
              </th>
              <th colSpan={2} className="border border-black font-bold">
                {(() => {
                   const y = parseInt(data.billingMonth?.split(/[- ]+/).filter(Boolean)[1] || '2026');
                   return y > 100 ? y : `20${y}`;
                })()}
              </th>
            </tr>
            <tr className="border border-black">
              <th className="border border-black">Reading</th>
              <th className="border border-black">Advance</th>
              <th className="border border-black">Reading</th>
              <th className="border border-black">Advance</th>
              <th className="border border-black">Reading</th>
              <th className="border border-black">Advance</th>
            </tr>
          </thead>
          <tbody>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((month, i) => {
              const mList = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
              const billingFull = data.billingMonth?.toUpperCase() || '';
              const billingParts = billingFull.split(/[- ]+/).filter(Boolean);
              const bMonth = billingParts[0];
              const bYear = billingParts[1];

              const isMatch = (yearStr: string) => {
                return bMonth?.startsWith(month) && (bYear === yearStr || bYear === `20${yearStr}`);
              };

              const getPreviousMonth = (billingMonth: string) => {
                const parts = billingMonth.toUpperCase().split(/[- ]+/).filter(Boolean);
                if (parts.length < 2) return null;
                let monthName = parts[0];
                let year = parseInt(parts[1]);
                let monthIndex = mList.indexOf(monthName.substring(0, 3));
                if (monthIndex === -1) return null;
                monthIndex--;
                if (monthIndex < 0) { monthIndex = 11; year--; }
                return `${mList[monthIndex]} ${year}`;
              };

              const prevMonthStr = data.billingMonth ? getPreviousMonth(data.billingMonth) : null;
              const isPreviousMatch = (yearStr: string) => {
                if (!prevMonthStr) return false;
                const pParts = prevMonthStr.split(' ');
                return pParts[0] === month && (pParts[1] === yearStr || pParts[1] === `20${yearStr}`);
              };

              const getReadingVal = (yearStr: string) => {
                const key = `${month} ${yearStr}`;
                
                // Check if this month is marked as "DF" in monthWiseUnits (either reading or units)
                const u = (data.monthWiseUnits || []).find(item => {
                  if (!item.month) return false;
                  let s = item.month.trim().toUpperCase();
                  let mMatch = s.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
                  let numMMatch = !mMatch ? s.match(/^0?([1-9]|1[0-2])[-/]/) : null;
                  let yMatch = s.match(/(20[2-9][0-9]|[2-9][0-9])/);
                  
                  const numberToMonth: Record<string, string> = {
                    "1": "JAN", "2": "FEB", "3": "MAR",
                    "4": "APR", "5": "MAY", "6": "JUN",
                    "7": "JUL", "8": "AUG", "9": "SEP",
                    "10": "OCT", "11": "NOV", "12": "DEC"
                  };
                  
                  let uMonth = mMatch ? mMatch[1] : (numMMatch ? numberToMonth[numMMatch[1]] : null);
                  let uYear = yMatch ? yMatch[1].slice(-2) : null;
                  
                  return uMonth === month && uYear === yearStr.slice(-2);
                });

                const hasLabel = (obj: any) => {
                  if (!obj) return null;
                  const labels = ['DF', 'MC', 'NC', 'RC', 'P-DISC', 'EST. DEF', 'MCO', 'RCO', 'NEW CONNECTION', 'N/A'];
                  const fields = [obj.units, (obj as any).reading, obj.bill, obj.adj, obj.payment];
                  for (const f of fields) {
                    if (!f) continue;
                    const s = f.toString().toUpperCase().trim();
                    for (const l of labels) {
                      if (s === l || s.includes(l)) return f;
                    }
                  }
                  return null;
                };

                const labelField = u ? hasLabel(u) : null;
                if (u && labelField) {
                  const cleanedLabel = labelField.toString().toUpperCase().trim();
                  if (cleanedLabel === 'N/A') return '';
                  return <span className="text-black font-bold text-[12px] leading-none whitespace-nowrap">{formatBillLabel(labelField)}</span>;
                }

                // Check current billing month input
                if (isMatch(yearStr)) {
                  const presStr = data.presentReading?.toString().toUpperCase() || '';
                  const presLabel = hasLabel({ reading: presStr });
                  if (presLabel) {
                    const cleanedLabel = presLabel.toString().toUpperCase().trim();
                    if (cleanedLabel === 'N/A') return '';
                    return <span className="text-black font-bold text-[12px] leading-none whitespace-nowrap">{formatBillLabel(presLabel)}</span>;
                  }
                }

                // Check previous billing month input (if we were on previousReading)
                if (isPreviousMatch(yearStr)) {
                  const prevStr = data.previousReading?.toString().toUpperCase() || '';
                  const prevLabel = hasLabel({ reading: prevStr });
                  if (prevLabel) {
                    const cleanedLabel = prevLabel.toString().toUpperCase().trim();
                    if (cleanedLabel === 'N/A') return '';
                    return <span className="text-black font-bold text-[12px] leading-none whitespace-nowrap">{formatBillLabel(prevLabel)}</span>;
                  }
                }

                const val = calculatedReadings[key];
                if (val === -1) {
                  return <span className="text-black font-bold text-[12px] leading-none whitespace-nowrap">Est. Def</span>;
                }
                if (val !== undefined && !isNaN(val) && val > 0) {
                  return <span className="text-black font-bold">{Math.round(val).toString()}</span>;
                }
                return '';
              };

              const isInDetectionPeriod = (m: string, y: string) => {
                if (!data.detectionPeriodFrom || !data.detectionPeriodTo) return false;
                try {
                  const parseDate = (dateStr: string) => {
                    if (dateStr.includes('-')) {
                      const parts = dateStr.split('-');
                      if (parts.length === 2 && parts[1].length === 4) { // MM-YYYY
                        return new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
                      }
                      if (parts.length === 3) return new Date(dateStr);
                    }
                    return new Date(dateStr);
                  };
                  const fromDate = parseDate(data.detectionPeriodFrom);
                  const toDate = parseDate(data.detectionPeriodTo);
                  const yearNum = parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y);
                  const checkDate = new Date(yearNum, mList.indexOf(m), 1);
                  
                  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || isNaN(checkDate.getTime())) return false;

                  const fromYM = fromDate.getFullYear() * 12 + fromDate.getMonth();
                  const toYM = toDate.getFullYear() * 12 + toDate.getMonth();
                  const checkYM = checkDate.getFullYear() * 12 + checkDate.getMonth();
                  
                  return checkYM >= fromYM && checkYM <= toYM;
                } catch (e) {
                  return false;
                }
              };

              const getAdjVal = (yearStr: string) => {
                const isUnderlined = isInDetectionPeriod(month, yearStr);
                const baseClasses = cn(
                  "font-bold",
                  isUnderlined && "underline italic text-[13px]"
                );

                const stripLabels = (val: string) => {
                  return val.replace(/EST\.?\s*DEF\.?/ig, '')
                            .replace(/DF\s*/ig, '')
                            .replace(/EX\s*/ig, '')
                            .replace(/MCO?\s*/ig, '')
                            .replace(/NC\s*/ig, '')
                            .replace(/NEW CONNECTION\s*/ig, '')
                            .replace(/RCO?\s*/ig, '')
                            .replace(/P-DISC\s*/ig, '')
                            .replace(/SS\s*/ig, '')
                            .replace(/N\/A\s*/ig, '')
                            .replace(/[":{}]/ig, '')
                            .replace(/Units/i, '')
                            .replace(/Bill/i, '')
                            .replace(/Adj/i, '')
                            .replace(/Payment/i, '')
                            .replace(/,/g, '')
                            .trim();
                };

                if (isMatch(yearStr)) {
                  const val = data.difference;
                  const valStr = val?.toString().toUpperCase() || '';
                  
                  if (valStr.includes('DF') || valStr.includes('EX') || valStr.includes('MC') || valStr.includes('NC') || valStr.includes('RC') || valStr.includes('P-DISC') || valStr.includes('SS')) {
                    const onlyNum = stripLabels(valStr);
                    return onlyNum ? <span className={cn(baseClasses, "text-black")}>{onlyNum}</span> : '';
                  }
                  
                  return (val === undefined || val === null || val === '' || val.toString() === '0') ? '' : <span className={cn(baseClasses, "text-black")}>{val}</span>;
                }
                const u = (data.monthWiseUnits || []).find(item => {
                  if (!item.month) return false;
                  let s = item.month.trim().toUpperCase();
                  let mMatch = s.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
                  let numMMatch = !mMatch ? s.match(/^0?([1-9]|1[0-2])[-/]/) : null;
                  let yMatch = s.match(/(20[2-9][0-9]|[2-9][0-9])/);
                  
                  const numberToMonth: Record<string, string> = {
                    "1": "JAN", "2": "FEB", "3": "MAR",
                    "4": "APR", "5": "MAY", "6": "JUN",
                    "7": "JUL", "8": "AUG", "9": "SEP",
                    "10": "OCT", "11": "NOV", "12": "DEC"
                  };
                  
                  let uMonth = mMatch ? mMatch[1] : (numMMatch ? numberToMonth[numMMatch[1]] : null);
                  let uYear = yMatch ? yMatch[1].slice(-2) : null;
                  
                  return uMonth === month && uYear === yearStr.slice(-2);
                });
                
                if (u) {
                  const unitsStr = u.units?.toString().toUpperCase() || '';
                  if (unitsStr !== '' && unitsStr !== '0' && unitsStr !== 'N/A') {
                    // Extract just the number for advance
                    const justNumber = typeof u.units === 'string' ? stripLabels(u.units) : u.units;
                    return <span className={cn(baseClasses, "text-black")}>{justNumber || ''}</span>;
                  }
                }
                return '';
              };

              const yearBase = parseInt(bYear || '26');
              const y1 = (yearBase - 2).toString().slice(-2);
              const y2 = (yearBase - 1).toString().slice(-2);
              const y3 = (yearBase).toString().slice(-2);

              return (
                <tr key={month} className="border border-black h-[18px]">
                  <td className="border border-black font-bold">{month}</td>
                  <td className="border border-black">{getReadingVal(y1)}</td>
                  <td className="border border-black">{getAdjVal(y1)}</td>
                  <td className="border border-black">{getReadingVal(y2)}</td>
                  <td className="border border-black">{getAdjVal(y2)}</td>
                  <td className="border border-black">{getReadingVal(y3)}</td>
                  <td className="border border-black">{getAdjVal(y3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      <div className="mt-2 grid grid-cols-[1.5fr_1fr] gap-0 border border-black overflow-hidden">
        <div className="border-r border-black">
          <h3 className="font-bold text-[11px] text-center py-0.5 border-b border-black font-sans">Detail of Connected Load</h3>
          <table className="w-full text-center text-[11px] font-bold border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black font-bold py-0.5">Description</th>
                <th className="border-r border-black font-bold py-0.5">Qty</th>
                <th className="border-r border-black font-bold py-0.5">Watts</th>
                <th className="font-bold py-0.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.loadItems && data.loadItems.length > 0 ? data.loadItems : [
                { name: 'E/Saver', watts: 18, qty: '', total: '' },
                { name: 'Tube Light', watts: 40, qty: '', total: '' },
                { name: 'Fan', watts: 80, qty: '', total: '' },
                { name: 'TV', watts: 150, qty: '', total: '' },
                { name: 'Computer', watts: 200, qty: '', total: '' },
                { name: 'Refrigerator', watts: 250, qty: '', total: '' },
                { name: 'Freezer', watts: 350, qty: '', total: '' },
                { name: 'W/Machine', watts: 373, qty: '', total: '' },
                { name: 'Water Pump', watts: 746, qty: '', total: '' },
                { name: 'Iron', watts: 1000, qty: '', total: '' },
                { name: 'UPS', watts: 1000, qty: '', total: '' },
                { name: 'Toka/Heat', watts: '', qty: '', total: '' },
              ]).map((item, idx) => (
                <tr key={idx} className="border-b border-black h-[18px]">
                  <td className="border-r border-black text-left pl-2 py-0.5 font-bold">{item.name}</td>
                  <td className="border-r border-black text-black font-bold py-0.5">{item.qty}</td>
                  <td className="border-r border-black text-black font-bold py-0.5">{item.watts}</td>
                  <td className="text-black font-bold py-0.5">{item.total}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border-r border-black text-right pr-2 py-1" colSpan={3}>Total C/Load : -</td>
                <td className={cn("font-bold py-1", parseFloat(data.connectedLoad?.toString().replace(/[^0-9.]/g, '') || '0') > 6 ? "text-black animate-blink" : "text-black")}>{data.connectedLoad}{data.connectedLoad && !data.connectedLoad.toString().toUpperCase().includes('KW') ? '-KW' : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-col">
          <div className="p-2 border-b border-black text-[8px] md:text-[9px] leading-tight">
            <p>Detection Bill for Registered Consumers Clause 9.1.3 (b) (Load*Load Factor*730*Months).</p>
            <p className="mt-1">Load means the connected load or sanctioned load whichever is higher.</p>
          </div>
          <div className="p-2 flex-1 relative min-h-[180px] flex flex-col justify-start overflow-hidden">
            <h3 className="font-bold underline text-[9px] font-sans">Remarks : -</h3>
            <div className="overflow-y-auto mt-1 shrink-0">
              {data.remarks?.split('\n').map((line, i) => {
                const lowerLine = line.toLowerCase();
                const isSpecial = lowerLine.includes('additional') && lowerLine.includes('units charged') || 
                                lowerLine.includes('detection bill charged as per connected load');
                return (
                  <p key={i} className={cn("text-[9px] whitespace-pre-wrap font-bold", isSpecial ? "text-red-600" : "text-black")}>
                    {line}
                  </p>
                );
              })}
            </div>
            {data.photoUrl && (
              <div className="mt-2 flex-1 flex flex-col items-center justify-start gap-2 pt-1 min-h-[50px] overflow-hidden">
                <a 
                  href={data.photoUrl}
                  download={`Discrepancy ${data.referenceNumber || 'evidence'}.jpg`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("Download link clicked. photoUrl exists:", !!data.photoUrl);
                  }}
                  className="print:hidden bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1 rounded-full text-[8px] font-bold transition-all flex items-center gap-1 shadow-sm border border-neutral-300 cursor-pointer relative z-10 no-underline whitespace-nowrap shrink-0"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download Photo
                </a>
                <img 
                  src={data.photoUrl} 
                  alt="Detection Evidence" 
                  className="max-w-full h-full min-h-0 object-contain object-top border border-black shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between gap-4">
            <div className="flex gap-1 items-end min-w-0"><span className="whitespace-nowrap font-bold">Connected Load : - </span><span className={cn("border-b border-black whitespace-nowrap font-bold", parseFloat(data.connectedLoad?.toString().replace(/[^0-9.]/g, '') || '0') > 6 ? "text-black animate-blink" : "text-black")}>{data.connectedLoad}{data.connectedLoad && !data.connectedLoad.toString().toUpperCase().includes('KW') ? '-KW' : ''}</span></div>
            <div className="flex gap-1 items-end min-w-0"><span className="whitespace-nowrap font-bold">Load Factor : - </span><span className="border-b border-black whitespace-nowrap text-black font-bold">{data.loadFactor}</span></div>
            <div className="flex gap-1 items-end min-w-0"><span className="whitespace-nowrap font-bold">Units Already Charged : - </span><span className="border-b border-black whitespace-nowrap text-black font-bold">{parseInt(data.unitsAlreadyCharged || '0').toLocaleString()}</span></div>
            <div className="flex gap-1 items-end min-w-0">
              <span className="whitespace-nowrap font-bold">Units Assessed : - </span>
              <span className="border-b border-black whitespace-nowrap text-black font-bold">
                {data.unitsAssessed ? (
                  (() => {
                    const isSlowness = data.discrepancy?.includes('Meter Slow By');
                    const slownessPerc = parseInt(data.meterSlowBy?.replace(/[^0-9]/g, '') || '0');
                    const chargedUnits = parseInt(data.unitsAlreadyCharged?.toString().replace(/,/g, '') || '0');
                    
                    if (isSlowness && slownessPerc > 0 && slownessPerc < 100) {
                      return `(${chargedUnits.toLocaleString()} * 100) / (100 - ${slownessPerc}) = ${parseInt(data.unitsAssessed).toLocaleString()}`;
                    }
                    
                    const loadVal = parseFloat(data.connectedLoad?.toString().replace(/[^0-9.]/g, '') || '0');
                    return `${loadVal} * ${data.loadFactor} * 730 * ${data.detectionPeriodMonths || 0} = ${parseInt(data.unitsAssessed).toLocaleString()}`;
                  })()
                ) : ''}
              </span>
            </div>
          </div>
          <div className="flex justify-start gap-8 mt-4">
            <div className="flex items-center">
              <span className="font-bold border-[3px] border-black px-3 py-0.5 inline-flex items-center gap-2">
                <span className="text-[10px] text-black uppercase">
                  {data.discrepancy?.includes('Meter Slow By') ? `Net units to be charged as per slowness ${data.meterSlowBy || ''}` : 'G. Total units to be charged'} : -
                </span>
                <span className={cn(
                  "text-sm text-black border-b-[3px] border-double border-black font-bold"
                )}>
                  {
                    (data.feederName || data.netUnitsToBeCharged) === 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD' 
                      ? 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD' 
                      : (data.feederName || (parseInt(data.netUnitsToBeCharged || '0').toLocaleString()))
                  }
                </span>
              </span>
              <span className="text-[10px] text-black flex items-center ml-2">
                <span className="font-bold border-b border-black">
                  = ({parseInt(data.unitsAssessed || '0').toLocaleString()} - {parseInt(data.unitsAlreadyCharged || '0').toLocaleString()}
                  {(!data.unitsOfAcPeriod || parseInt(data.unitsOfAcPeriod) === 0) ? '' : ` + ${parseInt(data.unitsOfAcPeriod).toLocaleString()}`})
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-between text-center font-bold text-[8px] md:text-[9px] leading-tight">
          <div className="flex flex-col items-center flex-1">
            <div className="border-t border-black w-20 mb-1"></div>
            <p>Meter Inspector</p>
            <p>K.R.K-I Sub Division</p>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="border-t border-black w-24 mb-1"></div>
            <p>Assistant Manager (OP)</p>
            <p>K.R.K-I Sub Division</p>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="border-t border-black w-24 mb-1"></div>
            <p>Technical Assistant</p>
            <p>K.R.K Division LESCO</p>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="border-t border-black w-24 mb-1"></div>
            <p>Dy. Manager (OP)</p>
            <p>K.R.K Division LESCO</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotice = () => {
    return (
      <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[10px] md:text-[11px] leading-tight flex flex-col p-6 md:p-[20mm]">
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-2">
          <div className="text-center flex-1">
            <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">NOTICE</h1>
            <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
            <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
            <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
            <p className="font-bold text-[9px] flex items-center justify-center gap-1">
              <span className="text-xs">☎</span> <span dir="ltr">049-2382776</span>
            </p>
          </div>
          {renderQRCode()}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between border-b border-neutral-100 pb-1 mb-2">
            <div className="flex gap-2 items-end"><span className="whitespace-nowrap font-bold">Notice No. :</span><span className="border-b border-black text-black font-bold px-1">{data.noticeNo || '__________'}</span></div>
            <div className="flex gap-2 items-end"><span className="whitespace-nowrap font-bold">Dated :</span><span className="border-b border-black text-black font-bold px-1">{formatDate(data.noticeDated)}</span></div>
          </div>

          <div className="font-bold uppercase">
            TO
          </div>

          <div className="flex flex-col items-start gap-1.5">
            <span className="border-b border-black text-black font-bold uppercase">
              {data.presentOccupier ? `${data.name} P/O ${data.presentOccupier}` : data.name}
            </span>
            <span className="border-b border-black text-black font-bold uppercase">{data.address}</span>
          </div>

          <div className="flex gap-3 items-end">
            <span className="whitespace-nowrap">Tariff : -</span>
            <span className="border-b border-black text-black font-bold px-1">{data.tariff}</span>
          </div>

          <div className="flex gap-4 items-baseline mt-4">
            <span className="font-bold text-xs whitespace-nowrap">SUBJECT:</span>
            <span className="font-bold text-xs uppercase border-b-2 border-black pb-0.5">
              NOTICE AGAINST REFERENCE NO. {data.referenceNumber}
            </span>
          </div>

          <div className="space-y-4 text-justify leading-normal mt-4">
            <p className="indent-8">
              The premises of your above Subjected referred no was got checked by the 
              <span className="border-b border-black font-bold text-black mx-1">{Array.isArray(data.checkedBy) && data.checkedBy.length > 0 ? data.checkedBy.join(', ') : '____________________'}</span> on 
              <span className="border-b border-black font-bold text-black mx-1">{data.dateOfChecking ? formatDate(data.dateOfChecking) : '__________'}</span> and it was noticed that you were found dishonestly illegal abstracting of electricity through following method:
            </p>
            <div className="text-center w-full my-2">
              <span className="font-bold text-xs uppercase border-b-2 border-black pb-0.5">
                "{data.discrepancy && data.discrepancy.length > 0 ? formatDiscrepancies(data.discrepancy) : '____________________________________'}"
              </span>
            </div>

            <p className="indent-8">
              Above discrepancies are prima facie evidence of illegal abstraction of electricity by the registered consumer under section 39-A of the Electricity Act 1910 and also clear-cut violation of Criminal Law Amendment Act 2016.
            </p>

            <p className="indent-8">
              You are hereby advised to explain your position within 3-days after receipt of this notice as to why as per provisions of section 26-A of the Electricity Act, 1910 as Amended should not be charged to you and the amount of energy dishonestly, consumed or used. if your reply not received within the stipulated period then it will be assumed that you have nothing to say in your reply and following actions are likely be initiated against you forthwith.
            </p>

            <ul className="space-y-1 pl-12 list-disc font-bold">
              <li>Registration of F.I.R</li>
              <li>Charging of Detection Bill</li>
              <li>Disconnection of Supply</li>
            </ul>
          </div>

          {data.photoUrl && (
            <div className="mt-8 flex flex-col items-center gap-2 border-t border-neutral-100 pt-4">
              <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Evidence of Discrepancy</p>
              <img 
                src={data.photoUrl} 
                alt="Evidence" 
                className="max-w-[400px] max-h-[250px] object-contain border border-black shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="mt-auto pt-12 flex justify-end">
            <div className="text-center font-bold">
              <div className="border-t border-black w-48 mb-1"></div>
              <p className="text-[10px]">Assistant Manager (Operation)</p>
              <p className="text-[10px]">Kot Radha Kishan-1 Sub Division LESCO</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const localTranslateToUrdu = (text: string | undefined): string => {
    if (!text) return '۔۔۔۔۔۔۔۔۔۔۔۔';
    
    // Prioritize persistent Urdu fields from data first
    if (text === data.name && data.nameUrdu) return data.nameUrdu;
    if (text === data.address && data.addressUrdu) return data.addressUrdu;
    if (text === data.employeeName && data.employeeNameUrdu) return data.employeeNameUrdu;

    // Fallback to transient AI translations if persistent ones aren't set
    if (aiUrduTranslations) {
      if (text === data.name && aiUrduTranslations['name']) return aiUrduTranslations['name'];
      if (text === data.address && aiUrduTranslations['address']) return aiUrduTranslations['address'];
      if (text === data.employeeName && aiUrduTranslations['employeeName']) return aiUrduTranslations['employeeName'];
    }

    let translated = text;
    const map: { [key: string]: string } = {
      'raiwind': 'رائے ونڈ',
      'changa manga': 'چھانگا مانگا',
      'kot radha kishan': 'کوٹ رادہاکشن',
      'manga mandi': 'مانگا منڈی',
      'raiwind city': 'رائے ونڈ سٹی',
      'along with': 'ہمراہ',
      'kasur': 'قصور',
      'lahore': 'لاہور',
      'pattoki': 'پتونکی',
      'chunian': 'چونیاں',
      'phool nagar': 'پھول نگر',
      'habibabad': 'حبیب آباد',
      'mustafabad': 'مصطفی آباد',
      'ellahabad': 'الہٰ آباد',
      'kanganpur': 'کنگن پور',
      'khudian': 'کھڈیاں',
      'bhai pheru': 'بھائی پھیرو',
      'lalyani': 'للیانی',
      'okara': 'اوکاڑہ',
      'sahiwal': 'ساہیوال',
      'sheikhupura': 'شیخوپورہ',
      'gujranwala': 'گوجرانوالہ',
      's/o': 'ولد',
      'son of': 'ولد',
      'd/o': 'بنت',
      'daughter of': 'بنت',
      'w/o': 'زوجہ',
      'wife of': 'زوجہ',
      'p/o': 'حال قابض',
      'p.o': 'حال قابض',
      'present occupier': 'حال قابض',
      'r/o': 'سکنہ',
      'resident of': 'سکنہ',
      'tehsil': 'تحصیل',
      'district': 'ضلع',
      'road': 'روڈ',
      'mohallah': 'محلہ',
      'chak': 'چک',
      'kot': 'کوٹ',
      'house': 'مکان',
      'street': 'گلی',
      'gali': 'گلی',
      'near': 'نزد',
      'opposite': 'بالمقابل',
      'main bazar': 'مین بازار',
      'bazar': 'بازار',
      'village': 'گاوں',
      'dhariwal': 'دھاریوال',
      'jamber': 'جمبر',
      'shiekh hussain': 'شیخ حسین',
      'behlolpur': 'بہلول پور',
      'assistant manager (operation)': 'اِسسٹنٹ مینیجر (آپریشن)',
      'm&s team': 'ایم اینڈ ایس ٹیم',
      'sub divisional checking team': 'سب ڈویژنل چیکنگ ٹیم',
      'inyat ullah': 'عنایت اللہ',
      'inayat ullah': 'عنایت اللہ',
      'nia moh': 'نیاز محمد',
      'noor muhammad': 'نور محمد',
      'naseem shah': 'نسیم شاہ',
      'black': 'سیاہ',
      'meter': 'میٹر',
      'foot': 'فٹ',
      'feet': 'فٹ',
      'ft': 'فٹ',
      'meters': 'میٹر',
      'ls': 'ایل ایس',
      'lm': 'ایل ایم',
      'alm': 'اے ایل ایم',
      'bd': 'بل ڈسٹری بیوٹر',
      'ms': 'ایم ایس',
      'm/r': 'میٹر ریڈر',
      'je': 'جے ای',
      'sdo': 'سب ڈویژنل آفیسر',
      'acting meter inspector': 'ایکٹنگ میٹر انسپکٹر',
      'Direct Supply From LESCO main Cable': 'لیسکو کی مین کیبل سے ڈائریکٹ سپلائی لگا رکھی تھی، جس کے ذریعے غیر قانونی طور پر بجلی استعمال/چوری کی جا رہی تھی',
      'Direct Supply From L.T line': 'ایل ٹی لائن سے ڈائریکٹ سپلائی لگا رکھی تھی، جس کے ذریعے غیر قانونی طور پر بجلی استعمال/چوری کی جا رہی تھی',
      'Direct Supply From Meter terminal.': 'میٹر ٹرمینل بلاک سے ڈائریکٹ سپلائی لگا رکھی تھی، جس کے ذریعے غیر قانونی طور پر بجلی استعمال/چوری کی جا رہی تھی',
      'Meter Body Tempered.': 'میٹرباڈی ٹیمپرڈ کرکے بجلی چوری کر رہا تھا۔',
      'Meter Body Tempered': 'میٹرباڈی ٹیمپرڈ کرکے بجلی چوری کر رہا تھا۔',
      'Hole In Meter Body. Meter Reversed.': 'میٹرباڈی میں سوراخ کرکے میٹر ریورس کر رکھا تھا',
      'Hole in Meter Terminal Block.': 'میٹر ٹرمینل بلاک میں سوراخ کرکے بجلی چوری کر رہا تھا',
      'Scratches on Figures. Meter Reversed.': 'میٹر ریورس کر رکھا تھا۔ موقع پر چیک کرنے سے میٹر کے فگرز پر واضح نشانات پائے گئے، جس کی وجہ سے بجلی چوری کی جا رہی تھی',
      'Shunt In Terminal Block.': 'میٹر ٹرمینل بلاک میں شنٹ لگا کر میٹر سلو کر رکھا تھا',
      'One Phase Dead Stop. Meter 33% Slow.': 'ایک فیز مردہ ہے، میٹر 33 فیصد سلو ہے',
      'Two Phase Dead Stop. Meter 66% Slow.': 'دو فیز مردہ ہیں، میٹر 66 فیصد سلو ہے',
      'Meter Dead Stop.': 'میٹر مکمل طور پر بند ہے (ڈیڈ سٹاپ)',
      'Meter Intensionally Display Wash.': 'میٹر کا ڈسپلے جان بوجھ کر واش/خراب کر رکھا تھا، جس کے باعث بجلی کی غیر قانونی ترسیل و استعمال جاری تھا',
      'Meter Intensionally Burnt.': 'میٹر کو جان بوجھ کر جلا دیا تھا، جس کے باعث بجلی کی غیر قانونی ترسیل و استعمال جاری تھا',
      'ls-i': 'ایل ایس ون',
      'ls-ii': 'ایل ایس ٹو',
      'lm-i': 'ایل ایم ون',
      'lm-ii': 'ایل ایم ٹو',
      'ms-i': 'ایم ایس ون',
      'ms-ii': 'ایم ایس ٹو',
      'lorry driver': 'لاری ڈرائیور',
      'laeeque ahmad': 'لئیق احمد',
      'amjad ali': 'امجد علی',
      'muhammad afzal.': 'محمد افضل۔',
      'muhammad amin': 'محمد امین',
      'pervaiz akhtar': 'پرویز اختر',
      'mumtaz ali': 'ممتاز علی',
      'muhammad ashraf': 'محمد اشرف',
      'muhammad fazal': 'محمد فضل',
      'javaid iqbal': 'جاوید اقبال',
      'anjum maqsood': 'انجم مقصود',
      'ghulam muhammad': 'غلام محمد',
      'jameel ahmad': 'جمیل احمد',
      'zulifqar ali bhatti': 'ذوالفقار علی بھٹی',
      'nazeer ahmad': 'نذیر احمد',
      'muhammad azam': 'محمد اعظم',
      'tahir hussain': 'طاہر حسین',
      'muhammad sarwar': 'محمد سرور',
      'muhammad imran': 'محمد عمران',
      'muhammad shafique': 'محمد شفیق',
      'irfan ali ayoub': 'عرفان علی ایوب',
      'muhammad yaqoob': 'محمد یعقوب',
      'muhammad asif': 'محمد آصف',
      'kashif mehmood': 'کاشف محمود',
      'ch.bilal ahmad': 'چوہدری بلال احمد',
      'zia-ul-qamar': 'ضیاء القمر',
      'muhammad dawood': 'محمد داؤد',
      'muhammad tariq mahmood': 'محمد طارق محمود',
      'shehzad anjum': 'شہزاد انجم',
      'shahbaz ali': 'شہباز علی',
      'muhammad amir': 'محمد عامر',
      'muhammad amjad': 'محمد امجد',
      'muhammad rasheed': 'محمد رشید',
      'mohammad asghar': 'محمد اصغر',
      'nadeem sajjad': 'ندیم سجاد',
      'naeem ahmad': 'نعیم احمد',
      'muhammad usman': 'محمد عثمان',
      'muhammad mubeen': 'محمد مبین',
      'shahbaz ahmad saqi': 'شہباز احمد ساقی',
      'mohsan bashir': 'محسن بشیر',
      'ch; muhammad shafqat khan': 'چوہدری; محمد شفقت خان',
      'muhammad shakeel': 'محمد شکیل',
      'ali shan': 'علی شان',
      'shafqat ali babar': 'شفقت علی بابر',
      'mohammad asif': 'محمد آصف',
      'waseem akram': 'وسیم اکرم',
      'muhammad riaz': 'محمد ریاض',
      'kazim ali': 'کاظم علی',
      'asjad ali': 'اسجد علی',
      'attaullah khattak': 'عطا اللہ خٹک',
      'tahir islam': 'طاہر اسلام',
      'imran nasir': 'عمران ناصر',
      'muhammad aslam': 'محمد اسلم',
      'muhammad farman': 'محمد فرمان',
      'dildar hussain': 'دلدار حسین',
      'tallat mehmood': 'طلعت محمود',
      'allah ditta': 'اللہ دتہ',
      'saeed ahmed': 'سعید احمد',
      'shakeel ahmad': 'شکیل احمد',
      'mohammad amjad': 'محمد امجد',
      'maqbool ahmed': 'مقبول احمد',
      'mohammad asif bashir': 'محمد آصف بشیر',
      'abdul latif': 'عبداللطیف',
      'shafaqat ali sajid': 'شفقت علی ساجد',
      'maqgood ahmad': 'مقبول احمد',
      'muhammad maqbool': 'محمد مقبول',
      'nasrullah khan': 'نصراللہ خان',
      'muhammad saleem': 'محمد سلیم',
      'iftikhar ahmad': 'افتخار احمد',
      'irfan haider': 'عرفان حیدر',
      'zulifqar ali': 'ذوالفقار علی',
      'muhammad abbas': 'محمد عباس',
      'muhammad nawaz': 'محمد نواز',
      'mohammad arshad': 'محمد ارشد',
      'abid hussain': 'عابد حسین',
      'shahzad nadeem': 'شہزاد ندیم',
      'muhammad ashfaq': 'محمد اشفاق',
      'shahbaz ahmed': 'شہباز احمد',
      'shoaib akhtar': 'شعیب اختر',
      'mirza muhammad abid baig': 'مرزا محمد عابد بیگ',
      'muhammad dilshad': 'محمد دلشاد',
      'naseem akbar': 'نسیم اکبر',
      'zulfqar ali': 'ذوالفقار علی',
      'naveed shehzad hussain': 'نوید شہزاد حسین',
      'muhammad irfan': 'محمد عرفان',
      'danish masih': 'دانش مسیح',
      'sajjad masih': 'سجاد مسیح',
      'junaid jamil': 'جنید جمیل',
      'abdul rasheed': 'عبدالرشید',
      'fiaz ullah athar': 'فیاض اللہ اطہر',
      'muhammad saddique': 'محمد صدیق',
      'imarat ali': 'امارت علی',
      'muhammad sharif': 'محمد شریف',
      'akhtar hussain': 'اختر حسین',
      'muhammad shahbaz price': 'محمد شہباز قیمت',
      'shakeel lal': 'شکیل لال',
      'muhammad latif': 'محمد لطیف',
      'amir allah wasaya': 'امیر اللہ وسایا',
      'muhammad farooq': 'محمد فاروق',
      'faryad ali': 'فریاد علی',
      'hanan ashraf': 'حنان اشرف',
      'farman arshad': 'فرمان ارشد',
      'm.naveed': 'ایم نوید',
      'faisal masood': 'فیصل مسعود',
      'maqsood ahmad': 'مقصود احمد',
      'safdar malik': 'صفدر ملک',
      'salman m.r': 'سلمان ایم آر',
      'muhammadmurtaza': 'محمد مرتضیٰ',
      'muhammad aqeel': 'محمد عقیل',
      'muhammad asghar': 'محمد اصغر',
      'muhammad salman': 'محمد سلمان',
      'awaise munir': 'اویس منیر',
      'ghulam murtaza': 'غلام مرتضیٰ',
      'zaeem sabir': 'زعیم صابر',
      'mudassar yaseen': 'مدثر یاسین',
      'muhammad khaliq': 'محمد خالق',
      'muhammad naveed sharif': 'محمد نوید شریف',
      'qaisar nadeem': 'قیصر ندیم',
      'rozdar khan': 'روزدار خان',
      'zahid naseer': 'زاہد نصیر',
      'khizar hayat': 'خضر حیات',
      'saeed ahmad': 'سعید احمد',
      'shehzad qaisar': 'شہزاد قیصر',
      'ch. muhammad abubakar siddique': 'چوہدری محمد ابوبکر صدیق',
      'muhammad umar': 'محمد عمر',
      'muhammad younas': 'محمد یونس',
      'ahmad naseem': 'احمد نسیم',
      'tauqeer ali shahzad': 'توقیر علی شہزاد',
      'muhammad ramzan': 'محمد رمضان',
      'm. imran rafique': 'ایم عمران رفیق',
      'imran khan': 'عمران خان',
      'adil usman': 'عادل عثمان',
      'adil hussain': 'عادل حسین',
      'sajid javed': 'ساجد جاوید',
      'kashif hussain': 'کاشف حسین',
      'mudassar sehar': 'مدثر سحر',
      'abdul khaliq': 'عبدالخالق',
      'sakhawat ali khan': 'سخاوت علی خان',
      'kalim ullah': 'کلیم اللہ',
      'atif mahmood': 'عاطف محمود',
      'muhammad umar subhani': 'محمد عمر سبحانی۔',
      'shan ali': 'شان علی',
      'bhola masih': 'بھولا مسیح',
      'zahid ali ولد nasar ali': 'زاہد علی ولد ناصر علی',
      'zahid ali son of nasar ali': 'زاہد علی ولد ناصر علی',
      'zahid ali s/o nasar ali': 'زاہد علی ولد ناصر علی',
      'chak number 55 kot radhakishan': 'چک نمبر 55 کوٹ رادہا کشن',
      'chak no 55 kot radhakishan': 'چک نمبر 55 کوٹ رادہا کشن',
      'chak no 55 kot radhakishan sub div': 'چک نمبر 55 کوٹ رادہا کشن سب ڈویژن',
      'm&t representative': 'نمائندہ ایم اینڈ ٹی',
      'assistant manager operation': 'اِسسٹنٹ مینیجر (آپریشن)',
      'assistant manager': 'اِسسٹنٹ مینیجر',
      'muhammad': 'محمد',
      'fiaz': 'فیاض',
      'ahmed': 'احمد',
      'ahmad': 'احمد',
      'ali': 'علی',
      'hussain': 'حسین',
      'raza': 'رضا',
      'hassan': 'حسن',
      'khalid': 'خالد',
      'tariq': 'طارق',
      'naveed': 'نوید',
      'shahid': 'شاہد',
      'zafar': 'ظفر',
      'iqbal': 'اقبال',
      'anwar': 'انور',
      'bashir': 'بشیر',
      'munir': 'منیر',
      'rashid': 'رشید',
      'sultan': 'سلطان',
      'shaukat': 'شوکت',
      'rafiq': 'رفیق',
      'farooq': 'فاروق',
      'siddique': 'صدیق',
      'tayyab': 'طیب',
      'zubair': 'زبیر',
      'bilal': 'بلال',
      'hamza': 'حمزہ',
      'usman': 'عثمان',
      'umar': 'عمر',
      'abu bakar': 'ابوبکر',
      'abubakar': 'ابوبکر',
      'mian': 'میاں',
      'syed': 'سید',
      'haji': 'حاجی',
      'ch.': 'چوہدری',
      'ch': 'چوہدری',
      'malik': 'ملک',
      'sheikh': 'شیخ',
      'sh.': 'شیخ',
      'sh': 'شیخ',
      'bhatti': 'بھٹی',
      'jatt': 'جٹ',
      'rajpoot': 'راجپوت',
      'rana': 'رانا',
      'dogar': 'ڈوگر',
      'arain': 'آرائیں',
      'guijar': 'گجر',
      'gujjar': 'گجر',
      'butt': 'بٹ',
      'mirza': 'مرزا',
      'beg': 'بیگ',
      'baig': 'بیگ',
      'zahid ali': 'زاہد علی',
      'nasar ali': 'ناصر علی',
      'kamran': 'کامران',
      'rizwan': 'رضوان',
      'adnan': 'عدنان',
      'faisal': 'فیصل',
      'irfan': 'عرفان',
      'sajid': 'ساجد',
      'majid': 'ماجد',
      'zahoor': 'ظہور',
      'akmal': 'اکمل',
      'aslam': 'اسلم',
      'akram': 'اکرم',
      'arshad': 'ارشد',
      'ashfaq': 'اشفاق',
      'ashraf': 'اشرف',
      'asif': 'آصف',
      'azam': 'اعظم',
      'babur': 'بابر',
      'babar': 'بابر',
      'habib': 'حبیب',
      'haider': 'حیدر',
      'hameed': 'حمید',
      'ibrahim': 'ابراہیم',
      'idrees': 'ادریس',
      'ilyas': 'الیاس',
      'imran': 'عمران',
      'ishfaq': 'اشفاق',
      'ishaq': 'اسحاق',
      'ismail': 'اسماعیل',
      'imtiaz': 'امتیاز',
      'javaid': 'جاوید',
      'javed': 'جاوید',
      'latif': 'لطیف',
      'liaquat': 'لیاقت',
      'maqsood': 'مقصود',
      'masood': 'مسعود',
      'mubarak': 'مبارک',
      'mubashir': 'مبشر',
      'muddasar': 'مدثر',
      'mudassar': 'مدثر',
      'mujtaba': 'مجتبیٰ',
      'mustafa': 'مصطفی',
      'nadeem': 'ندیم',
      'naseer': 'نصیر',
      'nasir': 'ناصر',
      'nawaz': 'نواز',
      'qasim': 'قاسم',
      'qayyum': 'قیوم',
      'rafeeq': 'رفیق',
      'rehan': 'ریحان',
      'saif': 'سیف',
      'saleem': 'سلیم',
      'salman': 'سلمان',
      'shabbir': 'شبیر',
      'shahzad': 'شہزاد',
      'shakeel': 'شکیل',
      'sharif': 'شریف',
      'tahir': 'طاہر',
      'waheed': 'وحید',
      'waqas': 'وقاص',
      'yaseen': 'یاسین',
      'younas': 'یونس',
      'yousaf': 'یوسف',
      'zaheer': 'ظہیر',
      'master': 'ماسٹر',
      'doctor': 'ڈاکٹر',
      'dr.': 'ڈاکٹر',
      'professor': 'پروفیسر',
      'prof.': 'پروفیسر',
      'advocate': 'ایڈووکیٹ',
      'adv.': 'ایڈووکیٹ',
      'engineer': 'انجینئر',
      'engr.': 'انجینئر',
      'engr': 'انجینئر',
      'major': 'میجر',
      'captain': 'کیپٹن',
      'retired': 'ریٹائرڈ',
      'ret.': 'ریٹائرڈ',
      'pensioner': 'پینشنر',
      'floor': 'منزل',
      'ground': 'گراؤنڈ',
      'plaza': 'پلازہ',
      'market': 'مارکیٹ',
      'block': 'بلاک',
      'sector': 'سیکٹر',
      'phase': 'فیز',
      'garden': 'گارڈن',
      'colony': 'کالونی',
      'town': 'ٹاؤن',
      'city': 'سٹی',
      'shumal': 'شمال',
      'janub': 'جنوب',
      'mashriq': 'مشرق',
      'maghrib': 'مغرب',
      'faridi': 'فریدی',
      'chishti': 'چشتی',
      'qadri': 'قادری',
      'naqshbandi': 'نقشبندی',
      'soharwardi': 'سہروردی',
      'shoaib': 'شعیب',
      'tauseef': 'توصیف',
      'tanveer': 'تنویر',
      'khurram': 'خرم',
      'shehzad': 'شہزاد',
      'aftab': 'آفتاب',
      'mahtab': 'مہتاب',
      'khurshid': 'خورشید',
      'pervaiz': 'پرویز',
      'akhtar': 'اختر',
      'asghar': 'اصغر',
      'akbar': 'اکبر',
      'mohammad': 'محمد',
      'muhamad': 'محمد',
      'muhammd': 'محمد',
      'm.': 'ایم',
      'afzal': 'افضل',
      'inayat': 'عنایت',
      'ullah': 'اللہ',
      'inayatullah': 'عنایت اللہ'
    };

    // Sort keys by length descending to handle longer terms first (e.g. 'raiwind city' before 'raiwind')
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

    sortedKeys.forEach(key => {
      // Use string replace instead of word boundary regex to handle mixed scripts better
      translated = translated.split(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join(map[key]);
    });

    return translated;
  };

  const renderFIRUrdu = () => {
    const hasSeizureMemo = !!(data.seizureCableSize && data.seizureCableLength && data.seizureCableColor);

    return (
      <div className="print-container bg-white urdu-font p-0 m-0" ref={ref} dir="rtl" style={{ fontSize: '14pt', lineHeight: '1.5' }}>
        {/* FIR Page */}
        <div 
          className="print-page w-full md:w-[210mm] mx-auto p-4 md:p-[25.4mm] text-black bg-white"
          style={{ pageBreakAfter: hasSeizureMemo ? 'always' : 'auto', breakAfter: hasSeizureMemo ? 'page' : 'auto' }}
        >
            <div className="text-center mb-6 space-y-1">
                <h1 className="text-[18pt] font-bold urdu-font">لاہور الیکٹرک سپلائی کمپنی لمیٹڈ (لیسکو)</h1>
                <p className="text-[16pt] font-bold">دفتر اِسسٹنٹ مینیجر (آپریشن) لیسکو کوٹ رادھاکشن سب ڈویژن نمبر۔۱</p>
                <p className="text-[11pt]">132 کے وی گریڈ اسٹیشن کوٹ رادھاکشن   <span dir="ltr">049-2382776</span> ☎</p>
                <div className="mt-2 border-b-2 border-double border-black w-2/3 mx-auto"></div>
            </div>
            
            <div className="text-right space-y-4">
                <div className="flex justify-between w-full font-bold">
                  <p>چھٹی نمبری: <span>{data.firNo || '۔۔۔۔۔۔۔۔۔۔۔۔'}</span></p>
                  <p>بتاریخ: <span dir="ltr">{(() => {
                    const dateToUse = data.registeredFirDated || data.firDated;
                    if (dateToUse) return formatDate(dateToUse);
                    const today = new Date();
                    return `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getFullYear()}`;
                  })()}</span></p>
                </div>
                
                <div className="space-y-1">
                    <p>از طرف: <span className="font-bold">اِسسٹنٹ مینیجر (آپریشن) لیسکو کوٹ رادھاکشن سب ڈویژن نمبر۔۱</span></p>
                    <p>بطرف: <span className="font-bold">جناب ایس۔ایچ۔او صاحب تھانہ {localTranslateToUrdu(data.policeStation)} {data.policeStation?.toLowerCase().includes('raiwind') ? 'ضلع لاہور' : 'ضلع قصور'}</span></p>
                </div>

                <div className="text-center py-2">
                    <h2 className="text-[16pt] font-bold inline-block pb-1 urdu-font border-b-2 border-black">
                        عنوان: اندراج مقدمہ بابت بجلی چوری زیرِ دفعہ <span dir="ltr" className="inline-block px-1">462-I</span> الیکٹریسٹی ایکٹ 2016
                    </h2>
                </div>
                
                {(() => {
                  const presentOccupierUrdu = data.presentOccupierUrdu || (data.presentOccupier ? localTranslateToUrdu(data.presentOccupier) : null);
                  
                  const cleanName = presentOccupierUrdu || (() => {
                    const markers = [/p\/o/i, /p\.o/i, /hal qabiz/i, /present occupier/i];
                    for (const marker of markers) {
                      const parts = data.name.split(marker);
                      if (parts.length > 1) {
                        return localTranslateToUrdu(parts[parts.length - 1].trim());
                      }
                    }
                    return localTranslateToUrdu(data.name);
                  })();

                  const checkingTeamUrdu = (() => {
                    if (!data.checkedBy) return '۔۔۔۔۔';
                    const items = Array.isArray(data.checkedBy) ? data.checkedBy : [data.checkedBy];
                    if (items.length === 2 && 
                        items.some(i => i === 'Sub Divisional Checking Team') && 
                        items.some(i => i === 'M&T Representative')) {
                      return 'سب ڈویژنل چیکنگ ٹیم بمعہ نمائندہ ایم اینڈ ٹی';
                    }
                    return items.map(item => localTranslateToUrdu(item)).reduce((acc, current, idx) => {
                      if (idx === 0) return current;
                      const trimmedCurrent = current.trim();
                      if (trimmedCurrent.startsWith('ہمراہ') || trimmedCurrent.startsWith('بمعہ')) {
                        return acc + ' ' + trimmedCurrent;
                      }
                      return acc + '، ' + trimmedCurrent;
                    }, '');
                  })();

                  const discrepancyUrdu = data.discrepancy.map(d => {
                    const label = d === 'Meter Slow By' && data.meterSlowBy ? `Meter ${data.meterSlowBy} Slow` : (d === 'Others' && data.remarks ? data.remarks : d);
                    return localTranslateToUrdu(label);
                  }).join('، ');

                  const formattedCheckingDate = data.dateOfChecking ? formatDate(data.dateOfChecking) : '۔۔۔۔۔۔۔۔۔۔۔۔';

                  return (
                    <div className="text-justify leading-[1.6]">
                      <p>
                        رپورٹ کی جاتی ہے کہ مورخہ <span className="inline-block font-bold" dir="ltr">{formattedCheckingDate}</span> کو دورانِ معمول چیکنگ، <span className="font-bold">{checkingTeamUrdu}</span> نے کنکشن بنام <span className="font-bold">{data.nameUrdu || localTranslateToUrdu(data.name)}</span>، حوالہ نمبر <span className="font-bold px-1">{data.referenceNumber}</span>، واقعہ <span className="font-bold">{data.addressUrdu || localTranslateToUrdu(data.address)}</span> کو چیک کیا۔
                      </p>
                      <p className="mt-2">
                        چیکنگ کے دوران یہ مشاہدہ کیا گیا کہ مذکورہ کنکشن پر حال قابض <span className="font-bold">{cleanName}</span> {(!discrepancyUrdu.includes('رہا تھا') && !discrepancyUrdu.includes('کر لیا ہے') && !discrepancyUrdu.includes('کرلیا ہے')) || discrepancyUrdu.includes('میٹرباڈی') || discrepancyUrdu.includes('میٹر ریورس') || discrepancyUrdu.includes('سپلائی') || discrepancyUrdu.includes('ڈسپلے') || discrepancyUrdu.includes('جلا دیا') ? 'نے ' : ''}<span className="font-bold text-red-700">{discrepancyUrdu}</span> {discrepancyUrdu.endsWith('۔') || discrepancyUrdu.includes('پائے گئے') || discrepancyUrdu.includes('جا رہی تھی') || discrepancyUrdu.includes('جاری تھا') ? '' : (discrepancyUrdu.includes('تھا') || discrepancyUrdu.includes('تھی') || discrepancyUrdu.includes('گیا') || discrepancyUrdu.includes('ہے') ? '۔' : 'لگا رکھی تھی۔ ')} {discrepancyUrdu.includes('بجلی استعمال') || discrepancyUrdu.includes('بجلی چوری') || discrepancyUrdu.includes('پائے گئے') || discrepancyUrdu.includes('جا رہی تھی') || discrepancyUrdu.includes('جاری تھا') || discrepancyUrdu.includes('واش') || discrepancyUrdu.includes('جلا دیا') ? '' : 'جس کی وجہ سے بجلی چوری کی جا رہی تھی۔'}
                      </p>
                      <p className="mt-3">
                        مذکورہ بالا عمل کے نتیجے میں حال قابض <span className="font-bold">{cleanName}</span> بجلی چوری کا مرتکب پایا گیا، جس سے محکمہ لیسکو کو تقریباً <span className="font-bold px-1">{data.lossAmount ? Number(data.lossAmount).toLocaleString() : '۔۔۔۔۔'}</span> روپے کا مالی نقصان پہنچا۔
                      </p>
                      <p className="mt-3">
                        لہٰذا استدعا کی جاتی ہے کہ حال قابض <span className="font-bold">{cleanName}</span> کے خلاف بجلی چوری کے جرم کے تحت قانونی کارروائی عمل میں لاتے ہوئے مقدمہ درج کیا جائے اور ایف آئی آر کی نقل برائے ریکارڈ و مزید کارروائی زیرِ دستخطی کو ارسال کی جائے۔
                      </p>
                    </div>
                  );
                })()}

                <div className="pt-1 break-inside-avoid">
                    <h3 className="inline-block px-1 mb-1 text-[15pt] font-bold urdu-font border-b border-black">گواہان:</h3>
                    <ul className="list-decimal pr-12 space-y-1">
                        {(data.witnesses || []).length > 0 ? (data.witnesses || []).map((w, i) => <li key={i} className="font-medium text-[13pt]">{localTranslateToUrdu(w)}</li>) : (
                          <>
                            <li className="text-[13pt]">۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</li>
                            <li className="text-[13pt]">۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</li>
                          </>
                        )}
                    </ul>
                </div>

                <div className="pt-2 flex flex-col break-inside-avoid">
                    <div className="flex flex-col items-center w-fit mr-auto ml-10 leading-snug">
                        <p className="font-bold mb-1 text-[15pt]">خیر اندیش:</p>
                        <div className="mt-14 flex flex-col items-center space-y-1">
                            <p className="font-bold text-[16pt]">{localTranslateToUrdu(data.employeeName) || '۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔'}</p>
                            <p className="text-[14pt]">{localTranslateToUrdu(data.employeeDesignation) || 'اِسسٹنٹ مینیجر (آپریشن)'} لیسکو کوٹ رادھاکشن سب ڈویژن نمبر۔۱</p>
                            <p className="text-[11pt] text-gray-700">شناختی کارڈ نمبر: <span dir="ltr">{data.employeeCnic || '35102-0565965-3'}</span></p>
                            <p className="text-[11pt] text-gray-700">موبائل نمبر: <span dir="ltr">{data.employeeMobile || '0370-4991751'}</span></p>
                        </div>
                    </div>

                    <div className="text-right space-y-1 mt-4">
                        <p className="font-bold mb-1 text-[11pt]">کاپی برائے اطلاع:</p>
                        <ul className="list-none pr-4 space-y-1 text-[10pt]">
                             <li>1۔ جناب ڈپٹی مینیجر صاحب (آپریشن) لیسکو ڈویژن کوٹ رادہاکشن </li>
                            <li>2۔ جناب ڈی۔پی۔او صاحب قصور</li>
                            <li>3۔ جناب ڈی۔ایس۔پی صاحب صدر سرکل قصور</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        {/* Seizure Memo Page */}
        {hasSeizureMemo && (
          <div className="print-page w-full md:w-[210mm] mx-auto p-4 md:p-[25.4mm] text-black bg-white urdu-font" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
            <div className="text-center mb-6 space-y-1">
                <h2 className="text-[18pt] font-bold urdu-font">لاہور الیکٹرک سپلائی کمپنی لمیٹڈ (لیسکو)</h2>
                <p className="text-[15pt] font-bold">دفتر اِسسٹنٹ مینیجر (آپریشن) لیسکو کوٹ رادھاکشن سب ڈویژن نمبر۔۱</p>
                <p className="text-[11pt]">132 کے وی گریڈ اسٹیشن کوٹ رادھاکشن   <span dir="ltr">049-2382776</span> ☎</p>
                <div className="mt-4">
                    <h3 className="text-[16pt] font-bold inline-block px-6 py-1 urdu-font border-b-2 border-black">فرد مقبوضگی</h3>
                </div>
            </div>

            <div className="mt-6 space-y-4">
                <div className="space-y-2">
                    <p>کنکشن بنام: <span className="font-bold px-2">{data.nameUrdu || localTranslateToUrdu(data.name)}</span> &nbsp;&nbsp;&nbsp;&nbsp; بحوالہ نمبر: <span className="font-bold px-2">{data.referenceNumber}</span></p>
                    <p>حال قابض: <span className="font-bold px-2">{data.presentOccupierUrdu || localTranslateToUrdu(data.presentOccupier || data.name)}</span> &nbsp;&nbsp;&nbsp;&nbsp; ساکن: <span className="font-bold px-2">{data.addressUrdu || localTranslateToUrdu(data.address)}</span></p>
                </div>

                <div className="grid grid-cols-3 gap-4 border-y-2 border-black py-4 bg-gray-50/50">
                  <div className="text-center">
                      <p className="text-[11pt] text-gray-600 mb-1 font-bold">سائز تار</p>
                      <p className="font-bold text-[15pt]">{localTranslateToUrdu(data.seizureCableSize)}</p>
                   </div>
                  <div className="text-center border-x-2 border-black">
                      <p className="text-[11pt] text-gray-600 mb-1 font-bold">رنگ</p>
                      <p className="font-bold text-[15pt]">{localTranslateToUrdu(data.seizureCableColor)}</p>
                  </div>
                  <div className="text-center">
                      <p className="text-[11pt] text-gray-600 mb-1 font-bold">لمبائی</p>
                      <p className="font-bold text-[15pt]">{localTranslateToUrdu(data.seizureCableLength)}</p>
                  </div>
                </div>
                
                <div className="mt-4 text-justify leading-[1.6]">
                    <p className="indent-10">
                        مندرجہ بالا کنکشن کی چیکنگ کے دوران جو تار بجلی چوری کے لیے استعمال ہو رہی تھی، اسے قبضہ میں لے کر اس کی فردِ مقبوضگی تیار کی گئی۔ مذکورہ تار کو موقع پر موجود گواہان کی موجودگی میں باقاعدہ طور پر سیل کر دیا گیا ہے اور قانونی کارروائی کے لیے محفوظ تحویل میں رکھا گیا ہے۔ مزید قانونی کارروائی کے لیے اسے پولیس کے حوالے کیا جاتا ہے تاکہ بوقتِ شہادت عدالتِ عالیہ میں پیش کیا جا سکے۔
                    </p>
                </div>

                <div className="mt-2 break-inside-avoid">
                    <h3 className="inline-block px-1 mb-2 text-[15pt] font-bold urdu-font border-b-2 border-black">گواہان:</h3>
                    <ul className="list-decimal pr-12 space-y-2 font-bold">
                        {(data.witnesses || []).length > 0 ? (data.witnesses || []).map((w, i) => <li key={i} className="text-[14pt]">{localTranslateToUrdu(w)}</li>) : (
                          <>
                            <li className="text-gray-400">۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</li>
                            <li className="text-gray-400">۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</li>
                          </>
                        )}
                    </ul>
                </div>

                <div className="flex justify-end pt-4 break-inside-avoid">
                    <div className="flex flex-col items-center w-fit leading-snug p-2">
                        <p className="font-bold mb-1 text-[15pt]">خیر اندیش:</p>
                        <div className="mt-14 flex flex-col items-center space-y-1">
                          <p className="font-bold text-[16pt]">{localTranslateToUrdu(data.employeeName) || '۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔'}</p>
                          <p className="text-[13pt] font-bold">{localTranslateToUrdu(data.employeeDesignation) || 'اِسسٹنٹ مینیجر (آپریشن)'} لیسکو کوٹ رادھاکشن سب ڈویژن نمبر۔۱</p>
                          <p className="text-[11pt] text-gray-700">شناختی کارڈ نمبر: <span dir="ltr">{data.employeeCnic || '35102-0565965-3'}</span></p>
                          <p className="text-[11pt] text-gray-700">موبائل نمبر: <span dir="ltr">{data.employeeMobile || '0370-4991751'}</span></p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFIRRequest = () => (
    <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[11px] md:text-[12px] leading-relaxed p-6 md:p-[20mm]">
      <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
        <div className="text-center flex-1">
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">FIR REQUEST</h1>
          <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
          <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
          <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
          <p className="font-bold text-[9px] flex items-center justify-center gap-1">
            <span className="text-xs">☎</span> <span dir="ltr">049-2382776</span>
          </p>
        </div>
        {renderQRCode()}
      </div>

      <div className="flex justify-between items-start mb-8">
        <div className="text-[10px] md:text-sm">
          <p>To : -</p>
          <p className="font-bold">The SHO : -</p>
          <p>Police Station : - <span className="border-b border-black whitespace-nowrap text-black font-bold">{(data.firNo && !data.registeredFirNo) ? (
            <>
              {data.policeStation || '____________________'}
            </>
          ) : (data.policeStation || '____________________')}</span>,</p>
          <p>Lahore : -</p>
        </div>
        <div className="text-[10px] md:text-sm text-right">
          <p><span className="font-bold">Dated : -</span> {`${new Date().getDate().toString().padStart(2, '0')}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getFullYear()}`}</p>
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-lg md:text-xl font-bold uppercase font-sans">Subject : - REQUEST FOR REGISTRATION OF FIR AGAINST ELECTRICITY THEFT</h1>
      </div>

      <div className="text-[10px] md:text-sm space-y-6 leading-relaxed">
        <p>Respected Sir,</p>
        
        <p className="indent-4 md:indent-8">
          I, <span className="font-bold border-b border-black text-black">{data.employeeName}</span>, working as <span className="font-bold border-b border-black text-black">{data.employeeDesignation}</span> in LESCO, state that on <span className="font-bold border-b border-black text-black">{formatDate(data.dateOfChecking)}</span>, a checking team comprising of <span className="font-bold border-b border-black text-black">{Array.isArray(data.checkedBy) ? data.checkedBy.join(', ') : data.checkedBy}</span> visited the premises of <span className="font-bold border-b border-black text-black">{data.name}</span> located at <span className="font-bold border-b border-black text-black">{data.address}</span>.
        </p>

        <p className="indent-4 md:indent-8">
          During the inspection, it was observed that the accused was stealing electricity directly from the LESCO lines/meter by means of: <span className="font-bold border-b border-black text-black">{formatDiscrepancies(data.discrepancy)}</span>.
        </p>

        <p className="indent-4 md:indent-8">
          The connected load at the time of checking was found to be <span className={cn("font-bold border-b border-black whitespace-nowrap", parseFloat(data.connectedLoad?.toString().replace(/[^0-9.]/g, '') || '0') > 6 ? "text-black animate-blink" : "text-black")}>{data.connectedLoad}{data.connectedLoad && !data.connectedLoad.toString().toUpperCase().includes('KW') ? '-KW' : ''}</span> against a sanctioned load of <span className="font-bold border-b border-black whitespace-nowrap text-black font-bold">{data.sanctionLoad}{data.sanctionLoad && !data.sanctionLoad.toString().toUpperCase().includes('KW') ? '-KW' : ''}</span>. The meter reading was <span className="font-bold border-b border-black whitespace-nowrap text-black font-bold">{formatBillLabel(data.presentReadingAtSite || data.presentReading)}</span>.
        </p>

        <p className="indent-4 md:indent-8">
          This act has caused a significant financial loss to the national exchequer. It is requested that an FIR may kindly be registered against the accused under Section 39-A of the Electricity Act 1910.
        </p>

        <p>Evidence including photos and the tempered meter (if any) are available for your inspection.</p>
      </div>

      <div className="mt-12 md:mt-24 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8 sm:gap-0">
        <div className="text-[10px] md:text-sm">
          <p className="font-bold">Witnesses : -</p>
          {data.witnesses.map((w, i) => (
            <p key={i}>{i + 1}. <span className="border-b border-black whitespace-nowrap text-black font-bold">{w || '____________________________'}</span></p>
          ))}
          {data.witnesses.length === 0 && (
            <>
              <p>1. ____________________________</p>
              <p>2. ____________________________</p>
            </>
          )}
        </div>
        <div className="text-center leading-tight">
          <div className="border-t border-black w-48 mb-1 mx-auto"></div>
          <p className="text-[10px] md:text-sm font-bold uppercase">{data.employeeName}</p>
          <p className="text-[8px] md:text-xs font-bold">{data.employeeDesignation}</p>
          <p className="text-[8px] md:text-xs font-bold">LESCO</p>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={ref} className="print-container">
      {type === 'DETECTION BILL PROFORMA' && renderDetectionBill()}
      {type === 'NOTICE' && renderNotice()}
      {type === 'FIR Request' && renderFIRRequest()}
      {type === 'FIR Urdu' && renderFIRUrdu()}
      {type === 'Detection Register' && renderDetectionBill()} {/* Fallback */}
    </div>
  );
});

ProformaTemplates.displayName = 'ProformaTemplates';
