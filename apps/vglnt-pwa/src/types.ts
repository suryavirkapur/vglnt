interface SensorAcceleration {
  x: number;
  y: number;
  z: number;
}

interface SensorLocation {
  latitude: number | null;
  longitude: number | null;
}

interface SensorData {
  acceleration: SensorAcceleration;
  location: SensorLocation;
}

interface Recording {
  id: string;
  videoUrl: string;
  sensorData: SensorData;
  timestamp: string;
}
export interface GeoPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface AccelerometerReading {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface VideoChunk {
  id: string;
  blob: Blob;
  startTime: number;
  duration: number;
}

export interface DriveSegment {
  id: string;
  videoChunkId: string;
  startTime: number;
  endTime: number;
  sensorData: {
    accelerometer: AccelerometerReading[];
    location: GeoPoint[];
    speed: number[];
    heading: number[];
  };
}

export interface DrivingSession {
  id: string;
  startTime: number;
  endTime: number | null;
  route: {
    startLocation: GeoPoint;
    endLocation?: GeoPoint;
    pathPoints: GeoPoint[];
  };
  segments: DriveSegment[];
  status: 'active' | 'completed' | 'error';
}

export interface StorageMetrics {
  usedSpace: number;
  availableSpace: number;
  oldestSession: number;
  activeSegments: number;
}
