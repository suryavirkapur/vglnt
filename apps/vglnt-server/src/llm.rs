use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};
use crate::types::FrameData;
use tracing::{error, info};
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

pub struct LLMClient {
    client: Client,
    endpoint: String,
}

impl LLMClient {
    pub fn new() -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(300))
                .build()?,
            endpoint: "http://localhost:9997/completion".to_string(),
        })
    }

    pub async fn analyze_frame(&self, frame_data: &[u8], frame_number: u32) -> Result<FrameData> {
        // Convert image to base64
        let base64_image = BASE64.encode(frame_data);
        
        // Construct the minimal prompt with just the schema and image
        let prompt = format!(
            r#"Analyze this driving frame and output ONLY a JSON object matching this schema:
DRIVING_ANALYSIS_SCHEMA = {{
    "lane_centering": {{"following_lane_discipline": bool, "score": float}},
    "following_distance": {{"safe_distance": "safe" | "unsafe", "score": float}},
    "signal_compliance": {{
        "traffic_light": {{"status": "red" | "yellow" | "green", "compliance": bool, "score": float}},
        "stop_sign": {{"present": bool, "compliance": bool | "N/A", "score": float}}
    }},
    "merging_lane_change": {{"safe_merging": bool, "score": float}},
    "pedestrian_yielding": {{"pedestrian_present": bool, "score": float}},
    "intersection_behavior": {{"stop_line_observance": bool, "score": float}},
    "road_sign_awareness": {{
        "speed_limit_sign": {{"visible": bool, "observing_limit": "yes" | "no" | "unknown", "score": float}},
        "yield_sign": {{"visible": bool, "score": float}}
    }},
    "shoulder_use": {{"using_shoulder": bool, "score": float}}
}}

[Frame #{} - Base64 Image]: {}"#,
            frame_number, base64_image
        );

        let response = self.client
            .post(&self.endpoint)
            .json(&json!({
                "prompt": prompt,
                "max_tokens": 1000,
                "temperature": 0.1,
                "stop": ["}}", "\n"],
                "stream": false
            }))
            .send()
            .await?;

        let resp_json: Value = response.json().await?;
        let content = resp_json["content"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid response format"))?;

        let cleaned_content = content
            .trim()
            .trim_matches(|c| c == '`' || c == '\n' || c == ' ');

        let analysis: FrameData = serde_json::from_str(cleaned_content)
            .map_err(|e| {
                error!("Failed to parse LLM response: {}", cleaned_content);
                anyhow::anyhow!("JSON parse error: {}", e)
            })?;

        Ok(analysis)
    }

    pub async fn process_batch(&self, frames: Vec<(&[u8], u32)>) -> Result<Vec<FrameData>> {
        let mut results = Vec::with_capacity(frames.len());
        
        for (frame_data, frame_number) in frames {
            match self.analyze_frame(frame_data, frame_number).await {
                Ok(analysis) => results.push(analysis),
                Err(e) => {
                    error!("Failed to analyze frame {}: {}", frame_number, e);
                    // coutinue if one fails
                    continue;
                }
            }
        }

        Ok(results)
    }
}