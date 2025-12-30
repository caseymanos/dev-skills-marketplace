//! Session and client management for document collaboration

use crate::document::DocumentStore;
use crate::protocol::{ClientId, ClientInfo, CursorPosition, DocumentId, PresenceStatus, Selection, ServerMessage};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};

/// Message to broadcast to clients
#[derive(Debug, Clone)]
pub struct BroadcastMessage {
    pub message: ServerMessage,
    pub exclude_client: Option<ClientId>,
}

/// A connected client
pub struct ClientConnection {
    pub client_id: ClientId,
    pub display_name: String,
    pub color: String,
    pub status: PresenceStatus,
    pub cursor_position: Option<CursorPosition>,
    pub selection: Option<Selection>,
    pub sender: mpsc::UnboundedSender<ServerMessage>,
    pub session_token: String,
}

impl ClientConnection {
    pub fn new(
        client_id: ClientId,
        display_name: String,
        color: String,
        sender: mpsc::UnboundedSender<ServerMessage>,
        session_token: String,
    ) -> Self {
        Self {
            client_id,
            display_name,
            color,
            status: PresenceStatus::Active,
            cursor_position: None,
            selection: None,
            sender,
            session_token,
        }
    }

    pub fn to_client_info(&self) -> ClientInfo {
        ClientInfo {
            client_id: self.client_id.clone(),
            display_name: self.display_name.clone(),
            color: self.color.clone(),
            status: self.status.clone(),
            cursor_position: self.cursor_position.clone(),
            selection: self.selection.clone(),
        }
    }
}

/// A document session with connected clients
pub struct DocumentSession {
    pub document_id: DocumentId,
    clients: HashMap<ClientId, ClientConnection>,
    broadcast_tx: broadcast::Sender<BroadcastMessage>,
    version: u64,
}

impl DocumentSession {
    pub fn new(document_id: DocumentId) -> Self {
        let (broadcast_tx, _) = broadcast::channel(1024);
        Self {
            document_id,
            clients: HashMap::new(),
            broadcast_tx,
            version: 0,
        }
    }

    /// Add a client to the session
    pub fn add_client(&mut self, client: ClientConnection) {
        self.clients.insert(client.client_id.clone(), client);
    }

    /// Remove a client from the session
    pub fn remove_client(&mut self, client_id: &ClientId) -> Option<ClientConnection> {
        self.clients.remove(client_id)
    }

    /// Get a client by ID
    pub fn get_client(&self, client_id: &ClientId) -> Option<&ClientConnection> {
        self.clients.get(client_id)
    }

    /// Get a mutable client by ID
    pub fn get_client_mut(&mut self, client_id: &ClientId) -> Option<&mut ClientConnection> {
        self.clients.get_mut(client_id)
    }

    /// Get all connected clients
    pub fn get_clients(&self) -> Vec<ClientInfo> {
        self.clients.values().map(|c| c.to_client_info()).collect()
    }

    /// Get the number of connected clients
    pub fn client_count(&self) -> usize {
        self.clients.len()
    }

    /// Check if session is empty
    pub fn is_empty(&self) -> bool {
        self.clients.is_empty()
    }

    /// Get broadcast sender
    pub fn broadcast_sender(&self) -> broadcast::Sender<BroadcastMessage> {
        self.broadcast_tx.clone()
    }

    /// Subscribe to broadcasts
    pub fn subscribe(&self) -> broadcast::Receiver<BroadcastMessage> {
        self.broadcast_tx.subscribe()
    }

    /// Broadcast a message to all clients except the excluded one
    pub fn broadcast(&self, message: ServerMessage, exclude_client: Option<ClientId>) {
        let _ = self.broadcast_tx.send(BroadcastMessage {
            message,
            exclude_client,
        });
    }

    /// Send a message directly to a specific client
    pub fn send_to_client(&self, client_id: &ClientId, message: ServerMessage) -> bool {
        if let Some(client) = self.clients.get(client_id) {
            client.sender.send(message).is_ok()
        } else {
            false
        }
    }

    /// Get current document version
    pub async fn document_version(&self) -> u64 {
        self.version
    }

    /// Increment and get new version
    pub fn increment_version(&mut self) -> u64 {
        self.version += 1;
        self.version
    }
}

/// Manages all document sessions
pub struct SessionManager {
    sessions: RwLock<HashMap<DocumentId, Arc<RwLock<DocumentSession>>>>,
    document_store: DocumentStore,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            document_store: DocumentStore::new(),
        }
    }

    /// Get or create a session for a document
    pub async fn get_or_create_session(
        &self,
        document_id: &DocumentId,
    ) -> Arc<RwLock<DocumentSession>> {
        let mut sessions = self.sessions.write().await;
        if !sessions.contains_key(document_id) {
            let session = DocumentSession::new(document_id.clone());
            sessions.insert(document_id.clone(), Arc::new(RwLock::new(session)));
        }
        sessions.get(document_id).unwrap().clone()
    }

    /// Get a session if it exists
    pub async fn get_session(&self, document_id: &DocumentId) -> Option<Arc<RwLock<DocumentSession>>> {
        let sessions = self.sessions.read().await;
        sessions.get(document_id).cloned()
    }

    /// Remove a session
    pub async fn remove_session(&self, document_id: &DocumentId) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(document_id);
    }

    /// Get document store
    pub fn document_store(&self) -> &DocumentStore {
        &self.document_store
    }

    /// Get mutable document store
    pub fn document_store_mut(&mut self) -> &mut DocumentStore {
        &mut self.document_store
    }

    /// Get all active session IDs
    pub async fn active_sessions(&self) -> Vec<DocumentId> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }

    /// Get total client count across all sessions
    pub async fn total_clients(&self) -> usize {
        let sessions = self.sessions.read().await;
        let mut total = 0;
        for session in sessions.values() {
            total += session.read().await.client_count();
        }
        total
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
