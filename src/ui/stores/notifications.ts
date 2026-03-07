import { writable } from 'svelte/store';

interface Notification {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

let nextId = 0;

export const notifications = writable<Notification[]>([]);

export function notify(message: string, type: Notification['type'] = 'info') {
  const id = nextId++;
  notifications.update(n => [...n.slice(-8), { id, message, type }]);
  setTimeout(() => {
    notifications.update(n => n.filter(x => x.id !== id));
  }, 3500);
}
