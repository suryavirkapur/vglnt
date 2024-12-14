import cv2
import os
import json
from pathlib import Path
import anthropic
import base64
import time
from dotenv import load_dotenv

load_dotenv()

DRIVING_ANALYSIS_SCHEMA = {
    "lane_centering": {"following_lane_discipline": True, "score": 20},
    "following_distance": {"safe_distance": "safe", "score": 15},
    "signal_compliance": {
        "traffic_light": {"status": "green", "compliance": True, "score": 15},
        "stop_sign": {"present": False, "compliance": "N/A", "score": 5},
    },
    "merging_lane_change": {"safe_merging": True, "score": 10},
    "pedestrian_yielding": {"pedestrian_present": False, "score": 10},
    "intersection_behavior": {"stop_line_observance": True, "score": 10},
    "road_sign_awareness": {
        "speed_limit_sign": {
            "visible": False,
            "observing_limit": "unknown",
            "score": 15,
        },
        "yield_sign": {"visible": False, "score": 5},
    },
    "shoulder_use": {"using_shoulder": False, "score": 5},
}


def extract_frames(video_path, output_dir, sample_rate=1):
    video = cv2.VideoCapture(video_path)
    frame_paths = []

    if not video.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    frame_count = 0
    while True:
        success, frame = video.read()
        if not success:
            break

        if frame_count % sample_rate == 0:
            frame_path = os.path.join(output_dir, f"frame_{frame_count:06d}.jpg")
            cv2.imwrite(frame_path, frame)
            frame_paths.append(frame_path)

        frame_count += 1

    video.release()
    return frame_paths


def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def analyze_frame(client, image_path):
    system_prompt = """You are an expert driving instructor analyzing dash cam footage. 
    Analyze the provided driving scene and return a JSON object EXACTLY matching this schema:
    
    {
        "lane_centering": {
            "following_lane_discipline": boolean,
            "score": number (0-20)
        },
        "following_distance": {
            "safe_distance": "safe" | "approximate" | "unsafe",
            "score": number (0-15)
        },
        "signal_compliance": {
            "traffic_light": {
                "status": "red" | "yellow" | "green",
                "compliance": boolean,
                "score": number (0-15)
            },
            "stop_sign": {
                "present": boolean,
                "compliance": boolean | "N/A",
                "score": number (0-5)
            }
        },
        "merging_lane_change": {
            "safe_merging": boolean,
            "score": number (0-10)
        },
        "pedestrian_yielding": {
            "pedestrian_present": boolean,
            "score": number (0-10)
        },
        "intersection_behavior": {
            "stop_line_observance": boolean,
            "score": number (0-10)
        },
        "road_sign_awareness": {
            "speed_limit_sign": {
                "visible": boolean,
                "observing_limit": "observing" | "exceeding" | "unknown",
                "score": number (0-15)
            },
            "yield_sign": {
                "visible": boolean,
                "score": number (0-5)
            }
        },
        "shoulder_use": {
            "using_shoulder": boolean,
            "score": number (0-5)
        }
    }
    
    Respond ONLY with the JSON object, no additional text."""

    try:
        image_data = encode_image(image_path)

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analyze this driving scene and provide a JSON response exactly matching the schema provided. Return ONLY the JSON object.",
                        },
                    ],
                }
            ],
        )

        content = (
            response.content[0].text
            if isinstance(response.content, list)
            else response.content
        )

        try:
            if isinstance(content, str):
                start_idx = content.find("{")
                end_idx = content.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    json_str = content[start_idx : end_idx + 1]
                    return json.loads(json_str)
            return None

        except json.JSONDecodeError:
            print(f"Failed to parse JSON from response for frame {image_path}")
            return None

    except Exception as e:
        print(f"Error analyzing frame {image_path}: {str(e)}")
        return None


def main():
    video_dir = Path("../../data/driving_povs")
    frames_dir = Path("../../data/frames")
    annotations_dir = Path("../../data/annotations")

    frames_dir.mkdir(parents=True, exist_ok=True)
    annotations_dir.mkdir(parents=True, exist_ok=True)

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    for video_file in video_dir.glob("*.mp4"):
        print(f"Processing video: {video_file}")

        video_frames_dir = frames_dir / video_file.stem
        video_annotations_dir = annotations_dir / video_file.stem
        video_frames_dir.mkdir(exist_ok=True)
        video_annotations_dir.mkdir(exist_ok=True)

        frame_paths = extract_frames(str(video_file), str(video_frames_dir))

        for frame_path in frame_paths:
            frame_name = Path(frame_path).stem
            annotation_path = video_annotations_dir / f"{frame_name}.json"

            if annotation_path.exists():
                continue

            analysis = analyze_frame(client, frame_path)
            if analysis:
                with open(annotation_path, "w") as f:
                    json.dump(analysis, f, indent=2)

            time.sleep(1)

        print(f"Completed processing {video_file}")


if __name__ == "__main__":
    main()
