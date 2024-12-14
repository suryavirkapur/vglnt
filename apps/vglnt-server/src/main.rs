use actix_web::{web, App, HttpServer};
use dotenv::dotenv;
use std::sync::Arc;

mod api;
mod video;
mod llm;
mod lstm;
mod types;
mod error;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let app_state = Arc::new(api::AppState::new()?);
    
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(Arc::clone(&app_state)))
            .service(api::routes::video_routes())
            .service(api::routes::analysis_routes())
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
