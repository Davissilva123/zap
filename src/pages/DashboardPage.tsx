import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Scan, Category, MenuItem } from '../lib/types';
import { Eye, UtensilsCrossed, Grid3X3, TrendingUp, ArrowUpRight } from 'lucide-react';

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
    {
      label: 'Total de Scans',
      value: totalScans,
      icon: Eye,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Itens no Cardápio',
      value: totalItems,
      icon: UtensilsCrossed,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      accent: 'border-l-blue-500',
    },
    {
      label: 'Categorias',
      value: totalCategories,
      icon: Grid3X3,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      accent: 'border-l-violet-500',
    },
    {
      label: 'Disponíveis',
      value: availableItems,
      icon: TrendingUp,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      accent: 'border-l-amber-500',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Visão geral do seu ZapMenu</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
          <span className="text-emerald-700 text-xs font-semibold">Cardápio online</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className={`card p-5 border-l-4 ${stat.accent}`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[13px] font-medium text-slate-500 leading-snug">{stat.label}</p>
              <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-900 text-[15px]">Scans nos últimos 14 dias</h3>
            <p className="text-sm text-slate-400 mt-0.5">{totalScans} scans no período</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <Eye className="w-3 h-3" />
            Ativo
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {last14.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="relative w-full">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-sm whitespace-nowrap z-10">
                  {d.count} scan{d.count !== 1 ? 's' : ''}
                </span>
                <div
                  className="w-full rounded-t-md bg-emerald-500 transition-all duration-500 min-h-[3px] group-hover:bg-emerald-400"
                  style={{
                    height: `${Math.max((d.count / maxCount) * 100, 4)}%`,
                    opacity: d.count > 0 ? 1 : 0.1,
                  }}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-medium uppercase">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      {totalItems === 0 && (
        <div className="card p-5 border-l-4 border-l-blue-500 bg-blue-50/30">
          <p className="text-sm font-semibold text-blue-900 mb-1">Configure seu cardápio</p>
          <p className="text-sm text-blue-700">Comece adicionando categorias e itens ao seu cardápio para que os clientes possam visualizá-los via QR Code.</p>
        </div>
      )}
    </div>
  );
}
