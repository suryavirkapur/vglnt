import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

// Types
interface DrivingAnalysis {
  lane_centering: {
    following_lane_discipline: boolean;
    score: number;
  };
  following_distance: {
    safe_distance: "safe" | "approximate" | "unsafe";
    score: number;
  };
  signal_compliance: {
    traffic_light: {
      status: "red" | "yellow" | "green";
      compliance: boolean;
      score: number;
    };
    stop_sign: {
      present: boolean;
      compliance: boolean | "N/A";
      score: number;
    };
  };
  merging_lane_change: {
    safe_merging: boolean;
    score: number;
  };
  pedestrian_yielding: {
    pedestrian_present: boolean;
    score: number;
  };
  intersection_behavior: {
    stop_line_observance: boolean;
    score: number;
  };
  road_sign_awareness: {
    speed_limit_sign: {
      visible: boolean;
      observing_limit: "observing" | "exceeding" | "unknown";
      score: number;
    };
    yield_sign: {
      visible: boolean;
      score: number;
    };
  };
  shoulder_use: {
    using_shoulder: boolean;
    score: number;
  };
  comment?: string;
}

interface AnalysisSectionProps {
  title: string;
  score: number;
  maxScore: number;
  details: Array<{
    label: string;
    value: string;
  }>;
}

// Analysis Section Component
function AnalysisSection({
  title,
  score,
  maxScore,
  details,
}: AnalysisSectionProps) {
  return (
    <div className="border-t pt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm text-gray-600">
          {score}/{maxScore}
        </span>
      </div>
      <Progress value={(score / maxScore) * 100} className="mb-2" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        {details.map(({ label, value }, index) => (
          <div key={index} className="flex justify-between">
            <span className="text-gray-600">{label}:</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [file, setFile] = React.useState<File | null>(null);
  const [analysis, setAnalysis] = React.useState<DrivingAnalysis | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: "Please select a video file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const response = await fetch(
        "https://u0skw4g00k44gss00ckw80oc.13.76.121.152.sslip.io/video/analyze",
        {
          method: "POST",
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = await response.json();
      console.log(data);
      setAnalysis(data);
      toast({
        title: "Analysis complete",
        description: "Your video has been analyzed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to analyze video",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalScore = (analysis: DrivingAnalysis) => {
    return (
      analysis.lane_centering.score +
      analysis.following_distance.score +
      analysis.signal_compliance.traffic_light.score +
      analysis.signal_compliance.stop_sign.score +
      analysis.merging_lane_change.score +
      analysis.pedestrian_yielding.score +
      analysis.intersection_behavior.score +
      analysis.road_sign_awareness.speed_limit_sign.score +
      analysis.road_sign_awareness.yield_sign.score +
      analysis.shoulder_use.score
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">
          Driving Behavior Analysis
        </h1>
        <div className="max-w-3xl mx-auto">
          {/* Upload Section */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="video/mp4"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="border-2 border-dashed rounded-lg p-4"
                  />
                  <p className="text-sm text-gray-500">
                    Upload an MP4 video file (max 50MB)
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!file || loading}
                >
                  {loading ? "Analyzing..." : "Analyze Video"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Loading Indicator */}
          {loading && (
            <div className="text-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Analyzing video...</p>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <div className="space-y-6 mt-8">
              {/* Overall Score Card */}
              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-2xl font-bold">Overall Score</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Progress
                      value={(calculateTotalScore(analysis) / 95) * 100}
                    />
                    <p className="text-right font-semibold">
                      {calculateTotalScore(analysis)}/100
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Analysis Card */}
              <Card>
                <CardHeader>
                  <h2 className="text-2xl font-bold">Detailed Analysis</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <AnalysisSection
                      title="Lane Centering"
                      score={analysis.lane_centering.score}
                      maxScore={20}
                      details={[
                        {
                          label: "Following Lane Discipline",
                          value: analysis.lane_centering
                            .following_lane_discipline
                            ? "Yes"
                            : "No",
                        },
                      ]}
                    />

                    <AnalysisSection
                      title="Following Distance"
                      score={analysis.following_distance.score}
                      maxScore={15}
                      details={[
                        {
                          label: "Safety Level",
                          value: analysis.following_distance.safe_distance,
                        },
                      ]}
                    />

                    <AnalysisSection
                      title="Signal Compliance"
                      score={
                        analysis.signal_compliance.traffic_light.score +
                        analysis.signal_compliance.stop_sign.score
                      }
                      maxScore={20}
                      details={[
                        {
                          label: "Traffic Light Status",
                          value:
                            analysis.signal_compliance.traffic_light.status,
                        },
                        {
                          label: "Traffic Light Compliance",
                          value: analysis.signal_compliance.traffic_light
                            .compliance
                            ? "Yes"
                            : "No",
                        },
                        {
                          label: "Stop Sign Present",
                          value: analysis.signal_compliance.stop_sign.present
                            ? "Yes"
                            : "No",
                        },
                        {
                          label: "Stop Sign Compliance",
                          value: String(
                            analysis.signal_compliance.stop_sign.compliance,
                          ),
                        },
                      ]}
                    />

                    <AnalysisSection
                      title="Merging & Lane Change"
                      score={analysis.merging_lane_change.score}
                      maxScore={10}
                      details={[
                        {
                          label: "Safe Merging",
                          value: analysis.merging_lane_change.safe_merging
                            ? "Yes"
                            : "No",
                        },
                      ]}
                    />

                    <AnalysisSection
                      title="Pedestrian Yielding"
                      score={analysis.pedestrian_yielding.score}
                      maxScore={10}
                      details={[
                        {
                          label: "Pedestrians Present",
                          value: analysis.pedestrian_yielding.pedestrian_present
                            ? "Yes"
                            : "No",
                        },
                      ]}
                    />

                    <AnalysisSection
                      title="Road Signs"
                      score={
                        analysis.road_sign_awareness.speed_limit_sign.score +
                        analysis.road_sign_awareness.yield_sign.score
                      }
                      maxScore={20}
                      details={[
                        {
                          label: "Speed Limit Compliance",
                          value:
                            analysis.road_sign_awareness.speed_limit_sign
                              .observing_limit,
                        },
                        {
                          label: "Yield Sign Visible",
                          value: analysis.road_sign_awareness.yield_sign.visible
                            ? "Yes"
                            : "No",
                        },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
