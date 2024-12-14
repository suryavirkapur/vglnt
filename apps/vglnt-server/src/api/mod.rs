use crate::types::AnalysisStatus;
use crate::{llm, lstm, video};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

pub mod handlers;
pub mod routes;

pub struct AppState {
    video_analyzer: Arc<video::VideoAnalyzer>,
    analysis_cache: Arc<DashMap<Uuid, AnalysisStatus>>,
}

impl AppState {
    pub fn new() -> anyhow::Result<Self> {
        Ok(Self {
            video_analyzer: Arc::new(video::VideoAnalyzer::new()?),
            analysis_cache: Arc::new(DashMap::new()),
        })
    }
}
