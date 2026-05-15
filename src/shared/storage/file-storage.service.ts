import { logger } from '@/logging/logger.js';
import { env } from '@config/env.js';
import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

export type StoredFile = {
  url: string;
  provider: 'local' | 's3' | 'cloudinary' | 'supabase';
};

export type StorageHealth = {
  provider: StoredFile['provider'];
  status: 'online' | 'degraded' | 'offline';
  writable: boolean;
  publicBaseUrl?: string;
  message?: string;
};

export interface FileStorageProvider {
  delete(fileUrl: string): Promise<void>;
  health(): Promise<StorageHealth>;
  resolvePublicUrl(filePath: string): StoredFile;
}

const uploadRoot = path.resolve(env.UPLOADS_DIR);

const stripPublicBaseUrl = (fileUrl: string) => {
  if (!env.UPLOAD_PUBLIC_BASE_URL || !fileUrl.startsWith(env.UPLOAD_PUBLIC_BASE_URL)) {
    return fileUrl;
  }

  return fileUrl.slice(env.UPLOAD_PUBLIC_BASE_URL.length).replace(/^\/+/, '');
};

const localStorageProvider: FileStorageProvider = {
  resolvePublicUrl(filePath: string) {
    const relativePath = path
      .relative(process.cwd(), path.resolve(filePath))
      .replace(/\\/g, '/');

    return {
      provider: 'local',
      url: env.UPLOAD_PUBLIC_BASE_URL
        ? `${env.UPLOAD_PUBLIC_BASE_URL.replace(/\/$/, '')}/${relativePath}`
        : filePath
    };
  },

  async delete(fileUrl: string) {
    if (!fileUrl) return;

    const localFileUrl = stripPublicBaseUrl(fileUrl);
    if (/^https?:\/\//i.test(localFileUrl)) return;

    const absolutePath = path.resolve(localFileUrl);
    if (!absolutePath.startsWith(uploadRoot)) {
      logger.warn({ fileUrl }, 'Skipped file deletion outside upload root');
      return;
    }

    try {
      await unlink(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        logger.warn({ error, fileUrl }, 'Stored file cleanup failed');
      }
    }
  },

  async health() {
    try {
      await mkdir(uploadRoot, { recursive: true });
      await access(uploadRoot);

      return {
        provider: 'local',
        status: env.NODE_ENV === 'production' ? 'degraded' : 'online',
        writable: true,
        publicBaseUrl: env.UPLOAD_PUBLIC_BASE_URL,
        message:
          env.NODE_ENV === 'production'
            ? 'Local storage is available but not recommended for horizontally scaled production deployments'
            : 'Local storage is available'
      };
    } catch (error) {
      logger.error({ error, uploadRoot }, 'Local storage health check failed');
      return {
        provider: 'local',
        status: 'offline',
        writable: false,
        publicBaseUrl: env.UPLOAD_PUBLIC_BASE_URL,
        message: 'Upload directory is not accessible'
      };
    }
  }
};

const cloudPlaceholderProvider: FileStorageProvider = {
  resolvePublicUrl(filePath: string) {
    return {
      provider: env.STORAGE_PROVIDER,
      url: filePath
    };
  },

  async delete(fileUrl: string) {
    logger.warn(
      { fileUrl, provider: env.STORAGE_PROVIDER },
      'Cloud storage delete requested before provider implementation is configured'
    );
  },

  async health() {
    return {
      provider: env.STORAGE_PROVIDER,
      status: 'degraded',
      writable: false,
      message: `${env.STORAGE_PROVIDER} storage is selected but provider credentials/adapters are not configured yet`
    };
  }
};

export const fileStorageService =
  env.STORAGE_PROVIDER === 'local' ? localStorageProvider : cloudPlaceholderProvider;

export const getStorageHealth = () => fileStorageService.health();
