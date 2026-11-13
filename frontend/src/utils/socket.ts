import { io } from 'socket.io-client';
import { AuthStorage } from './storage';

const getSocketUrl = () => {
  return (
    AuthStorage.getServerUrl() ||
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    'http://192.168.1.50:8000'
  );
};

export const socket = io(getSocketUrl(), {
  transports: ['websocket'],
  autoConnect: true,
  auth: {
    username: AuthStorage.getUsername(),
    token: AuthStorage.getToken(),
  },
});

export const updateSocketUrlAndReconnect = (newUrl?: string | null) => {
  const url = newUrl?.trim();
  if (url) {
    AuthStorage.setServerUrl(url);
  } else {
    AuthStorage.setServerUrl('');
  }

  const targetUrl =
    url || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.1.50:8000';
  (socket.io as any).uri = targetUrl;

  socket.disconnect();
  socket.connect();
};
