use super::handlers;
use actix_web::web;

pub fn video_routes() -> actix_web::Scope {
    web::scope("/api/v1/video")
        .route("/upload", web::post().to(handlers::upload_video))
        .route("/{id}/status", web::get().to(handlers::get_analysis_status))
        .route("/{id}/result", web::get().to(handlers::get_analysis_result))
}

pub fn analysis_routes() -> actix_web::Scope {
    web::scope("/api/v1/analysis")
        .route("/list", web::get().to(handlers::list_analyses))
        .route("/{id}", web::delete().to(handlers::delete_analysis))
}
