/**
 * Canvas Contracts
 *
 * This module exports all shared contracts for the Collaborative Infinite Canvas.
 * These interfaces define the boundaries between the three development streams:
 *
 * - agent-core: Rust/WASM Canvas Engine (implements CanvasEngine)
 * - agent-sync: Collaboration Backend (implements WebSocket server)
 * - agent-ui: React/TypeScript Frontend (consumes both)
 *
 * @version 1.0.0
 */

// WASM API Contract
export * from './wasm-api';

// WebSocket Protocol
export * from './websocket-protocol';

// Note: document-schema.rs is the Rust source of truth for the Automerge schema.
// TypeScript types are derived from wasm-api.ts for consistency.
