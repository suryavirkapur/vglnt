use crate::types::{
    BehavioralMetrics, FrameAnalysis, LSTMOutput, RiskFactor, RiskFactorType, RiskLevel,
    TemporalPattern,
};
use anyhow::{Context, Result};
use std::sync::Arc;
use tch::{nn, Device, Kind, Tensor};
use tracing::{error, info};

const INPUT_SIZE: i64 = 8;
const HIDDEN_SIZE: i64 = 128;
const NUM_LAYERS: i64 = 2;
const SEQUENCE_LENGTH: i64 = 30;

pub struct LSTMModel {
    vs: nn::VarStore,
    lstm: nn::LSTM,
    fc1: nn::Linear,
    fc2: nn::Linear,
    device: Device,
}

impl LSTMModel {
    pub fn new() -> Result<Self> {
        let device = Device::cuda_if_available();
        let vs = nn::VarStore::new(device);
        let root = vs.root();

        let lstm = nn::lstm(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, &vs.root());
        let fc1 = nn::linear(HIDDEN_SIZE, 64, &root);
        let fc2 = nn::linear(64, 32, &root);

        Ok(Self {
            vs,
            lstm,
            fc1,
            fc2,
            device,
        })
    }

    pub fn load_weights(&mut self, path: &str) -> Result<()> {
        self.vs
            .load(path)
            .with_context(|| format!("Failed to load weights from {}", path))?;
        Ok(())
    }

    pub fn process_sequence(&self, analyses: &[FrameAnalysis]) -> Result<LSTMOutput> {
        let features = self.extract_features(analyses)?;

        let lstm_out = self.forward_pass(&features)?;

        let risk_factors = self.analyze_risks(&lstm_out)?;
        let temporal_patterns = self.detect_patterns(&lstm_out)?;
        let behavioral_metrics = self.calculate_metrics(&lstm_out)?;
        let overall_score = self.calculate_safety_score(&lstm_out);

        Ok(LSTMOutput {
            overall_safety_score: overall_score,
            risk_factors,
            temporal_patterns,
            behavioral_metrics,
        })
    }

    fn extract_features(&self, analyses: &[FrameAnalysis]) -> Result<Tensor> {
        let mut feature_vec = Vec::new();

        for analysis in analyses {
            // Extract key features from each frame
            let frame_features = vec![
                if analysis.lane_centering.following_lane_discipline {
                    1.0
                } else {
                    0.0
                },
                analysis.lane_centering.score / 100.0,
                match analysis.following_distance.safe_distance {
                    "safe" => 1.0,
                    "unsafe" => 0.0,
                    _ => 0.5,
                },
                analysis.following_distance.score / 100.0,
                analysis.signal_compliance.traffic_light.score / 100.0,
                if analysis.merging_lane_change.safe_merging {
                    1.0
                } else {
                    0.0
                },
                // Pedestrian awareness
                if analysis.pedestrian_yielding.pedestrian_present {
                    1.0
                } else {
                    0.0
                },
                self.calculate_frame_score(analysis),
            ];

            feature_vec.extend(frame_features);
        }

        let tensor = Tensor::of_slice(&feature_vec)
            .to_device(self.device)
            .reshape(&[analyses.len() as i64, 1, INPUT_SIZE]);

        Ok(tensor)
    }

    fn forward_pass(&self, features: &Tensor) -> Result<Tensor> {
        let (lstm_out, _) = self.lstm.seq_init(1).seq(features)?;

        let hidden = self.fc1.forward(&lstm_out);
        let output = self.fc2.forward(&hidden);

        Ok(output)
    }

    fn analyze_risks(&self, lstm_output: &Tensor) -> Result<Vec<RiskFactor>> {
        let mut risk_factors = Vec::new();
        let output_slice = lstm_output.mean_dim(&[0], true, Kind::Float)?;

        if let Ok(scores) = Vec::<f32>::try_from(&output_slice) {
            if scores[0] > 0.7 {
                risk_factors.push(RiskFactor {
                    factor_type: RiskFactorType::LaneDeviation,
                    severity: scores[0],
                    frequency: self.calculate_frequency(lstm_output, 0)?,
                    temporal_correlation: self.calculate_temporal_correlation(lstm_output, 0)?,
                });
            }

            if scores[1] > 0.6 {
                risk_factors.push(RiskFactor {
                    factor_type: RiskFactorType::FollowingDistance,
                    severity: scores[1],
                    frequency: self.calculate_frequency(lstm_output, 1)?,
                    temporal_correlation: self.calculate_temporal_correlation(lstm_output, 1)?,
                });
            }
        }

        Ok(risk_factors)
    }

    fn detect_patterns(&self, lstm_output: &Tensor) -> Result<Vec<TemporalPattern>> {
        let mut patterns = Vec::new();
        let sequence_length = lstm_output.size()[0];

        for feature_idx in 0..INPUT_SIZE {
            let feature_scores = lstm_output.select(2, feature_idx);

            let mean_score = feature_scores.mean(Kind::Float)?;
            let variance = feature_scores.var(true, Kind::Float)?;

            if variance.double_value(&[]) < 0.1 && mean_score.double_value(&[]) > 0.7 {
                patterns.push(TemporalPattern {
                    pattern_type: self.get_pattern_type(feature_idx),
                    duration: (sequence_length as f32) / 30.0, // Convert to seconds assuming 30fps
                    frequency: self.calculate_pattern_frequency(&feature_scores)?,
                    risk_contribution: self.calculate_risk_contribution(&feature_scores)?,
                });
            }
        }

        Ok(patterns)
    }

