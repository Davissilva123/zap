import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { ItemGroup, ItemOption } from '../lib/types';

interface Props {
  menuItemId: string;
}

export default function ItemGroupsEditor({ menuItemId }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    db.getItemGroups(menuItemId).then(g => { setGroups(g); setLoading(false); });
  }, [menuItemId]);

  const addGroup = async () => {
    if (!user) return;
    const g = await db.addItemGroup(user.id, menuItemId, {
      name: 'Novo grupo', required: false, minChoices: 0, maxChoices: 1, order: groups.length,
    });
    setGroups(prev => [...prev, g]);
    setOpenGroup(g.id);
  };

  const updateGroupField = async (id: string, field: 'name' | 'required' | 'minChoices' | 'maxChoices', value: string | boolean | number) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    await db.updateItemGroup(id, { [field]: value });
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Excluir grupo e todas as opções?')) return;
    await db.deleteItemGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const addOption = async (groupId: string) => {
    if (!user) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const opt = await db.addItemOption(user.id, groupId, {
      name: 'Nova opção', priceDelta: 0, order: group.options.length,
    });
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: [...g.options, opt] } : g));
  };

  const updateOption = async (groupId: string, optId: string, field: 'name' | 'priceDelta', value: string | number) => {
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, options: g.options.map((o: ItemOption) => o.id === optId ? { ...o, [field]: value } : o) }
      : g
    ));
    await db.updateItemOption(optId, { [field]: value });
  };

  const deleteOption = async (groupId: string, optId: string) => {
    await db.deleteItemOption(optId);
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, options: g.options.filter((o: ItemOption) => o.id !== optId) }
      : g
    ));
  };

  if (loading) return <div className="text-xs text-slate-400 py-2">Carregando...</div>;

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header do grupo */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2">
            <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <input
              className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-slate-800"
              value={group.name}
              onChange={e => updateGroupField(group.id, 'name', e.target.value)}
              onBlur={e => db.updateItemGroup(group.id, { name: e.target.value })}
            />
            <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={group.required}
                onChange={e => updateGroupField(group.id, 'required', e.target.checked)}
                className="rounded"
              />
              Obrigatório
            </label>
            <button onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)} className="p-1 hover:bg-slate-200 rounded">
              {openGroup === group.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            <button onClick={() => deleteGroup(group.id)} className="p-1 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>

          {openGroup === group.id && (
            <div className="px-3 py-2 space-y-2">
              {/* Configuração de min/max */}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Mín:</span>
                <input
                  type="number" min={0} value={group.minChoices}
                  onChange={e => updateGroupField(group.id, 'minChoices', Number(e.target.value))}
                  className="w-14 border border-slate-200 rounded px-2 py-1 text-center text-xs"
                />
                <span>Máx:</span>
                <input
                  type="number" min={1} value={group.maxChoices}
                  onChange={e => updateGroupField(group.id, 'maxChoices', Number(e.target.value))}
                  className="w-14 border border-slate-200 rounded px-2 py-1 text-center text-xs"
                />
              </div>

              {/* Opções */}
              {group.options.map(opt => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-400"
                    value={opt.name}
                    onChange={e => updateOption(group.id, opt.id, 'name', e.target.value)}
                    onBlur={e => db.updateItemOption(opt.id, { name: e.target.value })}
                    placeholder="Nome da opção"
                  />
                  <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-slate-400">+R$</span>
                    <input
                      type="number" min={0} step={0.5}
                      className="w-16 text-sm outline-none text-center"
                      value={opt.priceDelta}
                      onChange={e => updateOption(group.id, opt.id, 'priceDelta', Number(e.target.value))}
                      onBlur={e => db.updateItemOption(opt.id, { priceDelta: Number(e.target.value) })}
                    />
                  </div>
                  <button onClick={() => deleteOption(group.id, opt.id)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => addOption(group.id)}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar opção
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addGroup}
        className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl py-2.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
      >
        <Plus className="w-4 h-4" /> Adicionar grupo de adicionais
      </button>
    </div>
  );
}
