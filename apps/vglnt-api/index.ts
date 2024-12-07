import express from "express";
import multer from "multer";
import cors from "cors";
import { VideoProcessor } from "./split_into_frames";
import { processDrivingFrames } from "./process_frames";
import { processFiles } from "./score_processor";
import * as fs from "fs";

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
  credentials: true,
};

// Apply CORS middleware
app.use(cors(corsOptions));

const upload = multer({ dest: "uploads/" });

// Ensure temp directories exist
const TEMP_DIRS = ["uploads", "temp_frames"];
TEMP_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

interface AnalysisResponse {
  average_scores: {
    lane_centering: number;
    following_distance: number;
    signal_compliance: {
      traffic_light: number;
      stop_sign: number;
    };
    merging_lane_change: number;
    pedestrian_yielding: number;
    intersection_behavior: number;
    road_sign_awareness: {
      speed_limit_sign: number;
      yield_sign: number;
    };
    shoulder_use: number;
  };
  total_files_processed: number;
}

// Pre-flight request handler
app.options("/analyze-video", cors(corsOptions));

app.post("/analyze-video", upload.single("video"), async (req, res) => {
  const time = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const videoProcessor = new VideoProcessor();
    const inputPath = req.file.path;

    try {
      // Extract frames from video
      console.log("Extracting frames...");
      const frameFiles = await videoProcessor.extractFrames(inputPath, 1);
      console.log(`Extracted ${frameFiles.length} frames`);

      // Process frames with GPT-4 Vision
      console.log("Analyzing frames...");
      await processDrivingFrames("./temp_frames");

      // Calculate final scores
      console.log("Calculating final scores...");
      processFiles("./temp_frames");

      // Read and return the final output
      const finalOutput = JSON.parse(
        fs.readFileSync("final_output.json", "utf-8")
      ) as AnalysisResponse;

      // Cleanup
      // await videoProcessor.cleanup();
      // fs.unlinkSync(inputPath);
      // fs.unlinkSync("final_output.json");

      res.json(finalOutput);
    } catch (error) {
      console.error("Error processing video:", error);
      res.status(500).json({ error: "Error processing video" });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
  const end = Date.now();
  console.log(`Video processing took ${end - time} milliseconds`);
});

// Health check endpoint
app.get("/health", cors(corsOptions), (req, res) => {
  res.json({ status: "healthy" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
