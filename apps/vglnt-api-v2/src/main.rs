use actix_web::{post, App, HttpServer, Responder};

use actix_multipart::form::{json::Json as MpJson, tempfile::TempFile, MultipartForm};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Metadata {
    name: String,
}

#[derive(Debug, MultipartForm)]
struct UploadForm {
    #[multipart(limit = "100MB")]
    file: TempFile,
    json: MpJson<Metadata>,
}

#[post("/videos")]
pub async fn post_video(MultipartForm(form): MultipartForm<UploadForm>) -> impl Responder {
    format!(
        "Uploaded file {}, with size: {}",
        form.json.0.name, form.file.size
    )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(move || App::new().service(post_video))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}