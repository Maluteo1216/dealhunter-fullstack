import {
  AuthResponse,
  GameDetail,
  GamesResponse,
  PriceAlert,
  Store,
  SyncLog,
  User,
  WishlistItem,
  CheapSharkDeal,
  CheapSharkStore,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getToken(): string | null {
  return localStorage.getItem('dealhunter_token');
}

export function setToken(token: string): void {
  localStorage.setItem('dealhunter_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('dealhunter_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Error del servidor (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch {
      // Usar mensaje predeterminado
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Verificación de estado para despertar el servidor Render
  checkHealth: async (): Promise<{ status: string; database: string }> => {
    return request<{ status: string; database: string }>('/health');
  },

  // Autenticación
  register: (username: string, email: string, password: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  login: (email: string, password: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  loginWithGoogle: (credential: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  },

  getMe: (): Promise<User> => {
    return request<User>('/api/v1/auth/me');
  },

  // Catálogo de Juegos y Filtros
  getGames: (params: {
    search?: string;
    store?: string;
    min_discount?: number;
    max_price?: number;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<GamesResponse> => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.store) query.set('store', params.store);
    if (params.min_discount) query.set('min_discount', params.min_discount.toString());
    if (params.max_price) query.set('max_price', params.max_price.toString());
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    return request<GamesResponse>(`/api/v1/games?${query.toString()}`);
  },

  getGameBySlug: (slug: string): Promise<GameDetail> => {
    return request<GameDetail>(`/api/v1/games/${encodeURIComponent(slug)}`);
  },

  enrichSingleGame: (slug: string): Promise<{ message: string; stores_added: number }> => {
    return request<{ message: string; stores_added: number }>(`/api/v1/games/${encodeURIComponent(slug)}/enrich`, {
      method: 'POST',
    });
  },

  // Tiendas
  getStores: (): Promise<Store[]> => {
    return request<Store[]>('/api/v1/stores');
  },

  // Wishlist
  getWishlist: (): Promise<WishlistItem[]> => {
    return request<WishlistItem[]>('/api/v1/wishlist');
  },

  addToWishlist: (gameId: number, targetPrice: number): Promise<{ id: number; message: string }> => {
    return request<{ id: number; message: string }>('/api/v1/wishlist', {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId, target_price: targetPrice }),
    });
  },

  removeFromWishlist: (gameId: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/v1/wishlist/${gameId}`, {
      method: 'DELETE',
    });
  },

  // Alertas
  getAlerts: (): Promise<PriceAlert[]> => {
    return request<PriceAlert[]>('/api/v1/alerts');
  },

  markAlertRead: (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/v1/alerts/${id}/read`, {
      method: 'PUT',
    });
  },

  // Sincronización en Vivo
  ingestDeals: (
    payload: { deals: CheapSharkDeal[]; stores: CheapSharkStore[] },
    autoEnrich: boolean = false
  ): Promise<{ message: string; processed: number; enriched?: number }> => {
    const endpoint = autoEnrich ? '/api/v1/sync/ingest?auto_enrich=true' : '/api/v1/sync/ingest';
    return request<{ message: string; processed: number; enriched?: number }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  serverSync: (): Promise<{ message: string; processed: number }> => {
    return request<{ message: string; processed: number }>('/api/v1/sync/server', {
      method: 'POST',
    });
  },

  randomServerSync: (count?: number): Promise<{
    message: string;
    result: {
      deals_processed: number;
      enriched_games: number;
      page_number: number;
      sort_by: string;
    };
  }> => {
    const q = count ? `?count=${count}` : '';
    return request<{
      message: string;
      result: {
        deals_processed: number;
        enriched_games: number;
        page_number: number;
        sort_by: string;
      };
    }>(`/api/v1/sync/random${q}`, {
      method: 'POST',
    });
  },

  cleanupExpiredDeals: (): Promise<{ message: string; deals_updated: number; deals_deactivated: number }> => {
    return request<{ message: string; deals_updated: number; deals_deactivated: number }>('/api/v1/sync/cleanup', {
      method: 'POST',
    });
  },

  enrichCatalog: (): Promise<{ message: string; enriched_games: number; stores_added: number }> => {
    return request<{ message: string; enriched_games: number; stores_added: number }>('/api/v1/sync/enrich', {
      method: 'POST',
    });
  },

  getSyncLogs: (): Promise<SyncLog[]> => {
    return request<SyncLog[]>('/api/v1/sync/logs');
  },
};
