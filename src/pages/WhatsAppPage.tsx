import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Settings, Send, Search, Bot, UserCheck,
  X, Copy, Check, RefreshCw, Zap, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import type { WaConversation, WaMessage, WaConfig } from '../lib/types';

type FilterTab = 'all' | 'pending' | 'active' | 'bot' | 'closed';

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  bot:     { label: 'Bot',       cls: 'bg-blue-100 text-blue-700'       },
  pending: { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700'     },
  active:  { label: 'Ativo',     cls: 'bg-emerald-100 text-emerald-700' },
  closed:  { label: 'Encerrado', cls: 'bg-slate-100 text-slate-500'     },
};

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'Todas', pending: 'Pendentes', active: 'Ativas', bot: 'Bot', closed: 'Encerradas',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<WaConfig>({ apiUrl: '', apiKey: '', instanceName: '', botEnabled: true, botWelcome: '' });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const data = await db.getWaConversations(user.id);
    setConversations(data);
    setLoading(false);
  }, [user]);

  const loadMessages = useCallback(async (convId: string) => {
    const data = await db.getWaMessages(convId);
    setMessages(data);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: conversation list updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('wa-convs-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, loadConversations]);

  // Realtime: messages for selected conversation
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    loadMessages(selectedId);
    const ch = supabase.channel(`wa-msgs-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        const r = payload.new as Record<string, unknown>;
        setMessages(prev => [...prev, {
          id: r.id as string,
          conversationId: r.conversation_id as string,
          direction: r.direction as 'in' | 'out',
          body: r.body as string,
          fromName: (r.from_name as string) ?? '',
          waMessageId: (r.wa_message_id as string) ?? '',
          createdAt: r.created_at as string,
        }]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [selectedId, loadMessages]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedId) {
      db.markWaRead(selectedId);
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, unreadCount: 0 } : c));
    }
  }, [selectedId]);

  // Load Evolution API config
  useEffect(() => {
    if (!user || configLoaded) return;
    db.getWaConfig(user.id).then(cfg => {
      if (cfg) setConfig(cfg);
      setConfigLoaded(true);
    });
  }, [user, configLoaded]);

  const saveConfig = async () => {
    if (!user) return;
    setSaving(true);
    await db.saveWaConfig(user.id, config);
    setSaving(false);
    setConfigOpen(false);
  };

  const sendMessage = async () => {
    if (!selectedId || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wz-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ conversationId: selectedId, message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        alert(err.error || 'Erro ao enviar mensagem');
        setInputText(text);
      }
    } catch {
      alert('Erro de conexão ao enviar mensagem');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const setConvStatus = async (conv: WaConversation, status: WaConversation['status'], botState?: string) => {
    const updates: Parameters<typeof db.updateWaConversation>[1] = { status };
    if (botState !== undefined) updates.botState = botState;
    await db.updateWaConversation(conv.id, updates);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status, ...(botState ? { botState } : {}) } : c));
  };

  const copyWebhook = () => {
    if (!user) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wz-webhook?rid=${user.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const webhookUrl = user
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wz-webhook?rid=${user.id}`
    : '';

  const counts: Record<FilterTab, number> = {
    all: conversations.length,
    pending: conversations.filter(c => c.status === 'pending').length,
    active: conversations.filter(c => c.status === 'active').length,
    bot: conversations.filter(c => c.status === 'bot').length,
    closed: conversations.filter(c => c.status === 'closed').length,
  };

  const filtered = conversations.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.customerName.toLowerCase().includes(q) || c.customerPhone.includes(q);
    }
    return true;
  });

  return (
    <div
      className="flex bg-white rounded-xl overflow-hidden border border-slate-200"
      style={{ height: 'calc(100vh - 7rem)' }}
    >
      {/* Left panel: conversation list */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-slate-50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-emerald-600" />
            <span className="font-semibold text-slate-800">WhatsApp</span>
          </div>
          <button
            onClick={() => setConfigOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Configurações"
          >
            <Settings size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-2 py-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {FILTER_LABELS[f]}
              {counts[f] > 0 && (
                <span className={`text-[10px] ${filter === f ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <MessageSquare size={28} className="opacity-25" />
              <p className="text-sm">Nenhuma conversa</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 transition-colors border-b border-slate-100 text-left ${
                  selectedId === conv.id
                    ? 'bg-white border-l-2 border-l-emerald-500'
                    : 'hover:bg-white'
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                  {initials(conv.customerName || conv.customerPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {conv.customerName || conv.customerPhone}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 bg-emerald-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_INFO[conv.status]?.cls ?? ''}`}>
                    {STATUS_INFO[conv.status]?.label ?? conv.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel: chat thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <MessageSquare size={48} className="opacity-20" />
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                  {initials(selectedConv.customerName || selectedConv.customerPhone)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {selectedConv.customerName || selectedConv.customerPhone}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_INFO[selectedConv.status]?.cls}`}>
                      {STATUS_INFO[selectedConv.status]?.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{selectedConv.customerPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(selectedConv.status === 'bot' || selectedConv.status === 'pending') && (
                  <button
                    onClick={() => setConvStatus(selectedConv, 'active', 'handoff')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-100 transition-colors"
                  >
                    <UserCheck size={14} />
                    Assumir
                  </button>
                )}
                {selectedConv.status === 'closed' ? (
                  <button
                    onClick={() => setConvStatus(selectedConv, 'active')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-100 transition-colors"
                  >
                    <RefreshCw size={14} />
                    Reabrir
                  </button>
                ) : (
                  <button
                    onClick={() => setConvStatus(selectedConv, 'closed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-100 transition-colors"
                  >
                    <X size={14} />
                    Encerrar
                  </button>
                )}
              </div>
            </div>

            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Nenhuma mensagem ainda
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2.5 rounded-2xl text-sm ${
                      msg.direction === 'out'
                        ? 'bg-emerald-500 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {msg.direction === 'in' && msg.fromName && (
                      <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">{msg.fromName}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                    <p className={`text-[10px] mt-1 text-right ${msg.direction === 'out' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {selectedConv.status === 'bot' && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Bot size={13} className="text-blue-400" />
                  <span className="text-xs text-slate-400">Bot em atendimento — clique em "Assumir" para tomar o controle</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-200">
              {selectedConv.status === 'closed' ? (
                <p className="text-center text-sm text-slate-400 py-1">
                  Conversa encerrada. Clique em "Reabrir" para responder.
                </p>
              ) : (
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onInput={e => {
                      const t = e.currentTarget;
                      t.style.height = 'auto';
                      t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                    }}
                    placeholder="Mensagem... (Enter para enviar, Shift+Enter nova linha)"
                    rows={1}
                    className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 overflow-y-auto"
                    style={{ minHeight: 44, maxHeight: 128 }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || sending}
                    className="flex-shrink-0 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Config modal */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-emerald-600" />
                <h2 className="font-semibold text-slate-800">Configurar Evolution API</h2>
              </div>
              <button onClick={() => setConfigOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Webhook URL */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  URL do Webhook (configure na Evolution API)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={copyWebhook}
                    className="flex-shrink-0 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Cole esta URL no webhook da sua instância com o evento <code className="bg-slate-100 px-1 rounded">messages.upsert</code>.
                </p>
              </div>

              <div className="border-t border-slate-100" />

              <div>
                <label className="text-sm font-medium text-slate-700">URL da Evolution API</label>
                <input
                  value={config.apiUrl}
                  onChange={e => setConfig(p => ({ ...p, apiUrl: e.target.value }))}
                  placeholder="https://sua-evolution-api.com"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={e => setConfig(p => ({ ...p, apiKey: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Nome da Instância</label>
                <input
                  value={config.instanceName}
                  onChange={e => setConfig(p => ({ ...p, instanceName: e.target.value }))}
                  placeholder="meu-restaurante"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Chatbot ativo</p>
                  <p className="text-xs text-slate-400">Responde automaticamente antes do atendente assumir</p>
                </div>
                <button
                  onClick={() => setConfig(p => ({ ...p, botEnabled: !p.botEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${config.botEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      config.botEnabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Mensagem de boas-vindas do bot</label>
                <p className="text-xs text-slate-400 mt-0.5 mb-1">
                  Use <code className="bg-slate-100 px-1 rounded">{'{restaurantName}'}</code> para inserir o nome do restaurante
                </p>
                <textarea
                  value={config.botWelcome}
                  onChange={e => setConfig(p => ({ ...p, botWelcome: e.target.value }))}
                  rows={5}
                  placeholder={`Olá! 👋 Bem-vindo ao {restaurantName}!\n\n1️⃣ Ver cardápio\n2️⃣ Status do meu pedido\n3️⃣ Horário de funcionamento\n4️⃣ Falar com atendente`}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  A Evolution API precisa estar em um servidor público (VPS, Render, Railway). Oracle Cloud Free Tier é uma opção gratuita recomendada.
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setConfigOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
