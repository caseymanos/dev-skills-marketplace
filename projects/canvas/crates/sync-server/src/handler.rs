//! WebSocket message handling

use crate::protocol::{
    ClientId, ClientMessage, CursorPosition, DocumentId, ErrorCode, PresenceStatus,
    Selection, ServerMessage,
};
use crate::session::{ClientConnection, SessionManager};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

/// Handle an incoming client message
pub async fn handle_message(
    message: ClientMessage,
    session_manager: Arc<SessionManager>,
    client_sender: mpsc::UnboundedSender<ServerMessage>,
    session_token: &str,
) {
    match message {
        ClientMessage::JoinDocument {
            document_id,
            client_id,
            last_known_version: _,
        } => {
            handle_join_document(
                document_id,
                client_id,
                session_manager,
                client_sender,
                session_token,
            )
            .await;
        }
        ClientMessage::LeaveDocument {
            document_id,
            client_id,
        } => {
            handle_leave_document(document_id, client_id, session_manager, session_token).await;
        }
        ClientMessage::Change {
            document_id,
            client_id,
            change,
            base_version: _,
        } => {
            handle_change(document_id, client_id, change, session_manager, session_token).await;
        }
        ClientMessage::SyncRequest {
            document_id,
            client_id,
            sync_message,
        } => {
            handle_sync_request(
                document_id,
                client_id,
                sync_message,
                session_manager,
                client_sender,
                session_token,
            )
            .await;
        }
        ClientMessage::CursorMove {
            document_id,
            client_id,
            position,
        } => {
            handle_cursor_move(document_id, client_id, position, session_manager).await;
        }
        ClientMessage::SelectionUpdate {
            document_id,
            client_id,
            selection,
        } => {
            handle_selection_update(document_id, client_id, selection, session_manager).await;
        }
        ClientMessage::PresenceUpdate {
            document_id,
            client_id,
            status,
        } => {
            handle_presence_update(document_id, client_id, status, session_manager).await;
        }
        ClientMessage::Ping { client_id: _ } => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis();
            let _ = client_sender.send(ServerMessage::Pong {
                server_time: now.to_string(),
            });
        }
    }
}

/// Handle client joining a document
async fn handle_join_document(
    document_id: DocumentId,
    client_id: ClientId,
    session_manager: Arc<SessionManager>,
    client_sender: mpsc::UnboundedSender<ServerMessage>,
    session_token: &str,
) {
    info!("Client {} joining document {}", client_id, document_id);

    // Get or create session
    let session = session_manager.get_or_create_session(&document_id).await;

    // Get or create document
    let managed_doc = session_manager
        .document_store()
        .get_or_create(&document_id)
        .await;

    // Get document state
    let (doc_bytes, version) = {
        let mut doc = managed_doc.write().await;
        let bytes = doc.to_bytes();
        let heads = doc.get_heads();
        (bytes, heads.len() as u64)
    };

    // Create client connection
    let client = ClientConnection::new(
        client_id.clone(),
        format!("User-{}", &client_id[..8.min(client_id.len())]),
        generate_color(&client_id),
        client_sender.clone(),
        session_token.to_string(),
    );

    // Get connected clients before adding new one
    let connected_clients = {
        let mut session = session.write().await;
        let clients = session.get_clients();
        session.add_client(client);
        clients
    };

    // Send join acknowledgment
    let _ = client_sender.send(ServerMessage::JoinAck {
        document_id: document_id.clone(),
        client_id: client_id.clone(),
        document_state: BASE64.encode(&doc_bytes),
        version,
        connected_clients: connected_clients.clone(),
    });

    // Broadcast client joined to others
    let client_info = {
        let session = session.read().await;
        session.get_client(&client_id).map(|c| c.to_client_info())
    };

    if let Some(info) = client_info {
        let session = session.read().await;
        session.broadcast(
            ServerMessage::ClientJoined {
                document_id,
                client_info: info,
            },
            Some(client_id),
        );
    }
}

/// Handle client leaving a document
async fn handle_leave_document(
    document_id: DocumentId,
    client_id: ClientId,
    session_manager: Arc<SessionManager>,
    session_token: &str,
) {
    info!("Client {} leaving document {}", client_id, document_id);

    if let Some(session) = session_manager.get_session(&document_id).await {
        let mut session = session.write().await;
        if let Some(_client) = session.remove_client(&client_id) {
            // Clean up Automerge sync state
            if let Some(doc) = session_manager.document_store().get(&document_id).await {
                let mut doc = doc.write().await;
                doc.remove_sync_state(session_token);
            }

            // Broadcast client left
            session.broadcast(
                ServerMessage::ClientLeft {
                    document_id: document_id.clone(),
                    client_id: client_id.clone(),
                },
                None,
            );
        }

        // Clean up empty session
        if session.is_empty() {
            drop(session);
            session_manager.remove_session(&document_id).await;
        }
    }
}

/// Handle a document change
async fn handle_change(
    document_id: DocumentId,
    client_id: ClientId,
    change: String,
    session_manager: Arc<SessionManager>,
    session_token: &str,
) {
    // Decode base64 change
    let change_bytes = match BASE64.decode(&change) {
        Ok(bytes) => bytes,
        Err(e) => {
            warn!("Failed to decode change from {}: {}", client_id, e);
            return;
        }
    };

    // Get document and apply change
    let managed_doc = session_manager
        .document_store()
        .get_or_create(&document_id)
        .await;

    let version = {
        let mut doc = managed_doc.write().await;
        if let Err(e) = doc.apply_change(&change_bytes) {
            error!("Failed to apply change from {}: {}", client_id, e);
            return;
        }
        doc.get_heads().len() as u64
    };

    // Broadcast to other clients
    if let Some(session) = session_manager.get_session(&document_id).await {
        let session = session.read().await;
        session.broadcast(
            ServerMessage::ChangeBroadcast {
                document_id,
                source_client_id: client_id.clone(),
                change,
                version,
            },
            Some(client_id),
        );
    }

    let _ = session_token; // Used for tracking
}

