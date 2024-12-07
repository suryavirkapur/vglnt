import React, { useState, useEffect, useRef } from 'react';
import { Camera, StopCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recorder } from '../services/recorder';
import { db } from '../services/database';

const DrivingRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializeDB = async () => {
      try {
        await db.initialize();
      } catch (err) {
        setError('Failed to initialize database');
      }
    };

    initializeDB();
  }, []);

  const startRecording = async () => {
    try {
      await recorder.startRecording();
      setIsRecording(true);

      // Set up video preview
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stopRecording();
      setIsRecording(false);

      // Stop video preview
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    } catch (err) {
      setError('Failed to stop recording');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Driving Recorder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video bg-slate-900 rounded-lg"
            />

            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording}>
                  <Camera className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive">
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Recording
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrivingRecorder;
