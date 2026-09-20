/**
 * env.ts
 * Environment helper that detects local development mode
 * and provides safe access to Cloudflare bindings.
 */
import type { AppEnv } from '../types';

export function isLocalMode(env: AppEnv['Bindings']): boolean {
  return env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'development';
}

export function getStorageUrl(env: AppEnv['Bindings'], key: string): string {
  if (!env.STORAGE) return '';
  if (isLocalMode(env)) {
    // In local mode, R2 buckets are emulated on disk
    return `/local-r2/${key}`;
  }
  return `https://${env.STORAGE.bucketName ? env.STORAGE.bucketName : 'botion-storage'}.r2.cloudflarestorage.com/${key}`;
}
