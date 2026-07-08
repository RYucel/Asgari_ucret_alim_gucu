import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  ArrowRightLeft,
  TrendingDown,
  TrendingUp,
  Wallet,
  FileSpreadsheet,
  Info,
  BarChart3
} from 'lucide-react';
import { cn } from './lib/utils';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// We map common items to clean names and units.
// Using fallbacks if actual columns differ slightly.
const ITEMS_TO_COMPARE = [
  { key: 'Ekmek', label: 'Ekmek', unit: 'Adet' },
  { key: 'Dana Eti (Taze)', label: 'Dana Eti', unit: 'Kg' },
  { key: 'Süt', label: 'Süt', unit: 'Litre' },
  { key: 'Tavuk Yumurtası', label: 'Yumurta', unit: 'Adet' },
  { key: 'Ayçiçek Yağı', label: 'Ayçiçek Yağ', unit: 'Litre' },
  { key: 'Toz Şeker', label: 'Toz Şeker', unit: 'Kg' },
  { key: 'Patates', label: 'Patates', unit: 'Kg' },
  { key: 'Pirinç', label: 'Pirinç', unit: 'Kg' },
  { key: 'Benzin', label: 'Benzin', unit: 'Litre' },
  { key: 'Elektrik Ücreti (Fatura)', label: 'Elektrik Faturası', unit: 'Adet' },
  { key: 'Su (Şebeke Suyu)', label: 'Su Faturası', unit: 'Adet' },
  { key: 'Kira Ücreti', alias: 'TC_Kira', label: 'Ev Kirası', unit: 'Ay' },
];

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [minWageData, setMinWageData] = useState<any[]>([]);
  const [period1, setPeriod1] = useState<string>('');
  const [period2, setPeriod2] = useState<string>('');

  useEffect(() => {
    // Load CPI Basket Data
    fetch('/GRETL_TUFE.csv')
      .then(res => res.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              setData(results.data as any[]);
              const validDates = results.data.map((d: any) => d.Tarih).filter(Boolean);
              if (validDates.length > 0) {
                setPeriod1(validDates[0]);
                setPeriod2(validDates[validDates.length - 1]);
              }
            }
          }
        });
      })
      .catch(console.error);

    // Load Min Wage 1977-2025 Data
    fetch('/Asgari_ücret-GBP_1977-2025.csv')
      .then(res => res.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              // Trim to 2015 and onwards ("Jan-15" is the start)
              const dataAny = results.data as any[];
              const startIndex = dataAny.findIndex((d) => d.Date === 'Jan-15');
              const trimmed = startIndex !== -1 ? dataAny.slice(startIndex) : dataAny;
              const processed = trimmed.map(d => {
                const rawWageStr = String(d['Min Wage'] !== undefined && d['Min Wage'] !== null ? d['Min Wage'] : '').trim().replace(/,/g, '');
                const rawUSDTLStr = String(d.USDTL !== undefined && d.USDTL !== null ? d.USDTL : '').trim().replace(/,/g, '');
                
                const wageNum = parseFloat(rawWageStr);
                const usdtlNum = parseFloat(rawUSDTLStr);
                
                return {
                  ...d,
                  'Min Wage': !isNaN(wageNum) ? wageNum / 1000000 : 0,
                  USDTL: !isNaN(usdtlNum) ? usdtlNum / 1000000 : 0
                };
              });
              setMinWageData(processed);
            }
          }
        });
      })
      .catch(console.error);
  }, []);

  // Extract available dates for dropdowns
  const availableDates = useMemo(() => {
    return data.map((d) => d.Tarih).filter(Boolean);
  }, [data]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setData(results.data as any[]);
          const validDates = results.data.map((d: any) => d.Tarih).filter(Boolean);
          if (validDates.length > 0) {
            setPeriod1(validDates[0]);
            setPeriod2(validDates[validDates.length - 1]);
          }
        }
      },
    });
  };

  const getRecord = (date: string) => data.find((d) => d.Tarih === date);

  const record1 = getRecord(period1);
  const record2 = getRecord(period2);

  const getVal = (record: any, key: string, alias?: string) => {
    if (!record) return null;
    let val = record[key];
    if (val === undefined && alias !== undefined) val = record[alias];
    return typeof val === 'number' ? val : null;
  };

  const getAsgariUcret = (record: any) => {
    if (record?.AsgariUcret !== undefined && record?.AsgariUcret !== null && String(record.AsgariUcret).trim() !== '') {
      return parseFloat(record.AsgariUcret);
    }
    
    if (minWageData && minWageData.length > 0 && record?.Tarih) {
      const parts = record.Tarih.split('/');
      if (parts.length === 3) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        const year = parts[2].substring(2);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const target = `${months[monthIdx]}-${year}`;
        const match = minWageData.find(m => m.Date === target);
        if (match && match['Min Wage']) return match['Min Wage'];
      }
    }
    return 0;
  };

  const getOverallVerdict = () => {
    if (!record1 || !record2) return null;
    let totalChange = 0;
    let count = 0;
    ITEMS_TO_COMPARE.forEach(item => {
      const p1 = getVal(record1, item.key, item.alias);
      const p2 = getVal(record2, item.key, item.alias);
      if (p1 && p2) {
        const asgari1 = getAsgariUcret(record1);
        const asgari2 = getAsgariUcret(record2);
        if (asgari1 > 0 && asgari2 > 0) {
          const qty1 = asgari1 / p1;
          const qty2 = asgari2 / p2;
          totalChange += ((qty2 - qty1) / qty1) * 100;
          count++;
        }
      }
    });

    if (count === 0) return null;
    const avgChange = totalChange / count;
    
    return {
      avgChange: parseFloat(avgChange.toFixed(1)),
      verdictText: avgChange >= 0 
        ? "Mevcut asgari ücretin genel alım gücü önceki döneme göre daha yüksektir." 
        : "Mevcut asgari ücretin genel alım gücü önceki döneme göre azalmıştır."
    };
  };

  const verdict = getOverallVerdict();

  // Generate chart data
  const chartData = useMemo(() => {
    if (!record1 || !record2) return [];
    
    // We only want to plot items that are somewhat comparable in scale, 
    // or we can just let users see the difference via the tooltip.
    // For better visibility on the same chart, we plot the % change instead.
    
    return ITEMS_TO_COMPARE.map(item => {
      const p1 = getVal(record1, item.key, item.alias);
      const p2 = getVal(record2, item.key, item.alias);
      if (!p1 || !p2) return null;

      const asgari1 = getAsgariUcret(record1);
      const asgari2 = getAsgariUcret(record2);
      if (!asgari1 || !asgari2) return null;

      const qty1 = asgari1 / p1;
      const qty2 = asgari2 / p2;
      const pctChange = ((qty2 - qty1) / qty1) * 100;
      
      return {
        name: item.label,
        'Dönem 1': Math.floor(qty1),
        'Dönem 2': Math.floor(qty2),
        'Değişim %': parseFloat(pctChange.toFixed(1))
      };
    }).filter(Boolean);
  }, [record1, record2]);

  const minWageChartData = useMemo(() => {
    return minWageData.map(d => ({
      name: d.Date,
      'Asgari Ücret (₺)': d['Min Wage'],
      'Asgari Ücret ($)': d.USDTL && d.USDTL > 0 ? parseFloat((d['Min Wage'] / d.USDTL).toFixed(2)) : null
    })).filter(d => Boolean(d['Asgari Ücret (₺)']));
  }, [minWageData]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Asgari Ücret Alım Gücü</h1>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-2">İki dönem arası satın alma gücü kıyaslaması</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 md:mt-0 text-right">
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors text-white text-xs uppercase tracking-widest font-bold py-2 px-4 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            CSV Yükle
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        <div className="grid grid-cols-12 gap-4 mb-8">
          <div className="col-span-12 md:col-span-5 bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">1. Dönem Seçimi</span>
            <div className="flex justify-between items-center mt-2">
              <select
                value={period1}
                onChange={(e) => setPeriod1(e.target.value)}
                className="w-1/2 bg-transparent border-none text-slate-900 font-bold text-2xl outline-none cursor-pointer"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              {record1?.AsgariUcret && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Net Ücret</p>
                  <p className="text-lg font-mono font-bold">₺{record1.AsgariUcret.toLocaleString('tr-TR')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex col-span-2 items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <span className="text-xl font-bold italic font-serif">vs</span>
            </div>
          </div>

          <div className="col-span-12 md:col-span-5 bg-white border border-slate-300 p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">2. Dönem Seçimi</span>
            <div className="flex justify-between items-center mt-2">
              <select
                 value={period2}
                 onChange={(e) => setPeriod2(e.target.value)}
                 className="w-1/2 bg-transparent border-none text-slate-900 font-bold text-2xl outline-none cursor-pointer"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              {record2?.AsgariUcret && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Net Ücret</p>
                  <p className="text-lg font-mono font-bold">₺{record2.AsgariUcret.toLocaleString('tr-TR')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {record1 && record2 ? (
          <>
            {minWageChartData.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-800">Asgari Ücretin Yıllara Göre Değişimi (2015 - 2025)</h2>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={minWageChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(val) => `₺${val}`}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="Asgari Ücret (₺)" stroke="#4f46e5" strokeWidth={3} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="Asgari Ücret ($)" stroke="#10b981" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">Alım Gücü Değişim Yüzdeleri</h2>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="Değişim %" 
                      fill="#4f46e5" 
                      radius={[4, 4, 4, 4]} 
                      name="Değişim (%)"
                    >
                      {
                        chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry['Değişim %'] >= 0 ? '#10b981' : '#f43f5e'} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 px-4">
                <div className="col-span-4">Miktar ({period1})</div>
                <div className="col-span-4 text-center">Temel Gıda / Hizmet</div>
                <div className="col-span-4 text-right">Miktar ({period2})</div>
              </div>
              
              <div className="space-y-4">
                {ITEMS_TO_COMPARE.map((item) => {
                  const p1 = getVal(record1, item.key, item.alias);
                  const p2 = getVal(record2, item.key, item.alias);
                  
                  if (!p1 || !p2) return null;

                  const asgari1 = getAsgariUcret(record1);
                  const asgari2 = getAsgariUcret(record2);
                  
                  if (!asgari1 || !asgari2) return null;

                  const qty1 = asgari1 / p1;
                  const qty2 = asgari2 / p2;
                  
                  const pctChange = ((qty2 - qty1) / qty1) * 100;
                  const isPositive = pctChange > 0;
                  const isNegative = pctChange < 0;

                  const maxQty = Math.max(qty1, qty2);
                  const w1 = Math.max((qty1 / maxQty) * 100, 2);
                  const w2 = Math.max((qty2 / maxQty) * 100, 2); 
                  
                  const rightBarColor = isPositive ? "bg-emerald-500" : isNegative ? "bg-rose-500" : "bg-slate-900";
                  const rightTextColor = isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-slate-900";

                  return (
                    <div key={item.key} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white border border-slate-200 p-4 shadow-sm">
                      <div className="md:hidden flex justify-between items-center w-full border-b pb-2 mb-2">
                         <span className="font-bold text-lg">{item.label}</span>
                         <span className="text-[10px] text-slate-500">Birim: {item.unit} | {p1.toFixed(2)}₺ ➔ {p2.toFixed(2)}₺</span>
                      </div>

                      <div className="col-span-1 md:col-span-4 flex items-center justify-between md:justify-start gap-4">
                        <span className="text-3xl font-mono font-bold text-slate-400">{Math.floor(qty1).toLocaleString('tr-TR')}</span>
                        <div className="h-2 w-full md:w-full bg-slate-100 rounded-full overflow-hidden flex justify-end">
                          <div className="h-full bg-slate-400" style={{ width: `${w1}%` }}></div>
                        </div>
                      </div>

                      <div className="hidden md:flex col-span-4 flex-col items-center text-center">
                        <span className="font-bold text-lg">{item.label}</span>
                        <span className="text-[10px] text-slate-500">Birim: {item.unit} | {p1.toFixed(2)}₺ ➔ {p2.toFixed(2)}₺</span>
                      </div>

                      <div className="col-span-1 md:col-span-4 flex items-center justify-between md:justify-end gap-4">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${rightBarColor}`} style={{ width: `${w2}%` }}></div>
                        </div>
                        <span className={`text-3xl font-mono font-bold ${rightTextColor}`}>{Math.floor(qty2).toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white border border-dashed rounded-3xl">
             <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-500 font-medium">Veri bulunamadı. Lütfen CSV formatında dosya yükleyin.</p>
          </div>
        )}
      </main>

      {verdict && (
        <footer className="mt-8 p-6 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
          <div>
            <h3 className="text-sm uppercase tracking-widest font-bold text-slate-400">Ekonomik Nabız Sonucu</h3>
            <p className="text-2xl font-light italic font-serif mt-1">{verdict.verdictText}</p>
          </div>
          <div className="text-right border-l border-slate-700 pl-8 w-full md:w-auto">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Ortalama Değişim</p>
            <div className={cn("text-4xl font-black", verdict.avgChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {verdict.avgChange > 0 ? '+' : ''}{verdict.avgChange}%
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
