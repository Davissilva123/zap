import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { RestaurantSettings } from '../lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, ExternalLink, Eye, Link2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QRCodePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSettings(db.getSettings(user.id));
  }, [user]);

  if (!user || !settings) return null;

  const menuUrl = `${window.location.origin}/m/${settings.slug}`;

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const link = document.createElement('a');
      link.download = `qrcode-${settings.slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">QR Code</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Compartilhe o link do seu cardápio digital</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* QR Code card */}
        <div className="card p-8 flex flex-col items-center">
          <div ref={qrRef} className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm mb-5">
            <QRCodeSVG
              value={menuUrl}
              size={200}
              level="H"
              fgColor={settings.accentColor}
              bgColor="#ffffff"
            />
          </div>
          <p className="text-sm text-slate-400 mb-5 font-medium">Escaneie para ver o cardápio</p>
          <div className="flex gap-2.5 w-full">
            <button onClick={downloadQR} className="btn-primary flex-1">
              <Download className="w-4 h-4" /> Download PNG
            </button>
            <button onClick={copyLink} className="btn-ghost flex-1">
              {copied ? <><Check className="w-4 h-4 text-emerald-600" /><span className="text-emerald-600">Copiado!</span></> : <><Copy className="w-4 h-4" /> Copiar link</>}
            </button>
          </div>
        </div>

        {/* Info cards */}
        <div className="space-y-3">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" /> Link do cardápio
            </h3>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <code className="text-sm text-emerald-600 flex-1 truncate font-medium">{menuUrl}</code>
              <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Slug personalizado</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm text-slate-400">{window.location.origin}/m/</span>
              <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{settings.slug}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Altere o slug em Configurações</p>
          </div>

          <Link to={`/m/${settings.slug}`} className="card-hover p-5 flex items-center gap-4 group block">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors flex-shrink-0">
              <Eye className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">Ver cardápio público</h3>
              <p className="text-xs text-slate-400 mt-0.5">Como o cliente vai ver</p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
