import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Branch } from '../lib/types';
import { Plus, Trash2, QrCode, ToggleLeft, ToggleRight, Store, ExternalLink, Pencil, X, Check, Loader2, MapPin, Phone, Copy } from 'lucide-react';

const emptyForm = { name: '', slug: '', address: '', phone: '' };

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [qrBranch, setQrBranch] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    try {
      const data = await db.getBranches(user.id);
      setBranches(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const baseUrl = `${window.location.origin}/m/`;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({ name: b.name, slug: b.slug, address: b.address, phone: b.phone });
    setError('');
    setShowForm(true);
  };

  const handleNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      slug: editingId ? f.slug : slugify(name),
    }));
  };

  const save = async () => {
    if (!user || !form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const branch = branches.find(b => b.id === editingId)!;
        await db.updateBranch(editingId, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          active: branch.active,
        });
      } else {
        await db.addBranch(user.id, form.name.trim(), form.slug.trim(), form.address.trim(), form.phone.trim());
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setError(e?.message?.includes('unique') ? 'Este slug ja esta em uso. Escolha outro.' : (e?.message ?? 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (b: Branch) => {
    await db.updateBranch(b.id, { ...b, active: !b.active });
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir esta filial? Os pedidos relacionados nao serao apagados.')) return;
    await db.deleteBranch(id);
    await load();
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(baseUrl + slug);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Filiais</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Gerencie multiplas unidades com o mesmo cardapio</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova filial
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">{editingId ? 'Editar filial' : 'Nova filial'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome da filial *</label>
              <input
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                className="input w-full"
                placeholder="Ex: Filial Centro, Unidade Norte..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Slug (URL) *</label>
              <div className="flex items-center gap-0 rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-transparent">
                <span className="text-[11px] text-slate-400 pl-3 pr-1 whitespace-nowrap font-mono">/m/</span>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  className="flex-1 py-2.5 pr-3 text-sm bg-transparent focus:outline-none font-mono"
                  placeholder="meu-restaurante-centro"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">URL: <span className="font-mono text-emerald-600">{baseUrl}{form.slug || 'slug'}</span></p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Endereco</label>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="input w-full"
                placeholder="Rua, numero, bairro, cidade..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Telefone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input w-full"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.slug.trim()} className="btn-primary flex items-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar filial'}
            </button>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card p-4 bg-blue-50/50 border-blue-100">
        <p className="text-sm font-semibold text-blue-800 mb-1">Como funciona</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Cada filial tem sua propria URL e QR Code</li>
          <li>O cardapio e o mesmo do restaurante principal</li>
          <li>Os pedidos chegam na tela de Pedidos identificados pela filial</li>
          <li>O cliente ve o nome, endereco e telefone especifico da filial</li>
        </ul>
      </div>

      {/* Branch list */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : branches.length === 0 ? (
        <div className="card p-16 text-center">
          <Store className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma filial cadastrada</p>
          <p className="text-slate-400 text-sm mt-1">Adicione filiais para ter URLs e QR Codes exclusivos por unidade</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {branches.map(b => (
            <div key={b.id} className={`card p-4 flex flex-col gap-3 ${!b.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${b.active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                    <Store className={`w-4.5 h-4.5 ${b.active ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">/m/{b.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Editar">
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button onClick={() => toggle(b)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={b.active ? 'Desativar' : 'Ativar'}>
                    {b.active ? <ToggleRight className="w-4.5 h-4.5 text-emerald-500" /> : <ToggleLeft className="w-4.5 h-4.5 text-slate-400" />}
                  </button>
                  <button onClick={() => del(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {(b.address || b.phone) && (
                <div className="space-y-0.5">
                  {b.address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{b.address}</span>
                    </p>
                  )}
                  {b.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 flex-shrink-0 text-slate-400" />
                      {b.phone}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => copyUrl(b.slug)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {copied === b.slug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === b.slug ? 'Copiado!' : 'Copiar URL'}
                </button>
                <button
                  onClick={() => setQrBranch(qrBranch === b.id ? null : b.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" /> QR Code
                </button>
                <a
                  href={baseUrl + b.slug}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {qrBranch === b.id && (
                <div className="flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(baseUrl + b.slug)}`}
                    alt={`QR ${b.name}`}
                    className="w-40 h-40 rounded-lg"
                  />
                  <p className="text-xs text-slate-400 font-medium text-center break-all">{baseUrl + b.slug}</p>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(baseUrl + b.slug)}`}
                    download={`qr-${b.slug}.png`}
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
    </div>
  );
}
