import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

// Firebase Remote Config / Firestore connection details
// Managed via environment or fallback to these placeholders
const FIREBASE_PROJECT_ID = 'unitax-app'; 
const FIREBASE_API_KEY = 'AIzaSyFakeKeyForAppStoreReviewCheck'; 
const FIREBASE_APP_ID = '1:1234567890:web:abcdef123456'; 

export interface NewsBannerConfig {
  is_active: boolean;
  banner_id: string;
  title: string;
  description: string;
  image_url?: string;
  action_type?: 'internal_route';
  action_value?: string;
}

/**
 * Validates and sanitizes the remote configuration object to enforce safety rules
 * (e.g. blocking any external HTTP/HTTPS redirects to comply with App Store Guideline 3.1.1).
 */
export function validateNewsBanner(config: any): NewsBannerConfig | null {
  if (!config) return null;

  const is_active = typeof config.is_active === 'boolean' ? config.is_active : config.is_active === 'true';
  if (!is_active) return null;

  const banner_id = String(config.banner_id || '').trim();
  if (!banner_id) return null;

  const title = String(config.title || '').trim();
  const description = String(config.description || '').trim();
  if (!title || !description) return null;

  const image_url = config.image_url ? String(config.image_url).trim() : undefined;

  let action_type: 'internal_route' | undefined = undefined;
  let action_value: string | undefined = undefined;

  // We only permit internal routes. External http/https redirect values are completely blocked.
  if (config.action_type === 'internal_route') {
    action_type = 'internal_route';
    const rawValue = String(config.action_value || '').trim();

    // Check for HTTP links, web domain extensions, or common URL delimiters to block cloking/external payment bypass attempts
    const isUnsafe = rawValue.toLowerCase().includes('http') ||
                     rawValue.toLowerCase().includes('www') ||
                     rawValue.toLowerCase().includes('.pro') ||
                     rawValue.toLowerCase().includes('.com') ||
                     rawValue.toLowerCase().includes('://') ||
                     rawValue.includes('?');

    if (!isUnsafe && rawValue.length > 0) {
      action_value = rawValue;
    } else {
      console.warn(`[SECURITY] Blocked unsafe action_value in remote news config: "${rawValue}"`);
    }
  }

  return {
    is_active,
    banner_id,
    title,
    description,
    image_url,
    action_type,
    action_value,
  };
}

/**
 * Parses raw Firestore document format into a clean flat JS object
 */
function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const fields = doc.fields;
  const result: any = {};
  for (const [key, valObj] of Object.entries(fields)) {
    const valueObj = valObj as any;
    if (valueObj.stringValue !== undefined) result[key] = valueObj.stringValue;
    else if (valueObj.booleanValue !== undefined) result[key] = valueObj.booleanValue;
    else if (valueObj.integerValue !== undefined) result[key] = parseInt(valueObj.integerValue, 10);
    else if (valueObj.doubleValue !== undefined) result[key] = parseFloat(valueObj.doubleValue);
  }
  return result;
}

/**
 * Fetches the news banner configuration from Firebase Remote Config via REST API.
 */
async function fetchFromRemoteConfig(): Promise<NewsBannerConfig | null> {
  try {
    const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/namespaces/firebase:fetch?key=${FIREBASE_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appInstanceId: 'rn-news-instance',
        appId: FIREBASE_APP_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`Remote Config REST request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const entries = data.entries || {};
    const configStr = entries.news_banner_config;
    if (!configStr) return null;

    const parsed = JSON.parse(configStr);
    return validateNewsBanner(parsed);
  } catch (error) {
    console.log('[RemoteConfig] Fetch bypassed/failed:', error);
    return null;
  }
}

/**
 * Fetches the news banner configuration from Firestore via public REST API.
 */
async function fetchFromFirestore(): Promise<NewsBannerConfig | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/news?orderBy=created_at%20desc&limit=1`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Firestore REST request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const docs = data.documents || [];
    if (docs.length === 0) return null;

    const parsed = parseFirestoreDoc(docs[0]);
    return validateNewsBanner(parsed);
  } catch (error) {
    console.log('[Firestore] Fetch bypassed/failed:', error);
    return null;
  }
}

/**
 * Fetches the latest configuration using a three-tier fallback mechanism:
 * 1. Remote Config REST API
 * 2. Firestore REST API
 * 3. Backend API config route (highly reliable)
 */
export async function getLatestNewsBanner(): Promise<NewsBannerConfig | null> {
  // Tier 1: Try Remote Config
  let banner = await fetchFromRemoteConfig();
  if (banner) return banner;

  // Tier 2: Try Firestore
  banner = await fetchFromFirestore();
  if (banner) return banner;

  // Tier 3: Fetch config from our backend (as an ultra-stable fallback)
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/news-banner`);
    if (response.ok) {
      const data = await response.json();
      return validateNewsBanner(data);
    }
  } catch (error) {
    console.log('[Backend Config] Fallback check failed:', error);
  }

  return null;
}

/**
 * Checks AsyncStorage to determine if a banner has already been viewed by the user.
 */
export async function shouldShowBanner(bannerId: string): Promise<boolean> {
  try {
    const viewedId = await AsyncStorage.getItem(`VIEWED_BANNER_${bannerId}`);
    return viewedId !== 'true';
  } catch (e) {
    return true;
  }
}

/**
 * Marks a banner as read/viewed in AsyncStorage.
 */
export async function markBannerAsRead(bannerId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`VIEWED_BANNER_${bannerId}`, 'true');
  } catch (e) {
    console.error('Failed to save banner view state:', e);
  }
}
