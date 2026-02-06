import { io, Socket } from 'socket.io-client';

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_BASE_URL || 'http://localhost:5000/api';
const SOCKET_URL =
  import.meta.env.VITE_BACKEND_SOCKET_URL ||
  API_BASE_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

const getToken = (): string | null => {
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
};

export const initSocket = () => {
  if (socket?.connected) return socket;

  const token = getToken();
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
  });

  socket.on('connect', () => {
    console.log('✅ socket connected', socket?.id, SOCKET_URL);
  });
  socket.on('connect_error', (err) => {
    console.error('❌ socket connect_error', err?.message || err, SOCKET_URL);
  });
  socket.on('disconnect', (reason) => {
    console.warn('⚠️ socket disconnected', reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};

export const joinUserRoom = (userId: string | number) => {
  if (!socket) initSocket();
  // Backend auto-joins user room on connect; keep emit as no-op fallback
  socket?.emit('joinUserRoom', String(userId));
};

export const leaveUserRoom = (userId: string | number) => {
  socket?.emit('leaveUserRoom', String(userId));
};

type Unsubscribe = () => void;

const subscribeToEvents = <T>(
  events: string[],
  handler: (payload: T) => void
): Unsubscribe => {
  if (!socket) initSocket();
  events.forEach((evt) => socket?.on(evt, handler));
  return () => {
    events.forEach((evt) => socket?.off(evt, handler));
  };
};

export const onNewMail = (handler: (payload?: any) => void): Unsubscribe => {
  return subscribeToEvents(
    [
      // Backend emits
      'mail:received',
      'mail:sent',
      'mail:update',
      'newMail',
      'mail:new',
      'mail.new',
      'mailNew',
      'new_mail',
      'mail_created',
      'mail:created',
      'mail.created',
    ],
    handler
  );
};

export const onMailReply = (handler: (payload?: any) => void): Unsubscribe => {
  return subscribeToEvents(
    [
      // Backend emits
      'mail:replied',
      'mail:update',
      'mailReply',
      'mail:reply',
      'mail.reply',
      'mailReplyCreated',
      'mail_replied',
      'mail_reply',
      'reply_created',
    ],
    handler
  );
};

export const onMailDeleted = (handler: (payload?: any) => void): Unsubscribe => {
  return subscribeToEvents(
    [
      // Backend emits
      'mail:deleted',
      'mail:update',
      'mailDeleted',
      'mail:deleted',
      'mail.deleted',
      'mail_deleted',
      'mail_removed',
    ],
    handler
  );
};

export const onNotificationUpdate = (
  handler: (payload?: any) => void
): Unsubscribe => {
  return subscribeToEvents(
    [
      'notification',
      'notification:new',
      'notification:created',
      'notification.created',
      'notify',
      'alert',
      // Often used with project/task updates
      'mail:update',
      'project:update',
      'project:updated',
      'task:update',
      'task:updated',
    ],
    handler
  );
};

export const onProjectAssignment = (
  handler: (payload?: any) => void
): Unsubscribe => {
  return subscribeToEvents(
    [
      'project:assigned',
      'project.assigned',
      'project_assigned',
      'assignment:project',
      'member:assigned',
      'member.assigned',
      'member_assigned',
      'project:member_assigned',
      'project.member_assigned',
      'project_member_assigned',
      'project:member_added',
      'project.member_added',
      'project_member_added',
      'member:added',
      'member.added',
      'member_added',
      'member:removed',
      'member.removed',
      'member_removed',
      'project:member_removed',
      'project.member_removed',
      'project_member_removed',
      'project:member_deleted',
      'project.member_deleted',
      'project_member_deleted',
      'member:deleted',
      'member.deleted',
      'member_deleted',
      'project:update',
      'project:updated',
    ],
    handler
  );
};
