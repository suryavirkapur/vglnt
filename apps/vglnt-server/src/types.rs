use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisStatus {
    Queued,
    Processing {
        start_time: SystemTime,
        frames_processed: u32,
        total_frames: u32,
    },
    Complete {
        analysis: DrivingAnalysis,
        completion_time: SystemTime,
    },
    Failed {
        error: String,
        timestamp: SystemTime,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisMetadata {
    pub id: Uuid,
    pub filename: String,
    pub upload_time: SystemTime,
    pub video_duration: f64,
    pub frame_count: u32,
    pub fps: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrivingAnalysis {
    pub metadata: AnalysisMetadata,
    pub frame_analyses: Vec<FrameAnalysis>,
    pub lstm_output: LSTMOutput,
    pub summary: AnalysisSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameAnalysis {
    pub frame_number: u32,
    pub timestamp: f64,
    pub lane_centering: LaneCentering,
    pub following_distance: FollowingDistance,
    pub signal_compliance: SignalCompliance,
    pub merging_lane_change: MergingLaneChange,
    pub pedestrian_yielding: PedestrianYielding,
    pub intersection_behavior: IntersectionBehavior,
    pub road_sign_awareness: RoadSignAwareness,
    pub shoulder_use: ShoulderUse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaneCentering {
    pub following_lane_discipline: bool,
    pub deviation_from_center: f32,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowingDistance {
    pub safe_distance: SafetyStatus,
    pub distance_meters: f32,
    pub time_to_collision: f32,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalCompliance {
    pub traffic_light: TrafficLightStatus,
    pub stop_sign: StopSignStatus,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergingLaneChange {
    pub safe_merging: bool,
    pub signal_used: bool,
    pub blind_spot_check: bool,
    pub speed_adjustment: f32,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PedestrianYielding {
    pub pedestrian_present: bool,
    pub proper_yielding: bool,
    pub distance_to_pedestrian: Option<f32>,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntersectionBehavior {
    pub stop_line_observance: bool,
    pub complete_stop: bool,
    pub right_of_way_compliance: bool,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadSignAwareness {
    pub speed_limit: SpeedLimitStatus,
    pub yield_sign: YieldSignStatus,
    pub other_signs: Vec<RoadSign>,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoulderUse {
    pub using_shoulder: bool,
    pub emergency_situation: bool,
    pub score: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSTMOutput {
    pub overall_safety_score: f32,
    pub risk_factors: Vec<RiskFactor>,
    pub temporal_patterns: Vec<TemporalPattern>,
    pub behavioral_metrics: BehavioralMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSummary {
    pub overall_score: f32,
    pub risk_level: RiskLevel,
    pub critical_events: Vec<CriticalEvent>,
    pub improvement_areas: Vec<ImprovementArea>,
    pub stats: DrivingStats,
}

// Supporting Types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyStatus {
    Safe,
    Marginal,
    Unsafe,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficLightStatus {
    pub status: SignalColor,
    pub compliance: bool,
    pub distance: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopSignStatus {
    pub present: bool,
    pub compliance: Option<bool>,
    pub stop_duration: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitStatus {
    pub visible: bool,
    pub limit: Option<u32>,
    pub current_speed: Option<f32>,
    pub compliance: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YieldSignStatus {
    pub visible: bool,
    pub compliance: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadSign {
    pub sign_type: String,
    pub confidence: f32,
    pub distance: f32,
    pub compliance: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor_type: RiskFactorType,
    pub severity: f32,
    pub frequency: f32,
    pub temporal_correlation: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalPattern {
    pub pattern_type: String,
    pub duration: f32,
    pub frequency: f32,
    pub risk_contribution: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehavioralMetrics {
    pub aggression_index: f32,
    pub attention_score: f32,
    pub consistency_rating: f32,
    pub anticipation_level: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalEvent {
    pub event_type: String,
    pub timestamp: f64,
    pub severity: f32,
    pub context: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovementArea {
    pub area: String,
    pub current_score: f32,
    pub target_score: f32,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrivingStats {
    pub total_duration: f64,
    pub distance_covered: f32,
    pub average_speed: f32,
    pub max_speed: f32,
    pub harsh_braking_count: u32,
    pub rapid_acceleration_count: u32,
    pub traffic_light_encounters: u32,
    pub stop_sign_encounters: u32,
    pub lane_changes: u32,
}

// Enums

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SignalColor {
    Red,
    Yellow,
    Green,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskFactorType {
    FollowingDistance,
    SpeedControl,
    LaneDeviation,
    SignalCompliance,
    PedestrianAwareness,
    IntersectionBehavior,
    MergingTechnique,
    Other(String),
}

// API Response Types

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub analysis_id: Uuid,
    pub status: String,
    pub estimated_time: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub analysis_id: Uuid,
    pub status: AnalysisStatus,
    pub progress: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisListResponse {
    pub analyses: Vec<AnalysisSummaryItem>,
    pub total_count: usize,
    pub page: usize,
    pub per_page: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisSummaryItem {
    pub id: Uuid,
    pub filename: String,
    pub status: AnalysisStatus,
    pub upload_time: SystemTime,
    pub overall_score: Option<f32>,
}
