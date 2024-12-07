import * as fs from "fs";
import * as path from "path";

interface RoadSignData {
  visible: boolean;
  observing_limit?: string;
  score: number;
}

interface SignalComplianceData {
  traffic_light: {
    status: string;
    compliance: boolean;
    score: number;
  };
  stop_sign: {
    present: boolean;
    compliance: string;
    score: number;
  };
}

interface DrivingData {
  lane_centering: {
    following_lane_discipline: boolean;
    score: number;
  };
  following_distance: {
    safe_distance: string;
    score: number;
  };
  signal_compliance: SignalComplianceData;
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
    speed_limit_sign: RoadSignData;
    yield_sign: RoadSignData;
  };
  shoulder_use: {
    using_shoulder: boolean;
    score: number;
  };
}

// Scoring criteria
const SCORING_CRITERIA = {
  lane_centering: 20,
  following_distance: 15,
  signal_compliance: {
    traffic_light: 10,
    stop_sign: 5,
  },
  merging_lane_change: 10,
  pedestrian_yielding: 10,
  intersection_behavior: 10,
  road_sign_awareness: {
    speed_limit_sign: 10,
    yield_sign: 5,
  },
  shoulder_use: 5,
};

function calculateNormalizedScore(actual: number, maximum: number): number {
  return (actual / maximum) * 100;
}

export function processFiles(directoryPath: string): void {
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".output"));

  if (files.length === 0) {
    console.error("No .output files found in the directory");
    return;
  }

  let totalScores = {
    lane_centering: 0,
    following_distance: 0,
    signal_compliance: {
      traffic_light: 0,
      stop_sign: 0,
    },
    merging_lane_change: 0,
    pedestrian_yielding: 0,
    intersection_behavior: 0,
    road_sign_awareness: {
      speed_limit_sign: 0,
      yield_sign: 0,
    },
    shoulder_use: 0,
  };

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const data: DrivingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Accumulate scores
    totalScores.lane_centering += calculateNormalizedScore(
      data.lane_centering.score,
      SCORING_CRITERIA.lane_centering
    );
    totalScores.following_distance += calculateNormalizedScore(
      data.following_distance.score,
      SCORING_CRITERIA.following_distance
    );
    totalScores.signal_compliance.traffic_light += calculateNormalizedScore(
      data.signal_compliance.traffic_light.score,
      SCORING_CRITERIA.signal_compliance.traffic_light
    );
    totalScores.signal_compliance.stop_sign += calculateNormalizedScore(
      data.signal_compliance.stop_sign.score,
      SCORING_CRITERIA.signal_compliance.stop_sign
    );
    totalScores.merging_lane_change += calculateNormalizedScore(
      data.merging_lane_change.score,
      SCORING_CRITERIA.merging_lane_change
    );
    totalScores.pedestrian_yielding += calculateNormalizedScore(
      data.pedestrian_yielding.score,
      SCORING_CRITERIA.pedestrian_yielding
    );
    totalScores.intersection_behavior += calculateNormalizedScore(
      data.intersection_behavior.score,
      SCORING_CRITERIA.intersection_behavior
    );
    totalScores.road_sign_awareness.speed_limit_sign +=
      calculateNormalizedScore(
        data.road_sign_awareness.speed_limit_sign.score,
        SCORING_CRITERIA.road_sign_awareness.speed_limit_sign
      );
    totalScores.road_sign_awareness.yield_sign += calculateNormalizedScore(
      data.road_sign_awareness.yield_sign.score,
      SCORING_CRITERIA.road_sign_awareness.yield_sign
    );
    totalScores.shoulder_use += calculateNormalizedScore(
      data.shoulder_use.score,
      SCORING_CRITERIA.shoulder_use
    );
  });

  // Calculate averages
  const numFiles = files.length;
  const finalOutput = {
    average_scores: {
      lane_centering: totalScores.lane_centering / numFiles,
      following_distance: totalScores.following_distance / numFiles,
      signal_compliance: {
        traffic_light: totalScores.signal_compliance.traffic_light / numFiles,
        stop_sign: totalScores.signal_compliance.stop_sign / numFiles,
      },
      merging_lane_change: totalScores.merging_lane_change / numFiles,
      pedestrian_yielding: totalScores.pedestrian_yielding / numFiles,
      intersection_behavior: totalScores.intersection_behavior / numFiles,
      road_sign_awareness: {
        speed_limit_sign:
          totalScores.road_sign_awareness.speed_limit_sign / numFiles,
        yield_sign: totalScores.road_sign_awareness.yield_sign / numFiles,
      },
      shoulder_use: totalScores.shoulder_use / numFiles,
    },
    total_files_processed: numFiles,
  };

  fs.writeFileSync(
    "final_output.json",
    JSON.stringify(finalOutput, null, 2),
    "utf-8"
  );

  console.log("Processing complete. Results written to final_output.json");
}
