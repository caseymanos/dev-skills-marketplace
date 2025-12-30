//! Real-time collaboration server for canvas documents
//!
//! This crate provides a WebSocket-based collaboration server that supports:
//! - Real-time document synchronization using Automerge CRDTs
//! - Presence awareness (cursors, selections, status)
//! - Multi-client document sessions
//!
//! # Architecture
//!
//! - `protocol`: WebSocket message types matching TypeScript contracts
//! - `document`: Automerge document management and sync state
//! - `session`: Client connection and document session management
//! - `handler`: WebSocket message handling logic
//! - `server`: HTTP/WebSocket server using Axum

pub mod document;
pub mod handler;
pub mod protocol;
pub mod server;
pub mod session;

pub use server::{create_router, run_server, Config};
pub use session::SessionManager;
