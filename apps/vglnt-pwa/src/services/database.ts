import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  DrivingSession,
  DriveSegment,
  VideoChunk,
  StorageMetrics,
} from '../types';

interface DrivingRecorderDB extends DBSchema {
  sessions: {
    key: string;
    value: DrivingSession;
    indexes: { 'by-start': number };
  };
  segments: {
    key: string;
    value: DriveSegment;
    indexes: { 'by-session': string };
  };
  videoChunks: {
    key: string;
    value: VideoChunk;
  };
  metrics: {
    key: 'storage';
    value: StorageMetrics;
  };
}

export class DatabaseService {
  private db: IDBPDatabase<DrivingRecorderDB> | null = null;
  private readonly DB_NAME = 'DrivingRecorderDB';
  private readonly DB_VERSION = 1;

  async initialize(): Promise<void> {
    this.db = await openDB<DrivingRecorderDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Sessions store
        const sessionStore = db.createObjectStore('sessions', {
          keyPath: 'id',
        });
        sessionStore.createIndex('by-start', 'startTime');

        // Segments store
        const segmentStore = db.createObjectStore('segments', {
          keyPath: 'id',
        });
        segmentStore.createIndex('by-session', 'sessionId');

        // Video chunks store
        db.createObjectStore('videoChunks', { keyPath: 'id' });

        // Metrics store
        db.createObjectStore('metrics');
      },
    });
  }
  async getAllSessions(): Promise<DrivingSession[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllFromIndex('sessions', 'by-start');
  }

  async getSessionSegments(sessionId: string): Promise<DriveSegment[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllFromIndex('segments', 'by-session', sessionId);
  }

  async getVideoChunk(id: string): Promise<VideoChunk> {
    if (!this.db) throw new Error('Database not initialized');
    const chunk = await this.db.get('videoChunks', id);
    if (!chunk) throw new Error('Video chunk not found');
    return chunk;
  }

  // Add this method for bulk export
  async exportSessionData(sessionId: string): Promise<{
    session: DrivingSession;
    segments: DriveSegment[];
    videos: VideoChunk[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const segments = await this.getSessionSegments(sessionId);
    const videos = await Promise.all(
      segments.map((segment) => this.getVideoChunk(segment.videoChunkId)),
    );

    return {
      session,
      segments,
      videos,
    };
  }

  async createSession(session: DrivingSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('sessions', session);
  }

  async saveSegment(segment: DriveSegment): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('segments', segment);
  }

  async saveVideoChunk(chunk: VideoChunk): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('videoChunks', chunk);
  }

  async getSession(id: string): Promise<DrivingSession | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get('sessions', id);
  }

  async updateStorageMetrics(metrics: StorageMetrics): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('metrics', metrics, 'storage');
  }

  async cleanupOldSessions(maxAgeMs: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(
      ['sessions', 'segments', 'videoChunks'],
      'readwrite',
    );
    const threshold = Date.now() - maxAgeMs;

    // Get old sessions
    const oldSessions = await tx.store
      .index('by-start')
      .getAllKeys(IDBKeyRange.upperBound(threshold));

    // Delete related data
    for (const sessionId of oldSessions) {
      const segments = await tx
        .objectStore('segments')
        .index('by-session')
        .getAllKeys(sessionId);
      for (const segmentId of segments) {
        await tx.objectStore('segments').delete(segmentId);
        await tx.objectStore('videoChunks').delete(segmentId);
      }
      await tx.objectStore('sessions').delete(sessionId);
    }
  }
}

export const db = new DatabaseService();
