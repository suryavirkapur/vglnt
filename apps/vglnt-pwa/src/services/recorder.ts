// services/recorder.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from './database';
import {
  DrivingSession,
  DriveSegment,
  VideoChunk,
  GeoPoint,
  AccelerometerReading,
} from '../types';

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private currentSession: DrivingSession | null = null;
  private currentSegment: DriveSegment | null = null;
  private videoChunks: Blob[] = [];
  private sensorReadings = {
    accelerometer: [] as AccelerometerReading[],
    location: [] as GeoPoint[],
    speed: [] as number[],
    heading: [] as number[],
  };

  private readonly SEGMENT_DURATION = 5 * 60 * 1000; // 5 minutes
  private segmentTimer: NodeJS.Timeout | null = null;

  async startRecording(): Promise<void> {
    try {
      // Initialize video recording
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2000000, // 2 Mbps
      });

      // Create new session
      this.currentSession = {
        id: uuidv4(),
        startTime: Date.now(),
        endTime: null,
        route: {
          startLocation: await this.getCurrentLocation(),
          pathPoints: [],
        },
        segments: [],
        status: 'active',
      };

      await db.createSession(this.currentSession);

      // Start sensors
      this.startSensorCollection();

      // Start first segment
      this.startNewSegment();
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private startNewSegment(): void {
    const segmentId = uuidv4();

    this.currentSegment = {
      id: segmentId,
      videoChunkId: segmentId,
      startTime: Date.now(),
      endTime: 0,
      sensorData: {
        accelerometer: [],
        location: [],
        speed: [],
        heading: [],
      },
    };

    // Reset data collectors
    this.videoChunks = [];
    this.sensorReadings = {
      accelerometer: [],
      location: [],
      speed: [],
      heading: [],
    };

    // Start video recording
    this.mediaRecorder?.start();

    // Set timer for segment completion
    this.segmentTimer = setTimeout(() => {
      this.completeSegment();
    }, this.SEGMENT_DURATION);
  }

  private async completeSegment(): Promise<void> {
    if (!this.currentSegment || !this.currentSession) return;

    this.mediaRecorder?.stop();

    // Create video chunk
    const videoBlob = new Blob(this.videoChunks, { type: 'video/webm' });
    const videoChunk: VideoChunk = {
      id: this.currentSegment.videoChunkId,
      blob: videoBlob,
      startTime: this.currentSegment.startTime,
      duration: Date.now() - this.currentSegment.startTime,
    };

    // Complete segment data
    this.currentSegment.endTime = Date.now();
    this.currentSegment.sensorData = { ...this.sensorReadings };

    // Save to database
    await Promise.all([
      db.saveVideoChunk(videoChunk),
      db.saveSegment(this.currentSegment),
    ]);

    // Update session
    this.currentSession.segments.push(this.currentSegment);
    await db.createSession(this.currentSession);

    // Start new segment
    this.startNewSegment();
  }

  private startSensorCollection(): void {
    // Accelerometer
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.handleMotion);
    }

    // Geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(this.handleLocation, null, {
        enableHighAccuracy: true,
      });
    }
  }

  private handleMotion = (event: DeviceMotionEvent): void => {
    if (!event.accelerationIncludingGravity) return;

    const reading: AccelerometerReading = {
      x: event.accelerationIncludingGravity.x || 0,
      y: event.accelerationIncludingGravity.y || 0,
      z: event.accelerationIncludingGravity.z || 0,
      timestamp: Date.now(),
    };

    this.sensorReadings.accelerometer.push(reading);
  };

  private handleLocation = (position: GeolocationPosition): void => {
    const point: GeoPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: Date.now(),
    };

    this.sensorReadings.location.push(point);
    this.sensorReadings.speed.push(position.coords.speed || 0);
    this.sensorReadings.heading.push(position.coords.heading || 0);

    if (this.currentSession) {
      this.currentSession.route.pathPoints.push(point);
    }
  };

  private async getCurrentLocation(): Promise<GeoPoint> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
          });
        },
        reject,
        { enableHighAccuracy: true },
      );
    });
  }

  async stopRecording(): Promise<void> {
    // Complete current segment
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
    }
    await this.completeSegment();

    // Update session
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.status = 'completed';
      this.currentSession.route.endLocation = await this.getCurrentLocation();
      await db.createSession(this.currentSession);
    }

    // Cleanup
    this.mediaRecorder?.stop();
    window.removeEventListener('devicemotion', this.handleMotion);
    this.currentSession = null;
    this.currentSegment = null;
  }
}

export const recorder = new RecordingService();
