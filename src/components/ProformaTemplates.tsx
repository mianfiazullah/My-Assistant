import { forwardRef } from 'react';
import { cn } from '../lib/utils';
import { BillData, MonthWiseUnit, LoadItem } from '../types';
import { QRCodeSVG } from 'qrcode.react';

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
}

export const ProformaTemplates = forwardRef<HTMLDivElement, ProformaProps>(({ type, data }, ref) => {
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
    <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] min-h-[297mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[10px] md:text-[11px] leading-tight p-6 md:p-[20mm]">
      <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
        <div className="text-center flex-1">
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">DETECTION BILL PROFORMA</h1>
          <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
          <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
          <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
          <p className="font-bold text-[9px] flex items-center justify-center gap-1">
            <span className="text-xs">☎</span> 049-2382776
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
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Present Reading : -</span><span className="border-b border-black whitespace-nowrap text-black">{formatBillLabel(data.presentReadingAtSite)}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Meter No : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterNumber}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Make : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterMake}</span></div>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Type : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.meterType}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Capacity : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.capacity}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Meter Status : -</span><span className={cn("border-b border-black whitespace-nowrap", (data.meterStatus?.toUpperCase()?.includes('REPLACED') || data.meterStatus?.toUpperCase() === 'DF') ? "text-red-600" : "text-black")}>{formatBillLabel(data.meterStatus)}</span></div>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Notice No : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.noticeNo}</span></div>
          <div className="flex gap-3 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Dated : -</span><span className="border-b border-black whitespace-nowrap text-black">{formatDate(data.noticeDated)}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap">FIR Request Vide T/O No. : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.firNo}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap">FIR Request T/O Dated : -</span><span className="border-b border-black whitespace-nowrap text-black">{formatDate(data.firDated)}</span></div>
        </div>
        <div className="flex justify-start gap-4">
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Registered FIR No. : -</span><span className="border-b border-black whitespace-nowrap text-black">{data.registeredFirNo}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Dated : -</span><span className="border-b border-black whitespace-nowrap text-black">{formatDate(data.registeredFirDated)}</span></div>
          <div className="flex gap-1 items-end min-w-0 font-bold"><span className="whitespace-nowrap">Name Of Police Station : -</span><span className="border-b border-black whitespace-nowrap text-black overflow-hidden">{(data.firNo && !data.registeredFirNo) ? (
            <>
              {data.policeStation || '____________________'} <span className="text-red-600">(PENDING FIR)</span>
            </>
          ) : (data.policeStation || '____________________')}</span></div>
        </div>
        <div className="flex gap-3 items-start">
          <span className="whitespace-nowrap font-bold">Discrepancy : -</span>
          <span className={cn("border-b border-black font-bold inline", formatDiscrepancies(data.discrepancy).toUpperCase().includes('REPLACED') ? "text-red-600" : "text-black")}>{formatDiscrepancies(data.discrepancy)}</span>
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
      <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] min-h-[297mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[10px] md:text-[11px] leading-tight flex flex-col p-6 md:p-[20mm]">
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-2">
          <div className="text-center flex-1">
            <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">NOTICE</h1>
            <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
            <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
            <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
            <p className="font-bold text-[9px] flex items-center justify-center gap-1">
              <span className="text-xs">☎</span> 049-2382776
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
            <span className="border-b border-black text-black font-bold uppercase">{data.name}</span>
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

  const renderFIRUrdu = () => (
    <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] min-h-[297mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[12px] leading-relaxed p-6 md:p-[20mm]" dir="rtl">
        <div className="text-center font-bold mb-6">
            <h1 className="text-xl">لاہور الیکٹرک سپلائی کمپنی لمیٹڈ (لیسکو)</h1>
            <p>دفتر اِسسٹنٹ مینیجر (آپریشن ) لیسکو کوٹ رادھا کشن سب ڈویژن نمبر۔۱</p>
            <p>0492-382776, 0492-385671, sdokrk1@gmail.com</p>
        </div>
        
        <div className="text-right space-y-2">
            <p>چھٹی نمبری: <span className="border-b border-black">{data.firNo || '۔۔۔۔۔۔'}</span></p>
            <p>بتاریخ: <span className="border-b border-black">{formatDate(data.firDated)}</span></p>
            <p>از طرف: اِسسٹنٹ مینیجر آپریشن لیسکو کوٹ رادھا کشن سب ڈویژن نمبر۔۱</p>
            <p>بطرف: جناب ایس۔ایچ ۔ او صاحب تھانہ {data.policeStation || '۔۔۔۔۔۔'} ضلع قصور</p>
            <p className="font-bold border-b border-black">عنوان: اندراج مقدمہ بابت بجلی چوری زیرِ دفعہ 462-I الیکٹریسٹی ایکٹ 2016</p>
            <p>رپورٹ کی جاتی ہے کہ آج مؤرخہ {formatDate(data.dateOfChecking)} کو دورانِ معمول چیکنگ سب ڈویژنل چیکنگ ٹیم ہمراہ {Array.isArray(data.checkedBy) ? data.checkedBy.join(', ') : data.checkedBy} نے کنکشن بجلی بحوالہ نمبر {data.referenceNumber} بنام {data.name} سکنہ {data.address} چیک کیا۔ تو پایا کہ صارف / حال مقیم {data.name} نے واپڈا کی L.T لائن / مین کیبل سے ڈائریکٹ کنڈا لگا کر بجلی چوری کر رہا تھا۔ اس طرح صارف/حال مقیم شخص ہزاروں روپے کی بجلی چوری کا مرتکب پایا گیا اور صارف نے واپڈا کو تقریباً {data.lossAmount || '۔۔۔۔۔'} روپے کا نقصان پہنچایا ہے۔</p>
            <p>لہٰذا مندرجہ بالا صارف / حال مقیم کے خلاف بجلی چوری کرنے کے جرم میں مقدمہ درج کر کے FIR کی کاپی زیرِ دستخطی کو ارسال کی جائے۔</p>
        </div>
        
        <div className="mt-8">
            <h3 className="font-bold">گواہان:</h3>
            <ul className="list-decimal pr-5">
                {(data.witnesses || []).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
        </div>
        
        <div className="mt-8 text-left font-bold">
            <p>اِنجینئر محبوب عالم</p>
            <p>اِسسٹنٹ مینیجر آپریشن لیسکو کوٹ رادھا کشن سب ڈویژن نمبر۔۱</p>
        </div>

        {/* Seizure Memo */}
         <div className="mt-12 border-t pt-4">
            <h2 className="text-center font-bold text-lg">فرد مقبوضگی</h2>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <p>کنکشن بجلی بحوالہ نمبر: {data.referenceNumber}</p>
                <p>بنام: {data.name}</p>
                <p>سائز تار: {data.seizureCableSize || '۔۔۔۔۔'}</p>
                <p>رنگ: {data.seizureCableColor || '۔۔۔۔۔'}</p>
                <p>لمبائی: {data.seizureCableLength || '۔۔۔۔۔'}</p>
            </div>
         </div>
    </div>
  );

  const renderFIRRequest = () => (
    <div className="print-page bg-white text-black font-sans w-full md:w-[210mm] min-h-[297mm] mx-auto border border-neutral-200 md:border-none shadow-sm md:shadow-none text-[11px] md:text-[12px] leading-relaxed p-6 md:p-[20mm]">
      <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
        <div className="text-center flex-1">
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest font-sans">FIR REQUEST</h1>
          <p className="text-[9px] font-bold">LAHORE ELECTRIC SUPPLY COMPANY LIMITED</p>
          <p className="text-[8px] font-bold">OFFICE OF THE ASSISTANT MANAGER (OPERATION)</p>
          <p className="text-[8px] font-bold uppercase">KOT RADHA KISHAN-1 SUB DIVISION LESCO</p>
          <p className="font-bold text-[9px] flex items-center justify-center gap-1">
            <span className="text-xs">☎</span> 049-2382776
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
              {data.policeStation || '____________________'} <span className="text-red-600">(PENDING FIR)</span>
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
