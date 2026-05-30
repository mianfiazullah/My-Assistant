import { safeStringify } from "../lib/safeStringify";
import { generateGeminiContent } from "../lib/gemini";
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { FeederReading } from '../types';
import { Zap, Calendar, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

async function generateAIContent(prompt: string): Promise<string> {
  try {
    const text = await generateGeminiContent(prompt);
    return text || 'N/A';
  } catch (err) {
    console.error("AI Generation Error:", err);
    return 'N/A';
  }
}

const FEEDER_OPTIONS = [
  "Kasur Road",
  "Handal",
  "KRK/City-II",
  "Kot Radha Kishan",
  "MICT",
  "Raiwind Rod-II",
  "Poly Pack-II",
  "Add New Feeder"
];

export default function FeederMonitoring() {
  const [selectedFeeder, setSelectedFeeder] = useState(FEEDER_OPTIONS[0]);
  const [feederName, setFeederName] = useState('');
  const [reading, setReading] = useState('');
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [readings, setReadings] = useState<FeederReading[]>([]);
  const [forecast, setForecast] = useState<string | null>(null);

  const currentFeederName = selectedFeeder === 'Add New Feeder' ? feederName : selectedFeeder;

  useEffect(() => {
    fetchReadings();
  }, []);

  const fetchReadings = async () => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'feederReadings'), where('userId', '==', auth.currentUser.uid), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    setReadings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeederReading)));
  };

  const handleAddReading = async () => {
    if (!currentFeederName || !reading || !auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'feederReadings'), {
        feederName: currentFeederName,
        reading: parseFloat(reading),
        date: readingDate + 'T00:00:00Z',
        userId: auth.currentUser.uid
      });
      toast.success('Reading added');
      setReading('');
      fetchReadings();
      generateForecast();
    } catch (e) {
      toast.error('Failed to add reading');
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    if (readings.length < 5) return;
    const prompt = `Based on these daily feeder readings: ${safeStringify(readings.slice(0, 10))}, forecast the total progressive units for this month. Return only the number.`;
    const responseText = await generateAIContent(prompt);
    setForecast(responseText);
  };

  const calculateAITentative = async (
    date: string,
    progressive: number,
    progressiveLastYear: number,
    progressiveLastMonth: number,
    tentative: number
  ) => {
    const prompt = `
      Calculate the AI Tentative value for the date ${date}.
      Current Progressive: ${progressive}
      Current Tentative: ${tentative}
      Progressive Last Year: ${progressiveLastYear}
      Progressive Last Month: ${progressiveLastMonth}
      
      Consider the weather temperature conditions for the current month, last month, and last year for the feeder location.
      Return only the number.
    `;
    const responseText = await generateAIContent(prompt);
    return responseText;
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempReading, setTempReading] = useState<number>(0);
  const [tempTentative, setTempTentative] = useState<string>('');
  const [aiTentatives, setAiTentatives] = useState<Record<string, string>>({});

  const saveReading = async (id: string | undefined, date: string) => {
    if (id) {
      const readingRef = doc(db, 'feederReadings', id);
      await updateDoc(readingRef, { reading: tempReading, tentative: tempTentative });
      setReadings(prev => prev.map(r => r.id === id ? { ...r, reading: tempReading, tentative: tempTentative } : r));
    } else {
      await addDoc(collection(db, 'feederReadings'), {
        feederName: currentFeederName || 'Feeder',
        reading: tempReading,
        tentative: tempTentative,
        date: date + 'T00:00:00Z',
        userId: auth.currentUser?.uid
      });
      fetchReadings();
    }
    setEditingId(null);
  };

  const startEdit = (r: FeederReading | undefined, dateStr: string) => {
    setEditingId(dateStr);
    setTempReading(r?.reading || 0);
    setTempTentative(r?.tentative || '');
  };

  const filteredReadings = readings.filter(r => r.feederName === currentFeederName);
  const sortedFilteredReadings = [...filteredReadings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstReading = sortedFilteredReadings.length > 0 ? sortedFilteredReadings[0].reading : 0;
  const now = new Date();
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  const allDates = Array.from({ length: daysInCurrentMonth + 1 }, (_, i) => {
    const d = new Date(lastDayOfLastMonth);
    d.setDate(d.getDate() + i);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return {
      dateStr: `${day}-${month}-${year}`,
      isoDate: d.toISOString().split('T')[0]
    };
  });

  const tableData = allDates.reduce((acc, dateObj, index) => {
    const r = filteredReadings.find(reading => reading.date.startsWith(dateObj.isoDate));
    const readingValue = r?.reading || 0;
    
    if (index === 0) {
      acc.push({ ...dateObj, reading: readingValue, perDay: 0, progressive: 0, tentative: 0, r });
      return acc;
    }

    const prevDateObj = allDates[index - 1];
    const prevReading = filteredReadings.find(reading => reading.date.startsWith(prevDateObj.isoDate))?.reading || 0;
    
    const perDay = (readingValue - prevReading) * 2;
    
    let progressive = 0;
    let tentative = 0;

    if (index === 1) {
      progressive = perDay;
      tentative = perDay * daysInCurrentMonth;
    } else {
      const prevProgressive = acc[index - 1].progressive;
      progressive = prevProgressive + perDay;
      tentative = (prevProgressive + progressive) / 2 * daysInCurrentMonth;
    }

    acc.push({ ...dateObj, reading: readingValue, perDay, progressive, tentative, r });
    return acc;
  }, [] as any[]);

  // Include the first row (31-03-2026) for display
  const displayData = tableData;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Feeder Monitoring</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <h2 className="text-xl font-bold mb-4">Add Daily Reading</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-500">Date</label>
            <input 
              type="date" 
              value={readingDate} 
              onChange={e => setReadingDate(e.target.value)} 
              max={new Date().toISOString().split('T')[0]} 
              className="border p-2 rounded-lg" 
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-500">Feeder</label>
            <select 
              value={selectedFeeder} 
              onChange={e => setSelectedFeeder(e.target.value)} 
              className="border p-2 rounded-lg bg-white min-w-[200px]"
            >
              {FEEDER_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {selectedFeeder === 'Add New Feeder' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-500">Custom Feeder Name</label>
              <input 
                type="text" 
                placeholder="Enter Feeder Name" 
                value={feederName} 
                onChange={e => setFeederName(e.target.value)} 
                className="border p-2 rounded-lg" 
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-500">Reading</label>
            <input type="number" placeholder="Reading" value={reading} onChange={e => setReading(e.target.value)} className="border p-2 rounded-lg" />
          </div>

          <button onClick={handleAddReading} disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg h-[42px] flex items-center justify-center min-w-[80px]">
            {loading ? <Loader2 className="animate-spin size-5" /> : 'Add'}
          </button>
        </div>
      </div>

      {forecast && (
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
          <h3 className="text-base sm:text-lg font-bold text-blue-900">AI Forecast</h3>
          <p className="text-2xl font-bold text-blue-700">{forecast} units</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <h2 className="text-xl font-bold mb-4">{currentFeederName} Feeder</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-4">Date</th>
              <th className="p-4">Present Reading</th>
              <th className="p-4">Per Day</th>
              <th className="p-4">Progressive</th>
              <th className="p-4">Tentative</th>
              <th className="p-4">Progressive Last Year</th>
              <th className="p-4">Difference</th>
              <th className="p-4">Inc/Dec %</th>
              <th className="p-4">Progressive Last Month</th>
              <th className="p-4">Difference</th>
              <th className="p-4">Inc/Dec %</th>
              <th className="p-4">AI Tentative</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((data, index) => {
              const r = data.r;
              const perDay = data.perDay;
              const progressive = data.progressive;
              const tentative = data.tentative;
              
              // Assuming manual entry for Progressive Last Year, using tentative for now as a placeholder
              const progressiveLastYear = r?.progressiveLastYear || 0; 
              const diffLastYear = isNaN(progressive) ? 0 : (progressive - progressiveLastYear);
              const incDecLastYear = progressiveLastYear !== 0 ? ((diffLastYear / progressiveLastYear) * 100).toFixed(1) : '0';
              const formattedIncDec = `${diffLastYear >= 0 ? '+' : ''}${incDecLastYear}%`;

              const progressiveLastMonth = r?.progressiveLastMonth || 0;
              const diffLastMonth = isNaN(progressive) ? 0 : (progressive - progressiveLastMonth);
              const incDecLastMonth = progressiveLastMonth !== 0 ? ((diffLastMonth / progressiveLastMonth) * 100).toFixed(1) : '0';
              const formattedIncDecMonth = `${diffLastMonth >= 0 ? '+' : ''}${incDecLastMonth}%`;

              return (
                <TableRow 
                  key={data.dateStr} 
                  data={data} 
                  r={r} 
                  perDay={perDay} 
                  progressive={progressive} 
                  tentative={tentative} 
                  progressiveLastYear={progressiveLastYear}
                  diffLastYear={diffLastYear}
                  formattedIncDec={formattedIncDec}
                  progressiveLastMonth={progressiveLastMonth}
                  diffLastMonth={diffLastMonth}
                  formattedIncDecMonth={formattedIncDecMonth}
                  editingId={editingId}
                  tempReading={tempReading}
                  setTempReading={setTempReading}
                  tempTentative={tempTentative}
                  setTempTentative={setTempTentative}
                  saveReading={saveReading}
                  startEdit={startEdit}
                  aiTentatives={aiTentatives}
                  setAiTentatives={setAiTentatives}
                  calculateAITentative={calculateAITentative}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableRow({ data, r, perDay, progressive, tentative, progressiveLastYear, diffLastYear, formattedIncDec, progressiveLastMonth, diffLastMonth, formattedIncDecMonth, editingId, tempReading, setTempReading, tempTentative, setTempTentative, saveReading, startEdit, aiTentatives, setAiTentatives, calculateAITentative }: any) {
  return (
    <tr className="border-b">
      <td className="p-4">{data.dateStr}</td>
      <td className="p-4">
        {editingId === data.dateStr ? (
          <input 
            type="number" 
            value={isNaN(tempReading) ? '' : tempReading} 
            onChange={(e) => setTempReading(parseFloat(e.target.value))}
            className="border p-1 rounded w-24"
          />
        ) : (
          r ? (isNaN(r.reading) ? 0 : r.reading) : '-'
        )}
      </td>
      <td className="p-4">{perDay.toFixed(2)}</td>
      <td className="p-4">{isNaN(progressive) ? 0 : progressive.toFixed(2)}</td>
      <td className="p-4">
        {editingId === data.dateStr ? (
          <input 
            type="text" 
            value={tempTentative || ''}
            onChange={(e) => setTempTentative(e.target.value)}
            className="border p-1 rounded w-24" 
            placeholder="Tentative" 
          />
        ) : (
          tentative.toFixed(2)
        )}
      </td>
      <td className="p-4">{progressiveLastYear}</td>
      <td className="p-4">{diffLastYear.toFixed(2)}</td>
      <td className="p-4">{formattedIncDec}</td>
      <td className="p-4">{progressiveLastMonth}</td>
      <td className="p-4">{diffLastMonth.toFixed(2)}</td>
      <td className="p-4">{formattedIncDecMonth}</td>
      <td className="p-4">
        {aiTentatives[data.dateStr] ? (
          aiTentatives[data.dateStr]
        ) : (
          <button 
            onClick={() => {
              setAiTentatives(prev => ({ ...prev, [data.dateStr]: 'Calculating...' }));
              calculateAITentative(data.dateStr, progressive, progressiveLastYear, progressiveLastMonth, tentative)
                .then(val => setAiTentatives(prev => ({ ...prev, [data.dateStr]: val })))
                .catch(() => setAiTentatives(prev => ({ ...prev, [data.dateStr]: 'Error' })));
            }}
            className="bg-purple-600 text-white px-2 py-1 rounded text-xs"
          >
            Calculate
          </button>
        )}
      </td>
      <td className="p-4">
        {editingId === data.dateStr ? (
          <button onClick={() => saveReading(r?.id, data.isoDate)} className="bg-green-600 text-white px-2 py-1 rounded">Save</button>
        ) : (
          <button onClick={() => startEdit(r, data.dateStr)} className="bg-blue-600 text-white px-2 py-1 rounded">{r ? 'Edit' : 'Add'}</button>
        )}
      </td>
    </tr>
  );
}
