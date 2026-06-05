import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Scan, Category, MenuItem } from '../lib/types';
import { Eye, UtensilsCrossed, Grid3X3, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!user) return;
    setScans(db.getScans(user.id));
    setCategories(db.getCategories(user.id));
    setItems(db.getMenuItems(user.id));
  }, [user]);

  if (!user) return null;

  const totalScans = scans.length;
  const totalItems = items.length;
  const totalCategories = categories.length;
  const availableItems = items.filter(i => i.available).length;

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const count = scans.filter(s => s.scannedAt.slice(0, 10) === dayStr).length;
    return { day: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), count, date: dayStr };
  });
  const maxCount = Math.max(...last14.map(d => d.count), 1);

  const stats = [
    { label: 'Total de Scans', value: totalScans, icon: Eye, gradient: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700' },
    { label: 'Itens no Cardápio', value: totalItems, icon: UtensilsCrossed, gradient: 'from-blue-500 to-blue-600', bgLight: 'bg-blue-50', textColor: 'text-blue-700' },
    { label: 'Categorias', value: totalCategories, icon: Grid3X3, gradient: 'from-amber-500 to-amber-600', bgLight: 'bg-amber-50', textColor: 'text-amber-700' },
    { label: 'Disponíveis', value: availableItems, icon: TrendingUp, gradient: 'from-teal-500 to-teal-600', bgLight: 'bg-teal-50', textColor: 'text-teal-700' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">Visão geral do seu cardápio digital</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="card-hover p-5">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} mb-4 shadow-sm`}>
              <stat.icon className="w-5 h-5 text-white" strokeWidth={1.75} />
            </div>
            <p className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">{stat.value}</p>
            <p className="text-[13px] text-slate-500 mt-1.5 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-900 tracking-tight">Scans nos últimos 14 dias</h3>
            <p className="text-sm text-slate-400 mt-0.5">{totalScans} scans total</p>
          </div>
          <div className="badge bg-emerald-50 text-emerald-700">
            <Eye className="w-3 h-3" /> Ativo
          </div>
        </div>
        <div className="flex items-end gap-[6px] h-44">
          {last14.map((d, i) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full">
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.count}
                </span>
                <div
                  className="w-full rounded-lg rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500 min-h-[4px] group-hover:from-emerald-600 group-hover:to-emerald-500"
                  style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%`, opacity: d.count > 0 ? 1 : 0.12 }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{d.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
