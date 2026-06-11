// Integração de balança via Web Serial API (Chrome/Edge)
// Suporta balanças Toledo, Filizola, Urano e genéricas RS-232/USB

export function isScaleSupported(): boolean {
  return 'serial' in navigator;
}

function parseWeight(raw: string): number | null {
  // Toledo: "ST,GS,   0.540 kg" | "ST,NT,   0.540 kg"
  const toledo = raw.match(/\d+\.\d+\s*kg/i);
  if (toledo) return parseFloat(toledo[0]) * 1000; // converte para gramas

  // Filizola/Urano: "+00000540g" ou "00540"
  const filizola = raw.match(/[+\-]?(\d{5,6})/);
  if (filizola) return parseInt(filizola[1], 10);

  // Genérico: primeiro número decimal ou inteiro
  const generic = raw.match(/(\d+[.,]\d+)/);
  if (generic) return parseFloat(generic[1].replace(',', '.'));

  return null;
}

export async function readScaleWeight(timeoutMs = 5000): Promise<number> {
  if (!isScaleSupported()) throw new Error('Web Serial não suportado. Use Chrome ou Edge.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });

  const reader = port.readable.getReader();
  let buffer = '';
  let weight: number | null = null;

  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      weight = parseWeight(buffer);
      if (weight !== null) break;
      // Limpa buffer se muito grande
      if (buffer.length > 256) buffer = buffer.slice(-64);
    }
  } finally {
    reader.releaseLock();
    await port.close();
  }

  if (weight === null) throw new Error('Não foi possível ler o peso. Verifique a conexão da balança.');
  return weight;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(3)} kg`;
  return `${grams.toFixed(0)} g`;
}
