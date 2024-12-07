import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

import { zodResponseFormat } from "openai/helpers/zod";
interface DrivingBehaviorAnalysis {
  lane_centering: LaneCentering;
  following_distance: FollowingDistance;
  signal_compliance: SignalCompliance;
  merging_lane_change: MergingLaneChange;
  pedestrian_yielding: PedestrianYielding;
  intersection_behavior: IntersectionBehavior;
  road_sign_awareness: RoadSignAwareness;
  shoulder_use: ShoulderUse;
}

interface LaneCentering {
  following_lane_discipline: boolean;
  score: number;
}

interface FollowingDistance {
  safe_distance: string;
  score: number;
}

interface SignalCompliance {
  traffic_light: TrafficLight;
  stop_sign: StopSign;
}

interface TrafficLight {
  status: string;
  compliance: boolean;
  score: number;
}

interface StopSign {
  present: boolean;
  compliance: string;
  score: number;
}

interface MergingLaneChange {
  safe_merging: boolean;
  score: number;
}

interface PedestrianYielding {
  pedestrian_present: boolean;
  score: number;
}

interface IntersectionBehavior {
  stop_line_observance: boolean;
  score: number;
}

interface RoadSignAwareness {
  speed_limit_sign: SpeedLimitSign;
  yield_sign: YieldSign;
}

interface SpeedLimitSign {
  visible: boolean;
  observing_limit: string;
  score: number;
}

interface YieldSign {
  visible: boolean;
  score: number;
}

interface ShoulderUse {
  using_shoulder: boolean;
  score: number;
}

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
});

