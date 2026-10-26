/**
 * Street Life Multiplayer Manager
 * Peer-to-Peer synchronization engine using BroadcastChannel & LocalStorage persistence.
 * Enables zero-backend real-time multi-tab / multi-client room matching and gameplay.
 */

export type GameType = 'dice' | 'race' | 'war';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface PlayerInRoom {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  isBot: boolean;
  latency: number;
  color?: string;
  team?: 'blue' | 'red';
  score?: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  emoji?: string;
}

export interface Room {
  code: string;
  gameType: GameType;
  hostId: string;
  players: PlayerInRoom[];
  status: RoomStatus;
  mode?: string; // e.g. 'Last Man Standing' | 'Team vs Bots - 10 Waves'
  currentWave?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MultiplayerMessage<T = any> {
  type:
    | 'update'
    | 'room_state'
    | 'player_joined'
    | 'player_left'
    | 'player_ready'
    | 'game_start'
    | 'game_finish'
    | 'mode_changed'
    | 'chat'
    | 'reaction'
    | 'ping'
    | 'pong';
  playerId: string;
  data: T;
  timestamp: number;
}

const STORAGE_ROOMS_KEY = 'street_life_multiplayer_rooms_v1';
const STORAGE_LAST_ROOM_KEY = 'last_room';

// In-memory BroadcastChannel registry to reuse connections per room
const activeChannels: Map<string, BroadcastChannel> = new Map();
const channelListeners: Map<string, Set<(msg: MultiplayerMessage) => void>> = new Map();

/**
 * Get or create a singleton BroadcastChannel for a room code
 */
export function getRoomChannel(code: string): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  const normalizedCode = code.toUpperCase().trim();
  const channelName = `room_${normalizedCode}`;

  if (!activeChannels.has(normalizedCode)) {
    try {
      const channel = new BroadcastChannel(channelName);
      channel.onmessage = (event: MessageEvent<MultiplayerMessage>) => {
        const listeners = channelListeners.get(normalizedCode);
        if (listeners) {
          listeners.forEach((callback) => {
            try {
              callback(event.data);
            } catch (err) {
              console.warn('[MultiplayerManager] listener error:', err);
            }
          });
        }
      };
      activeChannels.set(normalizedCode, channel);
    } catch (e) {
      console.warn('[MultiplayerManager] Failed to create BroadcastChannel:', e);
      return null;
    }
  }

  return activeChannels.get(normalizedCode) || null;
}

/**
 * Retrieve all active rooms from localStorage
 */
export function getAllRooms(): Room[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_ROOMS_KEY);
    if (!raw) return [];
    const rooms: Room[] = JSON.parse(raw);
    const now = Date.now();
    // Filter rooms older than 3 hours
    return rooms.filter((r) => now - r.createdAt < 3 * 60 * 60 * 1000);
  } catch (e) {
    console.warn('[MultiplayerManager] getAllRooms error:', e);
    return [];
  }
}

/**
 * Save rooms array to localStorage
 */
function saveAllRooms(rooms: Room[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) {
    console.warn('[MultiplayerManager] saveAllRooms error:', e);
  }
}

/**
 * Get a specific room by its code
 */
export function getRoom(code: string): Room | null {
  const normalized = code.toUpperCase().trim();
  const rooms = getAllRooms();
  return rooms.find((r) => r.code === normalized) || null;
}

/**
 * Update a room atomically and broadcast the full room state to peers
 */
export function updateRoom(code: string, updater: (prev: Room) => Room): Room | null {
  const normalized = code.toUpperCase().trim();
  const rooms = getAllRooms();
  const index = rooms.findIndex((r) => r.code === normalized);

  if (index === -1) return null;

  const updated = updater(rooms[index]);
  updated.updatedAt = Date.now();
  rooms[index] = updated;
  saveAllRooms(rooms);

  // Broadcast the updated room state to all peers in the room
  const channel = getRoomChannel(normalized);
  if (channel) {
    channel.postMessage({
      type: 'room_state',
      playerId: 'system',
      data: updated,
      timestamp: Date.now(),
    });
  }

  return updated;
}

/**
 * Create a new multiplayer room with format: STREET + 100-999 (e.g. STREET482)
 */
export function createRoom(
  gameType: GameType,
  hostId: string,
  hostName: string,
  hostAvatar: string = '👑',
  initialMode?: string
): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  const code = `STREET${randomNum}`;

  const hostPlayer: PlayerInRoom = {
    id: hostId,
    name: hostName || 'Street Boss',
    avatar: hostAvatar,
    ready: true,
    isBot: false,
    latency: 24,
    color: '#FFD700',
    team: 'blue',
  };

  const defaultMode =
    initialMode ||
    (gameType === 'war'
      ? 'Team vs Bots - 10 Waves'
      : gameType === 'race'
      ? 'Circuit Sprint'
      : 'Street Ludo Gang');

  const newRoom: Room = {
    code,
    gameType,
    hostId,
    players: [hostPlayer],
    status: 'waiting',
    mode: defaultMode,
    currentWave: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const rooms = getAllRooms();
  rooms.push(newRoom);
  saveAllRooms(rooms);

  // Open channel and broadcast
  const channel = getRoomChannel(code);
  if (channel) {
    channel.postMessage({
      type: 'room_state',
      playerId: hostId,
      data: newRoom,
      timestamp: Date.now(),
    });
  }

  saveRejoin(code, hostId);
  return code;
}

/**
 * Join an existing room with player details
 */