/// Handle sync request using Automerge sync protocol
async fn handle_sync_request(
    document_id: DocumentId,
    client_id: ClientId,
    sync_message: String,
    session_manager: Arc<SessionManager>,
    client_sender: mpsc::UnboundedSender<ServerMessage>,
    session_token: &str,
) {
    // Decode incoming sync message
    let sync_bytes = match BASE64.decode(&sync_message) {
        Ok(bytes) => bytes,
        Err(e) => {
            warn!("Failed to decode sync message from {}: {}", client_id, e);
            let _ = client_sender.send(ServerMessage::Error {
                code: ErrorCode::SyncError,
                message: format!("Invalid sync message: {}", e),
                document_id: Some(document_id),
            });
            return;
        }
    };

    // Parse as Automerge sync message
    let incoming_msg = match automerge::sync::Message::decode(&sync_bytes) {
        Ok(msg) => msg,
        Err(e) => {
            warn!("Failed to parse sync message from {}: {}", client_id, e);
            let _ = client_sender.send(ServerMessage::Error {
                code: ErrorCode::SyncError,
                message: format!("Invalid sync message format: {}", e),
                document_id: Some(document_id),
            });
            return;
        }
    };

    // Get document
    let managed_doc = session_manager
        .document_store()
        .get_or_create(&document_id)
        .await;

    // Process sync
    let response_msg = {
        let mut doc = managed_doc.write().await;

        // Receive the incoming message
        if let Err(e) = doc.receive_sync_message(session_token, incoming_msg) {
            error!("Failed to receive sync message: {}", e);
            let _ = client_sender.send(ServerMessage::Error {
                code: ErrorCode::SyncError,
                message: format!("Sync error: {}", e),
                document_id: Some(document_id),
            });
            return;
        }

        // Generate response
        doc.generate_sync_message(session_token)
    };

    // Send response
    let (response_bytes, is_complete) = match response_msg {
        Some(msg) => (Some(BASE64.encode(msg.encode())), false),
        None => (None, true),
    };

    let _ = client_sender.send(ServerMessage::SyncResponse {
        document_id,
        sync_message: response_bytes,
        is_complete,
    });
}

/// Handle cursor move
async fn handle_cursor_move(
    document_id: DocumentId,
    client_id: ClientId,
    position: CursorPosition,
    session_manager: Arc<SessionManager>,
) {
    if let Some(session) = session_manager.get_session(&document_id).await {
        // Update client's cursor position
        {
            let mut session = session.write().await;
            if let Some(client) = session.get_client_mut(&client_id) {
                client.cursor_position = Some(position.clone());
            }
        }

        // Broadcast to others
        let session = session.read().await;
        session.broadcast(
            ServerMessage::CursorBroadcast {
                document_id,
                client_id: client_id.clone(),
                position,
            },
            Some(client_id),
        );
    }
}

/// Handle selection update
async fn handle_selection_update(
    document_id: DocumentId,
    client_id: ClientId,
    selection: Selection,
    session_manager: Arc<SessionManager>,
) {
    if let Some(session) = session_manager.get_session(&document_id).await {
        // Update client's selection
        {
            let mut session = session.write().await;
            if let Some(client) = session.get_client_mut(&client_id) {
                client.selection = Some(selection.clone());
            }
        }

        // Broadcast to others
        let session = session.read().await;
        session.broadcast(
            ServerMessage::SelectionBroadcast {
                document_id,
                client_id: client_id.clone(),
                selection,
            },
            Some(client_id),
        );
    }
}

/// Handle presence update
async fn handle_presence_update(
    document_id: DocumentId,
    client_id: ClientId,
    status: PresenceStatus,
    session_manager: Arc<SessionManager>,
) {
    if let Some(session) = session_manager.get_session(&document_id).await {
        // Update client's status
        {
            let mut session = session.write().await;
            if let Some(client) = session.get_client_mut(&client_id) {
                client.status = status.clone();
            }
        }

        // Broadcast to others
        let session = session.read().await;
        session.broadcast(
            ServerMessage::PresenceBroadcast {
                document_id,
                client_id: client_id.clone(),
                status,
            },
            Some(client_id),
        );
    }
}

/// Handle client disconnect - clean up all sessions
pub async fn handle_disconnect(
    client_id: &ClientId,
    session_manager: Arc<SessionManager>,
    session_token: &str,
) {
    info!("Client {} disconnected", client_id);

    // Find and remove from all sessions
    let sessions = session_manager.active_sessions().await;
    for document_id in sessions {
        handle_leave_document(
            document_id,
            client_id.clone(),
            session_manager.clone(),
            session_token,
        )
        .await;
    }
}

/// Generate a consistent color for a client based on their ID
fn generate_color(client_id: &str) -> String {
    let colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
        "#BB8FCE", "#85C1E9",
    ];
    let hash: usize = client_id.bytes().map(|b| b as usize).sum();
    colors[hash % colors.len()].to_string()
}
