//! HTTP and WebSocket server

use crate::handler::{handle_disconnect, handle_message};
use crate::protocol::{ClientMessage, ServerMessage};
use crate::session::SessionManager;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::Response,
    routing::get,
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info};
use uuid::Uuid;

/// Server configuration
#[derive(Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8080,
        }
    }
}

/// Application state
#[derive(Clone)]
struct AppState {
    session_manager: Arc<SessionManager>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

/// Stats response
#[derive(Serialize)]
struct StatsResponse {
    active_sessions: usize,
    total_clients: usize,
    documents: Vec<String>,
}

/// Create the router
pub fn create_router(session_manager: Arc<SessionManager>) -> Router {
    let state = AppState { session_manager };

    let cors = CorsLayer::permissive();

    Router::new()
        .route("/health", get(health_check))
        .route("/stats", get(get_stats))
        .route("/ws/{document_id}", get(ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Stats endpoint
async fn get_stats(State(state): State<AppState>) -> Json<StatsResponse> {
    let sessions = state.session_manager.active_sessions().await;
    let total_clients = state.session_manager.total_clients().await;

    Json(StatsResponse {
        active_sessions: sessions.len(),
        total_clients,
        documents: sessions,
    })
}

/// WebSocket upgrade handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(document_id): Path<String>,
    State(state): State<AppState>,
) -> Response {
    info!("WebSocket connection request for document: {}", document_id);
    ws.on_upgrade(move |socket| handle_socket(socket, document_id, state.session_manager))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, document_id: String, session_manager: Arc<SessionManager>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for sending messages to this client
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    // Generate session token for this connection
    let session_token = Uuid::new_v4().to_string();
    let client_id = Arc::new(tokio::sync::RwLock::new(None::<String>));

    // Task to forward messages from channel to websocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match serde_json::to_string(&msg) {
                Ok(json) => {
                    if ws_sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    error!("Failed to serialize message: {}", e);
                }
            }
        }
    });

    // Handle incoming messages
    let session_manager_clone = session_manager.clone();
    let tx_clone = tx.clone();
    let session_token_clone = session_token.clone();
    let client_id_clone = client_id.clone();

    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(msg) => {
                        // Track client ID from join message
                        if let ClientMessage::JoinDocument { client_id: cid, .. } = &msg {
                            *client_id_clone.write().await = Some(cid.clone());
                        }
                        handle_message(
                            msg,
                            session_manager_clone.clone(),
                            tx_clone.clone(),
                            &session_token_clone,
                        )
                        .await;
                    }
                    Err(e) => {
                        error!("Failed to parse message: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket closed for document: {}", document_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup on disconnect
    if let Some(cid) = client_id.read().await.as_ref() {
        handle_disconnect(cid, session_manager, &session_token).await;
    }

    // Cancel send task
    send_task.abort();
}

/// Run the server
pub async fn run_server(config: Config, session_manager: Arc<SessionManager>) -> anyhow::Result<()> {
    let app = create_router(session_manager);
    let addr = format!("{}:{}", config.host, config.port);

    info!("Starting sync server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
