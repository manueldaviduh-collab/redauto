import { notifications } from '../data/notifications.js';
import { getItem, setItem } from './storage.js';

const READ_KEY = 'notifications_read';

function readIds() {
  return getItem(READ_KEY, []);
}

export const notificationService = {
  getAll() {
    const read = readIds();
    return [...notifications]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((n) => ({ ...n, read: read.includes(n.id) }));
  },

  unreadCount() {
    const read = readIds();
    return notifications.filter((n) => !read.includes(n.id)).length;
  },

  markRead(id) {
    const read = readIds();
    if (!read.includes(id)) setItem(READ_KEY, [...read, id]);
  },

  markAllRead() {
    setItem(READ_KEY, notifications.map((n) => n.id));
  },
};
