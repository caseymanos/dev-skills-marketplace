//! Automerge document management

use crate::protocol::DocumentId;
use automerge::{sync, AutoCommit};
use automerge::sync::SyncDoc;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during sync operations
#[derive(Debug, Error)]
pub enum SyncError {
    #[error("Failed to read sync message: {0}")]
    ReadMessage(String),
    #[error("Failed to generate sync message")]
    GenerateMessage,
    #[error("Document not found: {0}")]
    DocumentNotFound(String),
}

/// A managed Automerge document with sync state
pub struct ManagedDocument {
    pub doc: AutoCommit,
    sync_states: HashMap<String, sync::State>,
    pub document_id: DocumentId,
    pub created_at: u64,
}

impl ManagedDocument {
    /// Create a new empty managed document
    pub fn new(document_id: DocumentId) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        Self {
            doc: AutoCommit::new(),
            sync_states: HashMap::new(),
            document_id,
            created_at: now,
        }
    }

    /// Create from existing Automerge bytes
    pub fn from_bytes(document_id: DocumentId, bytes: &[u8]) -> Result<Self, automerge::AutomergeError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let doc = AutoCommit::load(bytes)?;
        Ok(Self {
            doc,
            sync_states: HashMap::new(),
            document_id,
            created_at: now,
        })
    }

    /// Get document as bytes
    pub fn to_bytes(&mut self) -> Vec<u8> {
        self.doc.save()
    }

    /// Get sync state for a client, creating if needed
    pub fn get_or_create_sync_state(&mut self, session_token: &str) -> &mut sync::State {
        self.sync_states
            .entry(session_token.to_string())
            .or_insert_with(sync::State::new)
    }

    /// Generate sync message for a client
    pub fn generate_sync_message(&mut self, session_token: &str) -> Option<sync::Message> {
        // Ensure sync state exists
        let session_key = session_token.to_string();
        self.sync_states.entry(session_key.clone()).or_insert_with(sync::State::new);
        // Now we can borrow both
        let sync_state = self.sync_states.get_mut(&session_key).unwrap();
        self.doc.sync().generate_sync_message(sync_state)
    }

    /// Receive and apply a sync message from a client
    pub fn receive_sync_message(
        &mut self,
        session_token: &str,
        message: sync::Message,
    ) -> Result<(), SyncError> {
        // Ensure sync state exists
        let session_key = session_token.to_string();
        self.sync_states.entry(session_key.clone()).or_insert_with(sync::State::new);
        // Now we can borrow both
        let sync_state = self.sync_states.get_mut(&session_key).unwrap();
        self.doc
            .sync()
            .receive_sync_message(sync_state, message)
            .map_err(|e| SyncError::ReadMessage(e.to_string()))
    }

    /// Apply a change to the document
    pub fn apply_change(&mut self, change_bytes: &[u8]) -> Result<(), automerge::AutomergeError> {
        self.doc.load_incremental(change_bytes)?;
        Ok(())
    }

    /// Get the current heads (for versioning)
    pub fn get_heads(&mut self) -> Vec<automerge::ChangeHash> {
        self.doc.get_heads()
    }

    /// Remove sync state for a client (on disconnect)
    pub fn remove_sync_state(&mut self, session_token: &str) {
        self.sync_states.remove(session_token);
    }

    /// Check if document has any pending sync for a client
    pub fn has_pending_sync(&mut self, session_token: &str) -> bool {
        self.generate_sync_message(session_token).is_some()
    }
}

/// Store for all active documents
pub struct DocumentStore {
    documents: RwLock<HashMap<DocumentId, Arc<RwLock<ManagedDocument>>>>,
}

impl DocumentStore {
    pub fn new() -> Self {
        Self {
            documents: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a document
    pub async fn get_or_create(&self, document_id: &DocumentId) -> Arc<RwLock<ManagedDocument>> {
        let mut docs = self.documents.write().await;
        if !docs.contains_key(document_id) {
            let doc = ManagedDocument::new(document_id.clone());
            docs.insert(document_id.clone(), Arc::new(RwLock::new(doc)));
        }
        docs.get(document_id).unwrap().clone()
    }

    /// Get a document if it exists
    pub async fn get(&self, document_id: &DocumentId) -> Option<Arc<RwLock<ManagedDocument>>> {
        let docs = self.documents.read().await;
        docs.get(document_id).cloned()
    }

    /// Remove a document
    pub async fn remove(&self, document_id: &DocumentId) {
        let mut docs = self.documents.write().await;
        docs.remove(document_id);
    }

    /// Get all document IDs
    pub async fn document_ids(&self) -> Vec<DocumentId> {
        let docs = self.documents.read().await;
        docs.keys().cloned().collect()
    }

    /// Get document count
    pub async fn count(&self) -> usize {
        let docs = self.documents.read().await;
        docs.len()
    }
}

impl Default for DocumentStore {
    fn default() -> Self {
        Self::new()
    }
}