async function analyzeDrivingBehavior(
  imagePath: string
): Promise<DrivingBehaviorAnalysis> {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: 'Analyze the provided driving scene and provide a detailed assessment of driving behavior according to the given drivingBehaviorAnalysisSchema.\n\nEnsure all components of the schema are addressed, even if the events were not observed in the scene (use default values accordingly). Evaluate the vehicle\'s actions and fill out every field with a detailed observation based on the schema outlined below. \n\n# Steps\n\n1. **Lane Centering**:\n   - Assess the vehicle\'s lane behavior: Are they centered within their lane without drifting?\n   - Provide a boolean value for whether lane discipline was followed.\n   - Assign a score between 0-20.\n\n2. **Following Distance**:\n   - Evaluate the vehicle’s distance from the preceding vehicle.\n   - Assign "safe," "approximate," or "unsafe," and score between 0-15.\n\n3. **Signal Compliance**:\n   - **Traffic Light**: \n     - Determine the traffic light\'s current status.\n     - Evaluate whether the driver respected the traffic light. Assign corresponding compliance and score.\n   - **Stop Sign**:\n     - Determine if a stop sign was present.\n     - Assess compliance (N/A if none was observed), provide a boolean value, and assign a score.\n\n4. **Merging Lane Change**:\n   - Determine if merging was executed safely.\n   - Provide a boolean response and assign a score from 0-10.\n\n5. **Pedestrian Yielding**:\n   - Determine if any pedestrians were present.\n   - If yes, assess the vehicle’s yielding behavior and provide a score between 0-10.\n\n6. **Intersection Behavior**:\n   - Determine whether the vehicle observed the stop line.\n   - Provide compliance feedback and assign a score from 0-10.\n\n7. **Road Sign Awareness**:\n   - **Speed Limit Sign**:\n     - Determine if a speed limit sign was visible.\n     - Assess whether the driver adhered to the posted limit or not.\n     - Provide a rating and assign a score from 0-15.\n   - **Yield Sign**:\n     - Evaluate whether a yield sign was visible.\n     - Assign a score between 0-5.\n\n8. **Shoulder Use**:\n   - Determine if the driver used the shoulder (improperly or appropriately).\n   - Provide a boolean value and assign a score from 0-5.\n\n# Output Format\nThe output must be in the form of a JSON object strictly matching the `drivingBehaviorAnalysisSchema`. Here is an example template to follow:\n\n```json\n{\n  "lane_centering": {\n    "following_lane_discipline": [true/false],\n    "score": [number between 0-20]\n  },\n  "following_distance": {\n    "safe_distance": ["safe", "approximate", "unsafe"],\n    "score": [number between 0-15]\n  },\n  "signal_compliance": {\n    "traffic_light": {\n      "status": ["red", "yellow", "green"],\n      "compliance": [true/false],\n      "score": [number between 0-15]\n    },\n    "stop_sign": {\n      "present": [true/false],\n      "compliance": [true/false or "N/A"],\n      "score": [number between 0-5]\n    }\n  },\n  "merging_lane_change": {\n    "safe_merging": [true/false],\n    "score": [number between 0-10]\n  },\n  "pedestrian_yielding": {\n    "pedestrian_present": [true/false],\n    "score": [number between 0-10]\n  },\n  "intersection_behavior": {\n    "stop_line_observance": [true/false],\n    "score": [number between 0-10]\n  },\n  "road_sign_awareness": {\n    "speed_limit_sign": {\n      "visible": [true/false],\n      "observing_limit": ["observing", "exceeding", "unknown"],\n      "score": [number between 0-15]\n    },\n    "yield_sign": {\n      "visible": [true/false],\n      "score": [number between 0-5]\n    }\n  },\n  "shoulder_use": {\n    "using_shoulder": [true/false],\n    "score": [number between 0-5]\n  }\n}\n```\n\n# Examples\n\n**Example Input**: \n("Provide a driving scene analysis similar to the example below. Use placeholders (in brackets) to represent specific dynamic values that will be substituted during actual analysis.")\n   \n**Example Output**:\n```json\n{\n  "lane_centering": {\n    "following_lane_discipline": true,\n    "score": 18\n  },\n  "following_distance": {\n    "safe_distance": "safe",\n    "score": 14\n  },\n  "signal_compliance": {\n    "traffic_light": {\n      "status": "red",\n      "compliance": true,\n      "score": 15\n    },\n    "stop_sign": {\n      "present": false,\n      "compliance": "N/A",\n      "score": 0\n    }\n  },\n  "merging_lane_change": {\n    "safe_merging": true,\n    "score": 10\n  },\n  "pedestrian_yielding": {\n    "pedestrian_present": false,\n    "score": 10\n  },\n  "intersection_behavior": {\n    "stop_line_observance": true,\n    "score": 9\n  },\n  "road_sign_awareness": {\n    "speed_limit_sign": {\n      "visible": true,\n      "observing_limit": "observing",\n      "score": 14\n    },\n    "yield_sign": {\n      "visible": false,\n      "score": 0\n    }\n  },\n  "shoulder_use": {\n    "using_shoulder": false,\n    "score": 5\n  }\n}\n```\n\n# Notes\n\n- Always ensure that every field in the provided schema is addressed and filled.\n- Use the default values when an element or event (e.g., stop sign, pedestrian) is not present to indicate this explicitly.\n- Be consistent and make reasonable assessments when assigning values and scores.',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "driving_behavior_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              lane_centering: {
                type: "object",
                properties: {
                  following_lane_discipline: {
                    type: "boolean",
                    description:
                      "Indicates whether the driver follows the lane discipline.",
                  },
                  score: {
                    type: "number",
                    description:
                      "Score for lane centering, ranging from 0 to 20.",
                  },
                },
                required: ["following_lane_discipline", "score"],
                additionalProperties: false,
              },
              following_distance: {
                type: "object",
                properties: {
                  safe_distance: {
                    type: "string",
                    enum: ["safe", "approximate", "unsafe"],
                    description:
                      "Indicates the safety of the following distance.",
                  },
                  score: {
                    type: "number",
                    description:
                      "Score for following distance, ranging from 0 to 15.",
                  },
                },
                required: ["safe_distance", "score"],
                additionalProperties: false,
              },
              signal_compliance: {
                type: "object",
                properties: {
                  traffic_light: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["red", "yellow", "green"],
                        description: "Current status of the traffic light.",
                      },
                      compliance: {
                        type: "boolean",
                        description:
                          "Indicates whether the traffic light was obeyed.",
                      },
                      score: {
                        type: "number",
                        description:
                          "Score for traffic light compliance, ranging from 0 to 15.",
                      },
                    },
                    required: ["status", "compliance", "score"],
                    additionalProperties: false,
                  },
                  stop_sign: {
                    type: "object",
                    properties: {
                      present: {
                        type: "boolean",
                        description:
                          "Indicates whether a stop sign was present.",
                      },
                      compliance: {
                        anyOf: [
                          {
                            type: "boolean",
                          },
                          {
                            type: "string",
                            enum: ["N/A"],
                          },
                        ],
                        description: "Indicates compliance with the stop sign.",
                      },
                      score: {
                        type: "number",
                        description:
                          "Score for stop sign compliance, ranging from 0 to 5.",
                      },
                    },
                    required: ["present", "compliance", "score"],
                    additionalProperties: false,
                  },
                },
                required: ["traffic_light", "stop_sign"],
                additionalProperties: false,
              },
              merging_lane_change: {
                type: "object",
                properties: {
                  safe_merging: {
                    type: "boolean",
                    description: "Indicates if merging was done safely.",
                  },
                  score: {
                    type: "number",
                    description:
                      "Score for merging lane changes, ranging from 0 to 10.",
                  },
                },
                required: ["safe_merging", "score"],
                additionalProperties: false,
              },
              pedestrian_yielding: {
                type: "object",
                properties: {
                  pedestrian_present: {
                    type: "boolean",
                    description: "Indicates if pedestrians were present.",
                  },
                  score: {
                    type: "number",
                    description:
                      "Score for yielding to pedestrians, ranging from 0 to 10.",
                  },
                },
                required: ["pedestrian_present", "score"],
                additionalProperties: false,
              },
              intersection_behavior: {
                type: "object",
                properties: {
                  stop_line_observance: {
                    type: "boolean",
                    description: "Indicates if the stop line was observed.",
                  },
                  score: {
                    type: "number",
                    description:
                      "Score for intersection behavior, ranging from 0 to 10.",
                  },
                },
                required: ["stop_line_observance", "score"],
                additionalProperties: false,
              },
              road_sign_awareness: {
                type: "object",
                properties: {
                  speed_limit_sign: {
                    type: "object",
                    properties: {
                      visible: {
                        type: "boolean",
                        description:
                          "Indicates if the speed limit sign is visible.",
                      },
                      observing_limit: {
                        type: "string",
                        enum: ["observing", "exceeding", "unknown"],
                        description: "Current speed limit status.",
                      },
                      score: {
                        type: "number",
                        description:
                          "Score for speed limit sign awareness, ranging from 0 to 15.",
                      },
                    },
                    required: ["visible", "observing_limit", "score"],
                    additionalProperties: false,
                  },
                  yield_sign: {
                    type: "object",
                    properties: {
                      visible: {
                        type: "boolean",
                        description: "Indicates if the yield sign is visible.",
                      },
                      score: {
                        type: "number",
                        description:
                          "Score for yield sign awareness, ranging from 0 to 5.",
                      },
                    },
                    required: ["visible", "score"],
                    additionalProperties: false,
                  },
                },
                required: ["speed_limit_sign", "yield_sign"],
                additionalProperties: false,
              },
              shoulder_use: {
                type: "object",
                properties: {
                  using_shoulder: {
                    type: "boolean",
                    description: "Indicates if the shoulder is being used.",
                  },
                  score: {
                    type: "number",
                    description: "Score for shoulder use, ranging from 0 to 5.",
                  },
                },
                required: ["using_shoulder", "score"],
                additionalProperties: false,
              },
            },
            required: [
              "lane_centering",
              "following_distance",
              "signal_compliance",
              "merging_lane_change",
              "pedestrian_yielding",
              "intersection_behavior",
              "road_sign_awareness",
              "shoulder_use",
            ],
            additionalProperties: false,
          },
        },
      },
    });
    const completion = response;
    console.log(completion.choices[0].message.content);
    const analysis = JSON.parse(
      completion.choices[0].message.content || ""
    ) as DrivingBehaviorAnalysis;
    return analysis;
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}

export async function processDrivingFrames(
  directoryPath: string
): Promise<void> {
  try {
    // Read all jpg files in the directory
    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => file.toLowerCase().endsWith(".jpg"));

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      console.log(`Processing ${file}...`);

      // Get analysis from GPT-4 Vision
      const analysis = await analyzeDrivingBehavior(filePath);

      // Create output filename
      const outputFile = path.join(
        directoryPath,
        `${path.basename(file, ".jpg")}.output`
      );

      // Write the analysis to output file
      fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));

      console.log(`Processed ${file} -> ${outputFile}`);

      // Add a small delay to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error processing frames:", error);
    throw error;
  }
}
