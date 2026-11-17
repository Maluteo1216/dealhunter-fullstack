export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Store {
  id: number;
  external_store_id: string;
  name: string;
  slug: string;
  base_url: string;
  logo_url: string;
  is_active: boolean;
  deals_count: number;
}

export interface BestDeal {
  store_id: number;
  store_name: string;
  store_slug: string;
  store_logo: string;
  regular_price: number;
  current_price: number;
  discount_percentage: number;
  product_url: string;
  is_historical_low: boolean;
  external_deal_id: string;
}

export interface Game {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  steam_app_id?: string;
  publisher_id?: number;
  publisher_name?: string;
  historical_low_price?: number;
  historical_low_date?: string;
  created_at: string;
  best_deal?: BestDeal;
}

export interface StorePriceInfo {
  store_product_id: number;
  store_id: number;
  store_name: string;
  store_slug: string;
  store_logo: string;
  regular_price: number;
  current_price: number;
  discount_percentage: number;
  is_on_sale: boolean;
  product_url: string;
  last_updated: string;
  external_deal_id: string;
}

export interface PriceHistoryPoint {
  store_name: string;
  store_logo: string;
  regular_price: number;
  sale_price: number;
  discount_percentage: number;
  recorded_at: string;
}

export interface GameDetail {
  game: Game;
  current_prices: StorePriceInfo[];
  price_history: PriceHistoryPoint[];
}

export interface WishlistItem {
  id: number;
  user_id: number;
  game_id: number;
  game_title: string;
  game_slug: string;
  game_cover: string;
  target_price: number;
  current_best_price?: number;
  current_discount?: number;
  store_name: string;
  store_logo: string;
  product_url: string;
  notify_active: boolean;
  created_at: string;
}

export interface PriceAlert {
  id: number;
  wishlist_id: number;
  game_title: string;
  game_slug: string;
  game_cover: string;
  store_name: string;
  triggered_price: number;
  target_price: number;
  message: string;
  is_read: boolean;
  triggered_at: string;
}

export interface SyncLog {
  id: number;
  source: string;
  deals_processed: number;
  status: string;
  error_message?: string;
  executed_at: string;
}

export interface CheapSharkDeal {
  internalName: string;
  title: string;
  dealID: string;
  storeID: string;
  gameID: string;
  salePrice: string;
  normalPrice: string;
  isOnSale: string;
  savings: string;
  metacriticScore: string;
  steamAppID: string;
  thumb: string;
}

export interface CheapSharkStore {
  storeID: string;
  storeName: string;
  isActive: number;
  images: {
    banner: string;
    logo: string;
    icon: string;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface GamesResponse {
  games: Game[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
