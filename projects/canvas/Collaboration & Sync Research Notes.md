# Collaboration & Sync Research Notes

## Automerge - Local-First Sync Engine

### Overview
Automerge is a CRDT-based sync engine for multiplayer apps that works offline, prevents conflicts, and runs fast.

### Key Features
1. **Multiplayer** - Multiple users, devices, one document. Single source of truth mirrored on every client.
2. **Offline Support** - Full functionality offline, changes queue locally, sync on reconnect.
3. **Consistent Merging** - Overlapping edits merged consistently without data loss.
4. **Versioned** - Remembers every change, supports branching.
5. **Compact** - Supports millions of changes, compressed columnar store.
6. **Fast** - High-performance sync engine, instant local edits.

### Language Support
- **Primary**: JavaScript and Rust
- **Bindings**: Swift, Python, C, Java

### Integration
- Works with React and other frameworks
- Plugins for Prosemirror, Codemirror
- Network agnostic: P2P, client-server, files, etc.
- Automerge Repo provides sync server backend

### Team Background
- Industrial research lab Ink & Switch
- Academic rigor (Martin Kleppmann from Cambridge)
- Theorem proving tools (Isabelle) for design proofs
- Database-world performance techniques

## Yjs - Alternative CRDT Library

### Overview
High-performance CRDT for building collaborative applications that sync automatically.

### Key Features
- Shared data types (Map, Array with superpowers)
- Awareness CRDT for presence features
- Bindings for many UI libraries and editors
- Very popular in web ecosystem

## Sync Architecture Patterns

### Client-Server (Figma's Approach)
- Central server as authority
- Simpler than pure P2P CRDTs
- WebSocket connections for real-time
- Server can define event ordering
- Reduces CRDT overhead

### Pure P2P (Automerge's Strength)
- No central server required
- Works fully offline
- More complex conflict resolution
- Higher memory/performance overhead

### Hybrid Approach (Recommended)
- Use central server for authority when online
- Fall back to local-first when offline
- Sync via WebSocket when connected
- Queue changes locally when disconnected
- Reconcile on reconnection

## Data Structure Considerations for Canvas

### Document Model
```
Document {
  id: UUID
  objects: Map<ObjectID, CanvasObject>
  pages: Vec<PageID>
  metadata: DocumentMetadata
}

CanvasObject {
  id: ObjectID
  type: ObjectType
  properties: Map<PropertyKey, Value>
  parent_id: Option<ObjectID>
  children: Vec<ObjectID>
  z_index: FractionalIndex
}
```

### Sync Granularity Options
1. **Document-level** - Too coarse, many conflicts
2. **Object-level** - Good balance (Figma's choice)
3. **Property-level** - Fine-grained, more overhead
4. **Operation-level** - Most complex (OT approach)

### Recommended: Property-Level with Object Grouping
- Sync at property level for fine-grained merging
- Group by object for batching efficiency
- Last-writer-wins for same property conflicts
- Server timestamps for ordering

## Technology Recommendations for Rust Canvas

### Sync Engine Options
1. **Automerge (Rust)** - Best for local-first, has native Rust
2. **Custom CRDT-inspired** - Like Figma, simpler with central server
3. **y-crdt** - Rust port of Yjs

### Transport Layer
- WebSocket for real-time sync
- WebRTC for P2P (optional)
- HTTP for initial document load

### Presence/Awareness
- Cursor positions
- Selection states
- User colors/avatars
- Typing indicators
- Ephemeral, not persisted
