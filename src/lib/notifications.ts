export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNewOrderNotification(customerName: string, total: number, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('🔔 Novo pedido!', {
      body: `${customerName} — R$ ${total.toFixed(2).replace('.', ',')}`,
      icon: '/icon.svg',
      tag: 'new-order',
    });
    if (onClick) n.onclick = () => { window.focus(); n.close(); onClick(); };
    setTimeout(() => n.close(), 8000);
  } catch {
    // Notification API not supported or blocked
  }
}
