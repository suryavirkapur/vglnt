use actix_multipart::Multipart;
use actix_web::{web, HttpResponse};
use futures::{StreamExt, TryStreamExt};
use uuid::Uuid;
use std::io::Write;
use tempfile::NamedTempFile;
use crate::error::AppError;
use super::AppState;

pub async fn upload_video(
    mut payload: Multipart,
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, AppError> {
    let analysis_id = Uuid::new_v4();
    let mut temp_file = NamedTempFile::new()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    while let Ok(Some(mut field)) = payload.try_next().await {
        while let Some(chunk) = field.next().await {
            let data = chunk.map_err(|e| AppError::InvalidInput(e.to_string()))?;
            temp_file.write_all(&data)
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }
    }
    
    let path = temp_file.path().to_str()
        .ok_or_else(|| AppError::Internal("Invalid path".to_string()))?;
    
    state.analysis_cache.insert(analysis_id, AnalysisStatus::Processing);
    
    // Spawn analysis task
    let state = Arc::clone(&state);
    let path = path.to_string();
    tokio::spawn(async move {
        match state.video_analyzer.process_video(&path).await {
            Ok(result) => {
                state.analysis_cache.insert(analysis_id, AnalysisStatus::Complete(result));
            }
            Err(e) => {
                state.analysis_cache.insert(
                    analysis_id,
                    AnalysisStatus::Failed(e.to_string())
                );
            }
        }
    });
    
    Ok(HttpResponse::Ok().json(json!({
        "analysis_id": analysis_id,
        "status": "processing"
    })))
}

pub async fn get_analysis_status(
    analysis_id: web::Path<Uuid>,
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, AppError> {
    let status = state.analysis_cache
        .get(&analysis_id)
        .ok_or_else(|| AppError::NotFound("Analysis not found".to_string()))?;
        
    Ok(HttpResponse::Ok().json(&*status))
}

pub async fn get_analysis_result(
    analysis_id: web::Path<Uuid>,
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, AppError> {
    let status = state.analysis_cache
        .get(&analysis_id)
        .ok_or_else(|| AppError::NotFound("Analysis not found".to_string()))?;
        
    match &*status {
        AnalysisStatus::Complete(result) => Ok(HttpResponse::Ok().json(result)),
        AnalysisStatus::Failed(error) => Err(AppError::ProcessingError(error.clone())),
        AnalysisStatus::Processing => Ok(HttpResponse::Ok().json(json!({
            "status": "processing"
        }))),
    }
}

pub async fn list_analyses(
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, AppError> {
    let analyses: Vec<_> = state.analysis_cache
        .iter()
        .map(|entry| json!({
            "id": entry.key(),
            "status": entry.value()
        }))
        .collect();
        
    Ok(HttpResponse::Ok().json(analyses))
}

pub async fn delete_analysis(
    analysis_id: web::Path<Uuid>,
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, AppError> {
    state.analysis_cache
        .remove(&analysis_id)
        .ok_or_else(|| AppError::NotFound("Analysis not found".to_string()))?;
        
    Ok(HttpResponse::Ok().json(json!({
        "status": "deleted"
    })))
}
