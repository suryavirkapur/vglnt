import { createVertex } from "@ai-sdk/google-vertex";
import fs from "node:fs";

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT || "raterlog",
  location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
});

const prompt = fs.readFileSync("./prompt.txt", "utf8");
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

import { generateObject } from "ai";
import { z } from "zod";

const res = await generateObject({
  model: vertex("gemini-1.5-flash", { structuredOutputs: true }),
  schema: drivingBehaviorAnalysisSchema,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "file",
          data: fs.readFileSync("./video.mp4"),
          mimeType: "video/mp4",
        },
      ],
    },
  ],

  prompt,
});
