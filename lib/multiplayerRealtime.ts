import { supabase } from '@/lib/supabase';

type MessageEventLike = { data: any };
type MessageHandler = ((event: MessageEventLike) => void) | null;

export interface RealtimeBroadcastChannel {
  onmessage: MessageHandler;
  postMessage(data: any): void;
  close(): void;
}

/**
 * BroadcastChannel-compatible transport backed by Supabase Realtime.
 * Messages are delivered to other devices in the same room, not just tabs
 * sharing one browser storage area.
 */
export function createRealtimeBroadcastChannel(name: string): RealtimeBroadcastChannel {
  let handler: MessageHandler = null;
  let closed = false;
  let subscribed = false;
  let closeWhenReady = false;
  const pending: any[] = [];
  const inFlight: Promise<any>[] = [];

  if (!supabase) {
    console.error('[Multiplayer] Supabase Realtime is not configured.');
    return {
      get onmessage() { return handler; },
      set onmessage(next) { handler = next; },
      postMessage() {
        console.error('[Multiplayer] Message not sent: Realtime is unavailable.');
      },
      close() { closed = true; },
    };
  }

  const client = supabase;
  const channel = client.channel(name, { config: { broadcast: { self: false } } });

  const send = (data: any) => {
    if (closed) return;
    const task = channel.send({ type: 'broadcast', event: 'message', payload: data });
    inFlight.push(task);
    void task.catch((error: unknown) => {
      console.warn('[Multiplayer] Realtime send failed:', error);
    }).finally(() => {
      const index = inFlight.indexOf(task);
      if (index >= 0) inFlight.splice(index, 1);
    });
  };

  channel.on('broadcast', { event: 'message' }, ({ payload }: { payload: any }) => {
    if (!closed) handler?.({ data: payload });
  });

  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      while (pending.length) send(pending.shift());
      if (closeWhenReady) {
        void Promise.allSettled(inFlight).finally(() => {
          if (!closed) {
            closed = true;
            void client.removeChannel(channel);
          }
        });
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('[Multiplayer] Realtime channel connection failed:', name, status);
    }
  });

  return {
    get onmessage() { return handler; },
    set onmessage(next) { handler = next; },
    postMessage(data) {
      if (closed) return;
      if (!subscribed) pending.push(data);
      else send(data);
    },
    close() {
      if (closed) return;
      if (!subscribed) {
        closeWhenReady = true;
        return;
      }
      void Promise.allSettled(inFlight).finally(() => {
        if (!closed) {
          closed = true;
          void client.removeChannel(channel);
        }
      });
    },
  };
}
