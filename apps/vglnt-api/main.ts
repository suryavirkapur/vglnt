import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { generateObject } from "ai";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Configure CORS
app.use(cors());
app.use(express.json());

// Configure Multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Define the schema for driving behavior analysis
const drivingBehaviorAnalysisSchema = z.object({
  lane_centering: z.object({
    following_lane_discipline: z.boolean(),
    score: z.number().min(0).max(20),
  }),
  following_distance: z.object({
    safe_distance: z.enum(["safe", "approximate", "unsafe"]),
    score: z.number().min(0).max(15),
  }),
  signal_compliance: z.object({
    traffic_light: z.object({
      status: z.enum(["red", "yellow", "green"]),
      compliance: z.boolean(),
      score: z.number().min(0).max(15),
    }),
    stop_sign: z.object({
      present: z.boolean(),
      compliance: z.union([z.boolean(), z.literal("N/A")]),
      score: z.number().min(0).max(5),
    }),
  }),
  merging_lane_change: z.object({
    safe_merging: z.boolean(),
    score: z.number().min(0).max(10),
  }),
  pedestrian_yielding: z.object({
    pedestrian_present: z.boolean(),
    score: z.number().min(0).max(10),
  }),
  intersection_behavior: z.object({
    stop_line_observance: z.boolean(),
    score: z.number().min(0).max(10),
  }),
  road_sign_awareness: z.object({
    speed_limit_sign: z.object({
      visible: z.boolean(),
      observing_limit: z.enum(["observing", "exceeding", "unknown"]),
      score: z.number().min(0).max(15),
    }),
    yield_sign: z.object({
      visible: z.boolean(),
      score: z.number().min(0).max(5),
    }),
  }),
  shoulder_use: z.object({
    using_shoulder: z.boolean(),
    score: z.number().min(0).max(5),
  }),
  commment: z.optional(z.string()),
});

// Initialize Vertex AI
const vertex = createGoogleGenerativeAI({

});

// Define interface for error response
interface ErrorResponse {
  error: string;
}

// POST endpoint for video analysis
app.post(
  "/api/analyze-video",
  upload.single("video"),
  async (
    req: Request,
    res: Response<z.infer<typeof drivingBehaviorAnalysisSchema> | ErrorResponse>
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      // Read the prompt file
      const prompt = fs.readFileSync(
        path.join(__dirname, "prompt.txt"),
        "utf8"
      );

      // Generate analysis using Vertex AI
      const analysis = await generateObject({
        model: vertex("gemini-1.5-flash", { structuredOutputs: true }),
        schema: drivingBehaviorAnalysisSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: fs.readFileSync(req.file.path),
                mimeType: "video/mp4",
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      // Clean up: Delete the uploaded file
      fs.unlinkSync(req.file.path);

      // Return the analysis
      console.log("Processing complete. Returning analysis...");
      return res.json(analysis.object);
    } catch (error) {
      console.error("Error processing video:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
