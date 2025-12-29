# Technical Architecture Plan: Collaborative Infinite Canvas

**Author:** Manus AI
**Date:** December 28, 2025

## 1. Introduction

This document outlines the technical architecture for a high-performance, collaborative, infinite canvas application. The goal is to create a general-purpose tool, similar in capability to Figma or Excalidraw, for whiteboarding, document annotation, and technical diagramming. The core of the application will be built in Rust, compiled to WebAssembly (WASM) for web deployment, and will leverage WebGPU for rendering with a fallback to WebGL. This plan is based on extensive research into modern graphics rendering, real-time collaboration systems, and best practices from industry leaders like Figma and the open-source community [1][2][3].

## 2. High-Level Architecture

The system is designed with a decoupled, modular architecture to ensure scalability, maintainability, and performance. It consists of three primary layers: the **Core Canvas Engine (Rust/WASM)**, the **Sync & Collaboration Backend**, and the **Browser UI (React/TypeScript)**.

![High-Level Architecture Diagram](https://private-us-east-1.manuscdn.com/sessionFile/gQeU9J47k2dzoLme4fiy1A/sandbox/MasvoFw57izBVLt3Iqvj4l-images_1766964931255_na1fn_L2hvbWUvdWJ1bnR1L2NhbnZhc19wcm9qZWN0L2FyY2hpdGVjdHVyZV9kaWFncmFt.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvZ1FlVTlKNDdrMmR6b0xtZTRmaXkxQS9zYW5kYm94L01hc3ZvRnc1N2l6QlZMdDNJcXZqNGwtaW1hZ2VzXzE3NjY5NjQ5MzEyNTVfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyTmhiblpoYzE5d2NtOXFaV04wTDJGeVkyaHBkR1ZqZEhWeVpWOWthV0ZuY21GdC5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=ekiEQiU~-fPymyFUMyPWxZ5fDqHJBUeTyP8i9uE-eAus3r3wYqyWuav1kCdjLFKv-w-n7b4s2BevpZzkZzuUvmrX722mV843YcYwK1ihrtG-LpfKVqW2jRhztEjF50fYI30O708hj6XYQ2QhzOdHUQlpb-TZRk5A-O2BQDswg3X2~f9~OH7iHvZ~HzNTfUn7QapifGnsQanklhKLQIEg5jbRPhgkcfcQPEtCmE6C-Zben7svEpiJ3nkeRA1BDBVWRi9rJgqyJUTltGPbQ0f~gAO8A6R6rOWrHD-r7dbT6Xq1wPDZ5I0LnZ9XZjQFnYvFK669JVruWFnXLwx8kV5GNw__)

| Layer | Technology | Responsibilities |
| :--- | :--- | :--- |
| **Core Canvas Engine** | Rust, `wgpu`, `bevy_ecs`, `automerge` | Rendering, scene management, user interactions, state management, physics, and core application logic. |
| **Sync & Collaboration Backend** | Rust, `axum`/`tokio`, WebSocket | Real-time document synchronization, user presence, authentication, and persistence. |
| **Browser UI** | React, TypeScript, `wasm-bindgen` | User interface components (toolbars, panels), event forwarding to WASM, and displaying data from the core engine. |

## 3. Core Canvas Engine (Rust/WASM)

The heart of the application is a self-contained engine written in Rust and compiled to WASM. This provides near-native performance in the browser and allows for a single codebase to be potentially reused for native desktop applications in the future.

### 3.1. Rendering with `wgpu`

We will use `wgpu`, a pure-Rust graphics API based on the WebGPU standard. It provides a modern, safe, and cross-platform interface to the GPU, running on WebGPU in the browser and natively on Vulkan, Metal, or D3D12 [4].

- **Hardware Abstraction Layer (HAL):** A custom HAL will be built on top of `wgpu` to provide a unified API for both WebGPU and WebGL backends. This follows the pattern used by Figma and the `infinite-canvas-tutorial` to ensure broad compatibility while leveraging modern features [2][5].
- **Render Pipeline:** A configurable render pipeline will be implemented. This includes a scene graph, camera system, culling for off-screen objects, and batch rendering to minimize draw calls. The pipeline will be designed to be stateless and explicit, avoiding the error-prone global state of WebGL [2].
- **Shader Management:** We will write shaders in GLSL 300 and use a build-time or runtime processor (similar to Figma's use of `naga`) to transpile them to WGSL for WebGPU and down-level GLSL for WebGL compatibility [2].

### 3.2. Entity Component System (ECS) Architecture

We will adopt the Entity Component System (ECS) pattern for managing the state and logic of the canvas. This pattern, popular in game development and exemplified by the Bevy engine, promotes data-oriented design, which is excellent for performance and parallelism [6].

- **Entities:** Unique identifiers for every object on the canvas (e.g., a shape, a text box, an image).
- **Components:** Plain Rust structs representing the data for an entity. For example:
  ```rust
  struct Position { x: f32, y: f32 };
  struct Size { width: f32, height: f32 };
  struct Color { r: u8, g: u8, b: u8, a: u8 };
  struct TextContent { content: String };
  ```
- **Systems:** Logic that operates on entities with specific sets of components. For example, a `RenderSystem` would query for all entities with `Position`, `Size`, and `Shape` components to draw them.

This approach decouples data from logic, making the codebase easier to reason about, extend, and optimize.

## 4. Collaboration & Sync Engine

Real-time collaboration is a core requirement. Our architecture will be inspired by Figma's centralized, CRDT-based model, which offers a good balance of simplicity and power [3].

### 4.1. Data Model and CRDTs

We will use a Conflict-Free Replicated Data Type (CRDT) to manage the document state. This ensures that the document will eventually converge to the same state for all users, even with concurrent edits and network latency.

- **Automerge:** We will use the `automerge` library, a robust, high-performance CRDT implementation with excellent Rust support [7]. It provides a JSON-like data structure that can be modified locally and synced efficiently with other peers.
- **Document Structure:** The entire canvas document will be stored in a single Automerge document. The structure will be a map of objects, where each object has properties that can be updated independently. This mirrors Figma's `Map<ObjectID, Map<Property, Value>>` model [3].

### 4.2. Sync Protocol

- **Centralized Server:** A central server will act as the source of truth and the hub for all clients. This simplifies the logic compared to a pure peer-to-peer model.
- **WebSocket Communication:** Clients will maintain a persistent WebSocket connection to the document's dedicated server process.
- **Optimistic Updates:** Changes made by a user will be applied instantly on their local client and sent to the server asynchronously. The server broadcasts the change to all other clients.
- **Last-Writer-Wins:** For conflicting edits on the same property, the server's version (the last one it received) will win. This is a simple and effective conflict resolution strategy for this use case [3].
- **Offline Mode:** Automerge's design naturally supports local-first operation. Changes made offline are stored in the local Automerge document. Upon reconnection, the client can sync its changes with the server.

## 5. WASM Integration & UI

The Rust core engine will be compiled to a WASM module, which will be loaded and run by the browser. The UI will be a standard React application.

- **`wasm-bindgen`:** This tool will be used to generate the JavaScript and TypeScript bindings for our Rust code, allowing seamless communication between the UI and the WASM module.
- **Event Handling:** UI events (mouse clicks, keyboard input, etc.) will be captured by the React application and forwarded to the Rust engine for processing. The engine will then update its state and trigger a re-render.
- **UI Components:** The toolbar, properties panels, and other UI elements will be standard React components. They will receive their state from the Rust core and send user actions back to it.

---

## References

[1] Paulus, K. (2025, December 27). *I've built an "infinite canvas" both ways: HTML and Canvas...* [Tweet]. X. https://x.com/konstipaulus/status/2004961192368865287
[2] Ringlein, A., & Anderson, L. (2025, September 18). *Figma Rendering: Powered by WebGPU*. Figma Blog. https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
[3] Wallace, E. (2019, October 16). *How Figma’s multiplayer technology works*. Figma Blog. https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[4] Gfx-rs community. (n.d.). *wgpu*. GitHub. https://github.com/gfx-rs/wgpu
[5] Xiao, I. (n.d.). *An infinite canvas tutorial*. Infinite Canvas. https://infinitecanvas.cc/
[6] Bevy Foundation. (n.d.). *Bevy ECS*. Bevy. https://bevyengine.org/learn/quick-start/getting-started/ecs/
[7] Automerge contributors. (n_d.). *Automerge*. https://automerge.org/


## 6. Implementation Phases & Milestones

This project will be developed in iterative phases, allowing for continuous integration and testing. Each phase builds upon the last, culminating in a feature-complete application.

### Phase 1: Foundation & Boilerplate (Weeks 1-4)

**Goal:** Set up the project structure, build system, and a basic rendering loop to draw a single shape on the screen.

| Milestone | Description | Deliverable |
| :--- | :--- | :--- |
| **1.1 Project Scaffolding** | Initialize Rust workspace, backend server, and React frontend projects. | Git repository with CI/CD pipeline configured. |
| **1.2 WASM Integration** | Compile a simple Rust function to WASM and call it from TypeScript. | A "Hello, World!" message from Rust displayed in the browser. |
| **1.3 `wgpu` Initialization** | Set up `wgpu` to create a rendering context for both WebGPU and WebGL. | A blank canvas cleared to a solid color, rendered via Rust/WASM. |
| **1.4 Basic Render Loop** | Implement a `requestAnimationFrame` loop that calls into the Rust engine to render a frame. | A single, hard-coded shape (e.g., a triangle) rendered on the canvas. |

### Phase 2: Core Rendering & Scene Graph (Weeks 5-10)

**Goal:** Implement the core rendering engine, including a scene graph, camera, and basic shape rendering.

| Milestone | Description | Deliverable |
| :--- | :--- | :--- |
| **2.1 ECS Implementation** | Integrate `bevy_ecs` or a similar library to manage canvas objects. | Entities can be created and queried with components. |
| **2.2 Scene Graph** | Implement a hierarchical scene graph for managing parent-child relationships between objects. | Objects can be grouped and transformed together. |
| **2.3 Camera System** | Develop a 2D camera system for panning and zooming the canvas. | User can pan and zoom the canvas with mouse/trackpad. |
| **2.4 Shape Rendering** | Implement systems for rendering basic geometric shapes (rectangles, circles, lines). | Shapes can be added to the scene and are rendered correctly. |
| **2.5 Text Rendering** | Integrate a text rendering solution (e.g., using SDF/MSDF fonts). | Text can be rendered on the canvas with basic styling. |

### Phase 3: Interaction & Tools (Weeks 11-16)

**Goal:** Build the user-facing tools for creating and manipulating objects on the canvas.

| Milestone | Description | Deliverable |
| :--- | :--- | :--- |
| **3.1 Event System** | Create a robust event system for handling user input (mouse, keyboard). | Clicks, drags, and key presses are correctly mapped to canvas coordinates and actions. |
| **3.2 Selection & Transformation** | Implement selection of single and multiple objects, with transformation handles (resize, rotate). | Users can select, move, resize, and rotate objects. |
| **3.3 Drawing Tools** | Develop tools for drawing new shapes, lines, and text directly on the canvas. | A functional toolbar with basic drawing tools. |
| **3.4 Snapping & Alignment** | Implement snapping to grid and smart alignment guides between objects. | Drawing and moving objects feels precise and guided. |
| **3.5 Undo/Redo** | Integrate a command pattern for undoing and redoing actions. | Users can undo/redo their actions on the canvas. |

### Phase 4: Collaboration & Sync (Weeks 17-22)

**Goal:** Implement real-time multiplayer collaboration features.

| Milestone | Description | Deliverable |
| :--- | :--- | :--- |
| **4.1 Backend Setup** | Develop the WebSocket server for handling document sessions. | Clients can connect to a document-specific WebSocket endpoint. |
| **4.2 Automerge Integration** | Integrate `automerge` into the core engine to manage the document state. | All canvas state is stored in an Automerge document. |
| **4.3 Real-time Sync** | Implement the sync protocol between the client and server. | Changes made by one user are reflected on other users' screens in real-time. |
| **4.4 Presence & Awareness** | Add features like multiplayer cursors and selection highlights. | Users can see who else is in the document and what they are doing. |
| **4.5 Offline Support** | Test and solidify the local-first capabilities of the Automerge implementation. | Users can continue working while offline and changes will sync upon reconnection. |

### Phase 5: Advanced Features & Polish (Weeks 23+)

**Goal:** Add advanced functionality and polish the application for a production-ready release.

| Milestone | Description | Deliverable |
| :--- | :--- | :--- |
| **5.1 Image & Media Support** | Allow users to import and manipulate images and other media on the canvas. | Images can be uploaded, resized, and positioned. |
| **5.2 Exporting** | Implement functionality to export the canvas or selections to various formats (PNG, SVG, PDF). | Users can save their work as image or vector files. |
| **5.3 Performance Optimization** | Profile the application and optimize critical paths, including rendering, data sync, and load times. | The application is fast and responsive, even with large documents. |
| **5.4 Accessibility & UI Polish** | Ensure the application is accessible (WCAG compliance) and refine the user interface. | A polished, intuitive, and accessible user experience. |


## 7. Detailed Component Specifications

This section provides a deeper dive into the specific components that make up the canvas engine.

### 7.1. Rendering Components

The rendering subsystem is responsible for drawing everything the user sees. It must be highly optimized to handle thousands of objects at interactive frame rates.

| Component | Description | Key Technologies/Techniques |
| :--- | :--- | :--- |
| **Context Manager** | Manages the GPU device and context lifecycle, including handling context loss and recovery. | `wgpu::Device`, `wgpu::Queue`, context restoration callbacks. |
| **Render Loop** | A `requestAnimationFrame`-driven loop that orchestrates the rendering process. | `requestAnimationFrame`, frame timing, delta time calculation. |
| **Camera** | A 2D camera that defines the viewport. Handles pan, zoom, and world-to-screen coordinate transformations. | View matrix, projection matrix, zoom levels, smooth interpolation. |
| **Scene Graph** | A tree structure representing the hierarchy of objects. Each node has a local transform relative to its parent. | Tree data structure, local/world matrix calculation, dirty flag propagation. |
| **Render Pipeline** | Defines the stages of rendering, from culling to batching to final draw calls. | `wgpu::RenderPipeline`, vertex/fragment shaders, render passes. |
| **Batch Renderer** | Groups draw calls for similar objects (same shader, texture) to minimize GPU state changes. | Instanced rendering, texture atlases, uniform buffer objects. |
| **Culling System** | Determines which objects are visible within the current viewport and skips rendering for those that are not. | Bounding box intersection tests, spatial hashing (e.g., quadtree). |

### 7.2. Interaction Components

These components handle user input and translate it into actions on the canvas.

| Component | Description | Key Technologies/Techniques |
| :--- | :--- | :--- |
| **Event Dispatcher** | Captures raw browser events (mouse, touch, keyboard) and dispatches them to the appropriate handlers. | `wasm-bindgen` event listeners, event normalization. |
| **Hit Tester** | Determines which object, if any, is under the user's cursor. | Reverse iteration through z-ordered objects, point-in-polygon tests, bounding box checks. |
| **Tool Manager** | Manages the currently active tool (select, draw rectangle, draw line, etc.) and routes events to it. | State machine pattern, tool interface/trait. |
| **Transformer** | Handles the selection and transformation (move, resize, rotate) of objects. | Selection bounding box, transformation handles, matrix operations. |
| **Snapping Engine** | Provides snapping behavior to grids, guides, and other objects. | Distance calculations, snap threshold, visual guides. |

### 7.3. Collaboration Components

These components manage the real-time synchronization of document state between multiple users.

| Component | Description | Key Technologies/Techniques |
| :--- | :--- | :--- |
| **Document Store** | The single source of truth for the canvas state, backed by an Automerge document. | `automerge::AutoCommit`, change listeners. |
| **Sync Client** | Manages the WebSocket connection to the server and handles the sync protocol. | `tokio-tungstenite` (server), browser WebSocket API (client), message serialization. |
| **Presence Manager** | Tracks the state of other users in the document (cursor position, selection, user info). | Ephemeral state, broadcast channel, UI updates. |
| **History Manager** | Manages the undo/redo stack by storing Automerge changes. | Automerge change history, command pattern. |

## 8. Technology Stack Summary

The following table summarizes the complete technology stack for the project.

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Language** | Rust | Engine logic, rendering, state management, backend server. |
| **WASM Tooling** | `wasm-bindgen`, `wasm-pack` | Compiling Rust to WASM and generating JS/TS bindings. |
| **Graphics API** | `wgpu` | Cross-platform GPU abstraction for WebGPU and WebGL. |
| **ECS Framework** | `bevy_ecs` | Entity Component System for managing canvas objects. |
| **CRDT Library** | `automerge` | Conflict-free replicated data types for collaboration. |
| **Backend Framework** | `axum`, `tokio` | Async web server for WebSocket and HTTP endpoints. |
| **Database** | PostgreSQL | Persistent storage for documents and user data. |
| **Frontend Framework** | React, TypeScript | User interface components and application shell. |
| **Build System** | Cargo, `pnpm`, Vite | Building and bundling the Rust and TypeScript code. |

## 9. Risks and Mitigations

Building a complex application like this comes with inherent risks. Identifying them early allows for proactive mitigation.

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **WebGPU Browser Support** | Medium | High | Implement a robust fallback to WebGL. Use feature detection to choose the best available backend. |
| **WASM Performance Overhead** | Low | Medium | Profile early and often. Minimize data crossing the WASM/JS boundary. Use `SharedArrayBuffer` where possible. |
| **Automerge Complexity** | Medium | Medium | Start with a simple data model. Thoroughly test sync scenarios. Engage with the Automerge community for support. |
| **Text Rendering Quality** | Medium | Medium | Invest in a high-quality SDF/MSDF text rendering solution. Consider using a library like `glyph_brush`. |
| **Scope Creep** | High | High | Adhere strictly to the phased development plan. Prioritize core features and defer "nice-to-haves." |

## 10. Conclusion

This plan provides a comprehensive roadmap for building a world-class, collaborative infinite canvas application. By leveraging the performance and safety of Rust, the modern capabilities of WebGPU, and the proven patterns of CRDTs, we can create a tool that is both powerful and a joy to use. The phased approach ensures that we can deliver value incrementally while building towards a complete and polished final product.

The estimated timeline for a full, production-ready implementation is **12-18 months** with a dedicated team, aligning with the "1-3 years" estimate for a comprehensive canvas build mentioned by industry practitioners [1]. However, a functional MVP with core drawing and collaboration features can be achieved in **6-9 months**.

---

*This document was prepared by Manus AI on December 28, 2025.*