export function joinRoom(code: string, player: PlayerInRoom): boolean {
  const normalized = code.toUpperCase().trim();
  const room = getRoom(normalized);
  if (!room) return false;

  // Max player constraints
  const maxPlayers = room.gameType === 'war' ? 6 : 4;
  const existingPlayerIndex = room.players.findIndex((p) => p.id === player.id);

  if (existingPlayerIndex === -1 && room.players.length >= maxPlayers) {
    return false; // Room is full
  }

  updateRoom(normalized, (prev) => {
    const existing = prev.players.find((p) => p.id === player.id);
    if (existing) {
      // Reconnection or update
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === player.id ? { ...p, ...player, isBot: false, latency: Math.floor(20 + Math.random() * 30) } : p
        ),
      };
    }
    // New player
    const colors = ['#FACC15', '#EF4444', '#3B82F6', '#10B981', '#A855F7', '#EC4899'];
    const assignedColor = player.color || colors[prev.players.length % colors.length];

    return {
      ...prev,
      players: [
        ...prev.players,
        {
          ...player,
          color: assignedColor,
          team: 'blue',
          latency: Math.floor(25 + Math.random() * 40),
        },
      ],
    };
  });

  sendUpdate(normalized, player.id, {
    action: 'player_joined',
    player,
  });

  saveRejoin(normalized, player.id);
  return true;
}

/**
 * Leave a room or convert disconnected player to bot
 */
export function leaveRoom(code: string, playerId: string): void {
  const normalized = code.toUpperCase().trim();
  const room = getRoom(normalized);
  if (!room) return;

  // If game is playing, convert leaving player to a bot so match can continue seamlessly
  if (room.status === 'playing') {
    updateRoom(normalized, (prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, isBot: true, name: `${p.name} (Bot)` } : p
      ),
    }));
  } else {
    // In lobby: remove player. If host left, assign next player as host
    updateRoom(normalized, (prev) => {
      const remainingPlayers = prev.players.filter((p) => p.id !== playerId);
      let nextHost = prev.hostId;
      if (prev.hostId === playerId && remainingPlayers.length > 0) {
        nextHost = remainingPlayers[0].id;
        remainingPlayers[0].ready = true;
      }
      return {
        ...prev,
        hostId: nextHost,
        players: remainingPlayers,
      };
    });
  }

  sendUpdate(normalized, playerId, {
    action: 'player_left',
    playerId,
  });
}

/**
 * Send a generic peer-to-peer update message via the room BroadcastChannel
 */
export function sendUpdate<T = any>(code: string, playerId: string, data: T): void {
  const normalized = code.toUpperCase().trim();
  const channel = getRoomChannel(normalized);
  if (!channel) return;

  const message: MultiplayerMessage<T> = {
    type: 'update',
    playerId,
    data,
    timestamp: Date.now(),
  };

  try {
    channel.postMessage(message);
  } catch (e) {
    console.warn('[MultiplayerManager] sendUpdate error:', e);
  }
}

/**
 * Send a quick chat message or emoji
 */
export function sendChatMessage(
  code: string,
  playerId: string,
  playerName: string,
  text: string,
  emoji?: string
): void {
  const normalized = code.toUpperCase().trim();
  const channel = getRoomChannel(normalized);
  if (!channel) return;

  const chatMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playerId,
    playerName,
    text,
    timestamp: Date.now(),
    emoji,
  };

  channel.postMessage({
    type: 'chat',
    playerId,
    data: chatMsg,
    timestamp: Date.now(),
  });
}

/**
 * Send a floating emoji reaction shown above the player's avatar
 */
export function sendReaction(code: string, playerId: string, emoji: string): void {
  const normalized = code.toUpperCase().trim();
  const channel = getRoomChannel(normalized);
  if (!channel) return;

  channel.postMessage({
    type: 'reaction',
    playerId,
    data: { emoji, timestamp: Date.now() },
    timestamp: Date.now(),
  });
}

/**
 * Listen for updates on a specific room channel.
 * Returns an unsubscription cleanup function.
 */
export function onUpdate(code: string, callback: (msg: MultiplayerMessage) => void): () => void {
  const normalized = code.toUpperCase().trim();
  getRoomChannel(normalized); // Ensures channel is created

  if (!channelListeners.has(normalized)) {
    channelListeners.set(normalized, new Set());
  }

  const listeners = channelListeners.get(normalized)!;
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      channelListeners.delete(normalized);
      const ch = activeChannels.get(normalized);
      if (ch) {
        ch.close();
        activeChannels.delete(normalized);
      }
    }
  };
}

/**
 * Copy room code to clipboard
 */
export async function copyCode(code: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save current room session for automatic 60-second reconnection
 */
export function saveRejoin(code: string, playerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_LAST_ROOM_KEY,
      JSON.stringify({
        code: code.toUpperCase().trim(),
        playerId,
        time: Date.now(),
      })
    );
  } catch {}
}

/**
 * Check if the user disconnected within the last 60 seconds and can rejoin
 */
export function tryRejoin(): { code: string; playerId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_LAST_ROOM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const elapsed = Date.now() - (data.time || 0);

    // Within 60 seconds limit
    if (elapsed < 60 * 1000 && data.code && data.playerId) {
      const room = getRoom(data.code);
      if (room) {
        return { code: data.code, playerId: data.playerId };
      }
    }
  } catch {}
  return null;
}

/**
 * Clear rejoin state when user leaves cleanly
 */
export function clearRejoin(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_LAST_ROOM_KEY);
  } catch {}
}

/**
 * Helper to determine network dot color based on latency
 * Green: < 100ms, Yellow: < 300ms, Red: >= 300ms
 */
export function getNetworkDot(latency: number): 'green' | 'yellow' | 'red' {
  if (latency < 100) return 'green';
  if (latency < 300) return 'yellow';
  return 'red';
}
