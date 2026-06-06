import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { RestaurantTable, RestaurantSettings } from '../lib/types';
import { Plus, Trash2, QrCode, ToggleLeft, ToggleRight, LayoutGrid, ExternalLink } from 'lucide-react';

export default function TablesPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);

  const load = () => {
    if (!user) return;
    db.getTables(user.id).then(setTables);
    db.getSettings(user.id).then(setSettings);
  };
  useEffect(() => { load(); }, [user]);
  if (!user) return null;

  const baseUrl = `${window.location.origin}/m/${settings?.slug || ''}`;

  const add = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await db.addTable(user.id, newName.trim());
      setNewName('');
      load();
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  };

  const toggle = async (t: RestaurantTable) => {
    await db.updateTable(t.id, { active: !t.active });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir esta mesa?')) return;
    await db.deleteTable(id);
    load();
  };

  const tableUrl = (t: RestaurantTable) => `${baseUrl}?mesa=${encodeURIComponent(t.name)}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Comandas por mesa</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Gere um QR Code exclusivo para cada mesa do salão</p>
      </div>

      {/* Add table */}
      <div className="card p-4">
        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Nova mesa</label>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            className="input flex-1"
            placeholder="Ex: Mesa 1, Mesa 2, Varanda A..."
          />
          <button onClick={add} disabled={saving || !newName.trim()} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Sugestão rápida:</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => `Mesa ${i + 1}`).filter(n => !tables.find(t => t.name === n)).slice(0, 5).map(n => (
            <button key={n} onClick={() => setNewName(n)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-medium">{n}</button>
          ))}
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="card p-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma mesa cadastrada</p>
          <p className="text-slate-400 text-sm mt-1">Adicione mesas para gerar QR Codes exclusivos</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.map(t => (
            <div key={t.id} className={`card p-4 flex flex-col gap-3 ${!t.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <LayoutGrid className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <span className="font-bold text-slate-900">{t.name}</span>
                  {!t.active && <span className="badge bg-red-50 text-red-500 text-[10px]">Inativa</span>}
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => toggle(t)} title={t.active ? 'Desativar' : 'Ativar'} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    {t.active ? <ToggleRight className="w-4.5 h-4.5 text-emerald-500" /> : <ToggleLeft className="w-4.5 h-4.5 text-slate-400" />}
                  </button>
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setQrTable(qrTable?.id === t.id ? null : t)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" /> Ver QR
                </button>
                <a
                  href={tableUrl(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </a>
              </div>

              {qrTable?.id === t.id && (
                <div className="flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(tableUrl(t))}`}
                    alt={`QR ${t.name}`}
                    className="w-40 h-40 rounded-lg"
                  />
                  <p className="text-xs text-slate-400 font-medium text-center break-all">{tableUrl(t)}</p>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl(t))}`}
                    download={`qr-${t.name}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    Baixar QR Code
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tables.length > 0 && (
        <div className="card p-4 bg-emerald-50/50 border-emerald-100">
          <p className="text-sm font-semibold text-emerald-800 mb-1">Como funciona</p>
          <ul className="text-xs text-emerald-700 space-y-1 list-disc list-inside">
            <li>Imprima e cole o QR Code em cada mesa</li>
            <li>O cliente escaneia e o cardápio abre já com a mesa pré-selecionada</li>
            <li>O pedido chega com o nome da mesa para você identificar</li>
          </ul>
        </div>
      )}
    </div>
  );
}
