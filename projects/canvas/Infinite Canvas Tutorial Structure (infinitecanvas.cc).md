# Infinite Canvas Tutorial Structure (infinitecanvas.cc)

## Overview
A comprehensive step-by-step tutorial for building an infinite canvas using WebGL/WebGPU.

## Key Features
- High-Performance Rendering: WebGL & WebGPU
- Interactive: Executable code blocks
- Works with all frameworks: Web Components UI
- Rich graphics: Stickies, shapes, pen

## Lesson Structure (30 Lessons)

### Foundation (Lessons 1-8)
1. **Lesson 001 - Initialize canvas**
   - Hardware abstraction layers (HAL) based on WebGL1/2 and WebGPU
   - Designing Canvas API
   - Plugin-based architecture
   - Renderer Plugin, SwapChain, devicePixelRatio

2. **Lesson 002 - Draw a circle**
   - Basic shape rendering

3. **Lesson 003 - Scene graph and transform**
   - Hierarchical object management
   - Local/world transformation matrices

4. **Lesson 004 - Camera**
   - Pan, zoom, viewport management
   - Camera system implementation

5. **Lesson 005 - Grid**
   - Background grid rendering
   - Infinite grid patterns

6. **Lesson 006 - Event system**
   - Custom event handling
   - Mouse/touch/keyboard events

7. **Lesson 007 - Web UI**
   - UI components with Web Components
   - Toolbar, panels, controls

8. **Lesson 008 - Optimize performance**
   - Performance optimization techniques
   - Culling, batching

### Shape Rendering (Lessons 9-13)
9. **Lesson 009 - Draw ellipse and rectangle**
   - Basic shape primitives

10. **Lesson 010 - Import and export images**
    - Image handling
    - Efficient image loading

11. **Lesson 011 - Test and server-side rendering**
    - Testing strategies
    - SSR support

12. **Lesson 012 - Draw polyline**
    - Line and polyline rendering

13. **Lesson 013 - Draw path and sketchy style**
    - Path rendering
    - Rough/sketchy style (like Excalidraw)

### Advanced Features (Lessons 14-17)
14. **Lesson 014 - Canvas mode and auxiliary UI**
    - Different canvas modes
    - Auxiliary UI elements

15. **Lesson 015 - Text rendering**
    - Text rendering basics
    - SDF/MSDF text

16. **Lesson 016 - Text advanced features**
    - Rich text
    - Text editing

17. **Lesson 017 - Gradient and pattern**
    - Fill patterns
    - Gradient rendering

### Architecture & Collaboration (Lessons 18-20)
18. **Lesson 018 - Refactor with ECS**
    - Entity Component System architecture
    - Scalable architecture patterns

19. **Lesson 019 - History**
    - Undo/Redo system
    - Command pattern

20. **Lesson 020 - Collaboration**
    - Real-time collaboration
    - Multi-user support

### Interaction & Tools (Lessons 21-27)
21. **Lesson 021 - Transformer**
    - Selection handles
    - Resize/rotate controls

22. **Lesson 022 - VectorNetwork**
    - Vector network (like Figma)
    - Complex path editing

23. **Lesson 023 - Mindmap**
    - Mindmap implementation
    - Node-based layouts

24. **Lesson 024 - Context menu and clipboard**
    - Right-click menus
    - Copy/paste functionality

25. **Lesson 025 - Drawing mode and brush**
    - Freehand drawing
    - Brush tools

26. **Lesson 026 - Selection tool**
    - Multi-selection
    - Selection behaviors

27. **Lesson 027 - Snap and align**
    - Smart guides
    - Alignment helpers
    - Snapping to grid/objects

### Advanced Topics (Lessons 28-30)
28. **Lesson 028 - Integrating with AI**
    - AI integration
    - Smart features

29. **Lesson 029 - Embedding HTML content**
    - HTML embedding in canvas
    - Foreign objects

30. **Lesson 030 - Post-processing and render graph**
    - Post-processing effects
    - Render graph architecture

## Technical Stack
- WebGL/WebGPU for rendering
- GLSL shaders (compiled to WGSL for WebGPU)
- Hardware Abstraction Layer (@antv/g-device-api)
- Web Components for UI
- ECS architecture (after Lesson 17)
- Spectrum UI library

## Key References Mentioned
- wgpu (Rust WebGPU implementation)
- bevy (Rust game engine)
- Modyfi (creative design tool)
- noclip (WebGPU reference)
- Three.js Shading Language
- Figma rendering approach
- PixiJS, Konva
