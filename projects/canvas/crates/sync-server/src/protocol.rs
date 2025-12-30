//! WebSocket protocol types matching contracts/websocket-protocol.ts

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Document identifier
pub type DocumentId = String;

/// Client identifier
pub type ClientId = String;

/// Message identifier
pub type MessageId = String;

/// Message envelope wrapping all messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageEnvelope<T> {
    pub message_id: MessageId,
    pub timestamp: String,
    pub payload: T,
}

/// Client-to-server message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Join a document session
    JoinDocument {
        document_id: DocumentId,
        client_id: ClientId,
        #[serde(default)]
        last_known_version: Option<u64>,
    },
    /// Leave a document session
    LeaveDocument {
        document_id: DocumentId,
        client_id: ClientId,
    },
    /// Send a document change
    Change {
        document_id: DocumentId,
        client_id: ClientId,
        change: String, // Base64 encoded Automerge change
        #[serde(default)]
        base_version: Option<u64>,
    },
    /// Request sync with server
    SyncRequest {
        document_id: DocumentId,
        client_id: ClientId,
        sync_message: String, // Base64 encoded Automerge sync message
    },
    /// Update cursor position
    CursorMove {
        document_id: DocumentId,
        client_id: ClientId,
        position: CursorPosition,
    },
    /// Update selection
    SelectionUpdate {
        document_id: DocumentId,
        client_id: ClientId,
        selection: Selection,
    },
    /// Update presence status
    PresenceUpdate {
        document_id: DocumentId,
        client_id: ClientId,
        status: PresenceStatus,
    },
    /// Heartbeat/ping
    Ping {
        client_id: ClientId,
    },
}

/// Server-to-client message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Acknowledge joining a document
    JoinAck {
        document_id: DocumentId,
        client_id: ClientId,
        document_state: String, // Base64 encoded Automerge document
        version: u64,
        connected_clients: Vec<ClientInfo>,
    },
    /// Broadcast a change to all clients
    ChangeBroadcast {
        document_id: DocumentId,
        source_client_id: ClientId,
        change: String, // Base64 encoded Automerge change
        version: u64,
    },
    /// Response to sync request
    SyncResponse {
        document_id: DocumentId,
        sync_message: Option<String>, // Base64 encoded Automerge sync message
        is_complete: bool,
    },
    /// Broadcast cursor position
    CursorBroadcast {
        document_id: DocumentId,
        client_id: ClientId,
        position: CursorPosition,
    },
    /// Broadcast selection
    SelectionBroadcast {
        document_id: DocumentId,
        client_id: ClientId,
        selection: Selection,
    },
    /// Broadcast presence update
    PresenceBroadcast {
        document_id: DocumentId,
        client_id: ClientId,
        status: PresenceStatus,
    },
    /// Client joined notification
    ClientJoined {
        document_id: DocumentId,
        client_info: ClientInfo,
    },
    /// Client left notification
    ClientLeft {
        document_id: DocumentId,
        client_id: ClientId,
    },
    /// Error message
    Error {
        code: ErrorCode,
        message: String,
        #[serde(default)]
        document_id: Option<DocumentId>,
    },
    /// Heartbeat response
    Pong {
        server_time: String,
    },
}

/// Cursor position in canvas coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub viewport_x: Option<f64>,
    #[serde(default)]
    pub viewport_y: Option<f64>,
}

/// Selection information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Selection {
    pub element_ids: Vec<String>,
    #[serde(default)]
    pub bounds: Option<SelectionBounds>,
}

/// Selection bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Presence status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Active,
    Idle,
    Away,
}

/// Client information for presence
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInfo {
    pub client_id: ClientId,
    pub display_name: String,
    pub color: String,
    pub status: PresenceStatus,
    #[serde(default)]
    pub cursor_position: Option<CursorPosition>,
    #[serde(default)]
    pub selection: Option<Selection>,
}

/// Error codes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    DocumentNotFound,
    InvalidMessage,
    SyncError,
    AuthError,
    RateLimited,
    InternalError,
}

/// Generate a unique message ID
pub fn generate_message_id() -> MessageId {
    Uuid::new_v4().to_string()
}

/// Create a message envelope
pub fn create_message<T: Serialize>(payload: T) -> MessageEnvelope<T> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    MessageEnvelope {
        message_id: generate_message_id(),
        timestamp: now.to_string(),
        payload,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_message_serialization() {
        let msg = ClientMessage::JoinDocument {
            document_id: "doc-123".to_string(),
            client_id: "client-456".to_string(),
            last_known_version: Some(42),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("join_document"));
        assert!(json.contains("doc-123"));
    }

    #[test]
    fn test_server_message_serialization() {
        let msg = ServerMessage::Pong {
            server_time: "2024-01-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("pong"));
    }
}
