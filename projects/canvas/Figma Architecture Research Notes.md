# Figma Architecture Research Notes

## Rendering Architecture

### WebGPU Migration (Sept 2025)
Figma migrated from WebGL to WebGPU to unlock new performance optimizations.

**Key Technical Decisions:**
1. **Graphics Interface Abstraction** - Created abstraction layer between rendering code and low-level GPU APIs
2. **Explicit Draw Calls** - Moved from WebGL's global state binding to explicit draw call arguments
3. **Shader Processing** - Maintain GLSL shaders, auto-translate to WGSL using custom processor + naga
4. **Uniform Buffers** - Batch uniform uploads for multiple draw calls instead of individual sets
5. **Encode/Submit Pattern** - encodeDraw() multiple times, then submit() to batch GPU work

**Implementation Stack:**
- C++ renderer compiled to WebAssembly via Emscripten
- Dawn (Chromium's WebGPU implementation) for native builds
- Custom C++/JS bindings for performance-critical paths
- Dynamic fallback system: WebGPU → WebGL when issues detected

**Future Optimizations Enabled:**
- Compute shaders for blur rendering
- MSAA (Multi-Sample Anti-Aliasing)
- RenderBundles for reduced CPU overhead

## Multiplayer/Collaboration Architecture

### Core Design Principles
- Client/server architecture (NOT peer-to-peer)
- Server is central authority (simplifies CRDT requirements)
- WebSocket connections for real-time sync
- Separate process per multiplayer document

### Data Structure
- Document = tree of objects (like HTML DOM)
- Each object has ID + collection of properties
- Conceptually: `Map<ObjectID, Map<Property, Value>>`
- Or: database with (ObjectID, Property, Value) tuples

### Sync Strategy (CRDT-inspired, not pure CRDT)
1. **Property-level sync** - Changes atomic at property boundary
2. **Last-writer-wins** for conflicts on same property
3. **No timestamp needed** - server defines event order
4. **Optimistic updates** - Apply locally immediately, reconcile later
5. **Flicker prevention** - Discard server changes that conflict with unacknowledged local changes

### Why Not Pure OT or CRDT?
- OT: Too complex for design tool (designed for text editing)
- Pure CRDT: Overhead for decentralized systems unnecessary with central server
- Figma's approach: CRDT-inspired but simplified for centralized architecture

### Offline Support
- Download full document on open
- Continue editing offline
- On reconnect: download fresh copy, reapply offline edits, resume sync

## Key Takeaways for Our Implementation

1. **Abstraction Layer** - Build GPU abstraction early to support multiple backends
2. **Batch Operations** - Design API around batched/encoded operations from start
3. **Central Server** - Simplifies sync logic significantly vs peer-to-peer
4. **Property-Level Granularity** - Good balance of simplicity and conflict handling
5. **Optimistic UI** - Apply changes immediately, reconcile asynchronously
6. **Fallback Systems** - Plan for graceful degradation (WebGPU → WebGL)
