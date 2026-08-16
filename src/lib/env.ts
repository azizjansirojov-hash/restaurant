import Constants from 'expo-constants';

export const env = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    Constants.expoConfig?.extra?.supabaseUrl ??
    '',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    Constants.expoConfig?.extra?.supabaseAnonKey ??
    '',
  stripePublishableKey:
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    Constants.expoConfig?.extra?.stripePublishableKey ??
    '',
  appEnv:
    process.env.EXPO_PUBLIC_APP_ENV ??
    Constants.expoConfig?.extra?.appEnv ??
    'development',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/**
 * Local simulator fallback is active only when Supabase is not configured.
 * Real checkout/order paths MUST NOT run when this returns false.
 */
export function isLocalFallbackMode(): boolean {
  return !isSupabaseConfigured();
}

export function isStripeConfigured(): boolean {
  return Boolean(env.stripePublishableKey);
}

export const isDev = env.appEnv === 'development' || __DEV__;