    fn calculate_metrics(&self, lstm_output: &Tensor) -> Result<BehavioralMetrics> {
        Ok(BehavioralMetrics {
            aggression_index: self.calculate_aggression_index(lstm_output)?,
            attention_score: self.calculate_attention_score(lstm_output)?,
            consistency_rating: self.calculate_consistency_rating(lstm_output)?,
            anticipation_level: self.calculate_anticipation_level(lstm_output)?,
        })
    }

    fn calculate_safety_score(&self, lstm_output: &Tensor) -> f32 {
        let score = lstm_output
            .mean_dim(&[0, 1], false, Kind::Float)
            .get(0)
            .unwrap_or(0.0);

        (score * 100.0).clamp(0.0, 100.0)
    }

    fn calculate_frame_score(&self, analysis: &FrameAnalysis) -> f32 {
        let scores = vec![
            analysis.lane_centering.score,
            analysis.following_distance.score,
            analysis.signal_compliance.traffic_light.score,
            analysis.merging_lane_change.score,
            analysis.pedestrian_yielding.score,
            analysis.intersection_behavior.score,
        ];

        scores.iter().sum::<f32>() / scores.len() as f32
    }

    fn calculate_frequency(&self, output: &Tensor, feature_idx: i64) -> Result<f32> {
        let feature_scores = output.select(2, feature_idx);
        let threshold = 0.7;
        let high_scores = feature_scores.gt(threshold);
        Ok((high_scores.sum(Kind::Float)?.double_value(&[]) as f32)
            / (feature_scores.size()[0] as f32))
    }

    fn calculate_temporal_correlation(&self, output: &Tensor, feature_idx: i64) -> Result<f32> {
        let feature_scores = output.select(2, feature_idx);
        let shifted_scores = feature_scores.slice(0, 1, feature_scores.size()[0], 1);
        let correlation = feature_scores
            .slice(0, 0, feature_scores.size()[0] - 1, 1)
            .corrcoef(&shifted_scores)?;
        Ok(correlation.double_value(&[]) as f32)
    }

    fn get_pattern_type(&self, feature_idx: i64) -> String {
        match feature_idx {
            0 => "Lane Discipline".to_string(),
            1 => "Following Distance".to_string(),
            2 => "Signal Compliance".to_string(),
            3 => "Merging Behavior".to_string(),
            4 => "Pedestrian Awareness".to_string(),
            _ => "General Driving".to_string(),
        }
    }

    fn calculate_pattern_frequency(&self, scores: &Tensor) -> Result<f32> {
        let threshold = 0.7;
        let transitions = scores.gt(threshold).diff();
        Ok((transitions.sum(Kind::Float)?.double_value(&[]) as f32) / (scores.size()[0] as f32))
    }

    fn calculate_risk_contribution(&self, scores: &Tensor) -> Result<f32> {
        let mean_score = scores.mean(Kind::Float)?;
        let variance = scores.var(true, Kind::Float)?;
        Ok((mean_score.double_value(&[]) * (1.0 + variance.double_value(&[]))) as f32)
    }

    fn calculate_aggression_index(&self, output: &Tensor) -> Result<f32> {
        let sudden_changes = output.diff().abs().mean(Kind::Float)?;
        Ok(sudden_changes.double_value(&[]) as f32)
    }

    fn calculate_attention_score(&self, output: &Tensor) -> Result<f32> {
        let attention_variance = output.var(true, Kind::Float)?;
        Ok((1.0 - attention_variance.double_value(&[])).clamp(0.0, 1.0) as f32)
    }

    fn calculate_consistency_rating(&self, output: &Tensor) -> Result<f32> {
        let consistency = 1.0 - output.std(true, Kind::Float)?.double_value(&[]);
        Ok(consistency as f32)
    }

    fn calculate_anticipation_level(&self, output: &Tensor) -> Result<f32> {
        let transitions = output.diff();
        let smoothness = 1.0 - transitions.abs().mean(Kind::Float)?.double_value(&[]);
        Ok(smoothness as f32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_model_creation() {
        let model = LSTMModel::new();
        assert!(model.is_ok());
    }

    #[test]
    fn test_feature_extraction() {
        let model = LSTMModel::new().unwrap();
        let analyses = create_test_analyses();
        let features = model.extract_features(&analyses);
        assert!(features.is_ok());
    }

    fn create_test_analyses() -> Vec<FrameAnalysis> {
        vec![FrameAnalysis {
            frame_number: 1,
            timestamp: 0.0,
            lane_centering: LaneCentering {
                following_lane_discipline: true,
                score: 95.0,
            },
            following_distance: FollowingDistance {
                safe_distance: "safe".to_string(),
                score: 90.0,
            },
        }]
    }
}
