import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '../services/database';
import { DrivingSession, DriveSegment } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const SessionViewer: React.FC = () => {
  const [sessions, setSessions] = useState<DrivingSession[]>([]);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
    return () => {
      Object.values(videoUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await db.getAllSessions();
      setSessions(allSessions.sort((a, b) => b.startTime - a.startTime));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
    setLoading(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: number, end: number | null) => {
    const duration = ((end || Date.now()) - start) / 1000;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const exportSession = async (session: DrivingSession) => {
    try {
      const segments = await db.getSessionSegments(session.id);
      const videoChunks = await Promise.all(
        segments.map((segment) => db.getVideoChunk(segment.videoChunkId)),
      );

      const exportData = {
        sessionInfo: {
          id: session.id,
          startTime: formatDate(session.startTime),
          endTime: session.endTime ? formatDate(session.endTime) : null,
          duration: formatDuration(session.startTime, session.endTime),
          route: session.route,
        },
        segments: segments.map((segment, index) => ({
          ...segment,
          videoUrl: URL.createObjectURL(videoChunks[index].blob),
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `driving-session-${session.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
    }
  };

  const exportVideo = async (segment: DriveSegment) => {
    try {
      const videoChunk = await db.getVideoChunk(segment.videoChunkId);
      const url = URL.createObjectURL(videoChunk.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment-${segment.id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export video:', error);
    }
  };

  const renderSensorData = (segment: DriveSegment) => {
    const accelerometerData = segment.sensorData.accelerometer.map(
      (reading) => ({
        timestamp: reading.timestamp - segment.startTime,
        x: reading.x,
        y: reading.y,
        z: reading.z,
      }),
    );

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Accelerometer Data</h4>
          <div className="w-full h-48">
            <LineChart
              data={accelerometerData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <Line type="monotone" dataKey="x" stroke="#8884d8" dot={false} />
              <Line type="monotone" dataKey="y" stroke="#82ca9d" dot={false} />
              <Line type="monotone" dataKey="z" stroke="#ffc658" dot={false} />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
            </LineChart>
          </div>
        </div>
      </div>
    );
  };

  const SegmentVideo: React.FC<{ segment: DriveSegment }> = ({ segment }) => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
      const loadVideo = async () => {
        try {
          const chunk = await db.getVideoChunk(segment.videoChunkId);
          const url = URL.createObjectURL(chunk.blob);
          setVideoUrl(url);
          return () => {
            if (url) URL.revokeObjectURL(url);
          };
        } catch (error) {
          console.error('Failed to load video:', error);
        }
      };

      loadVideo();
    }, [segment.videoChunkId]);

    if (!videoUrl) {
      return (
        <div className="w-full aspect-video bg-slate-800 rounded flex items-center justify-center">
          <span className="text-slate-400">Loading video...</span>
        </div>
      );
    }

    return <video controls className="w-full rounded" src={videoUrl} />;
  };

  const renderSegment = (segment: DriveSegment, index: number) => {
    return (
      <Card key={segment.id} className="mt-2">
        <CardHeader>
          <CardTitle className="text-sm">
            Segment {index + 1} - {formatDate(segment.startTime)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <SegmentVideo segment={segment} />

            <div className="flex justify-between items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportVideo(segment)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Video
              </Button>
            </div>

            {renderSensorData(segment)}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Driving Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Accordion type="single" collapsible>
              {sessions.map((session) => (
                <AccordionItem key={session.id} value={session.id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full">
                      <span>{formatDate(session.startTime)}</span>
                      <span className="text-sm text-gray-500">
                        {formatDuration(session.startTime, session.endTime)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">Session Details</h3>
                        <Button
                          size="sm"
                          onClick={() => exportSession(session)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Session
                        </Button>
                      </div>
                      {session.segments.map((segment, index) =>
                        renderSegment(segment, index),
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionViewer;
