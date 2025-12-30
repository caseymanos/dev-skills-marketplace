//! Canvas Engine - main entry point.

use bevy_ecs::prelude::*;
use canvas_schema::*;
use thiserror::Error;
use crate::camera::Camera;
use crate::renderer::Renderer;
use crate::scene::SceneGraph;
use crate::tools::{ToolType, ToolManager};
use crate::input::InputEvent;

#[derive(Error, Debug)]
pub enum EngineError {
    #[error("Renderer initialization failed: {0}")] RendererInit(String),
    #[error("Object not found: {0}")] ObjectNotFound(ObjectId),
    #[error("Invalid operation: {0}")] InvalidOperation(String),
}

#[derive(Debug, Clone, Default)]
pub struct RenderStats {
    pub frame_time: f64,
    pub draw_calls: u32,
    pub objects_rendered: u32,
    pub objects_culled: u32,
}

#[derive(Debug, Clone, Default)]
pub struct SelectionState {
    pub selected_ids: Vec<ObjectId>,
    pub bounds: Option<BoundingBox>,
}

#[derive(Debug, Clone)]
pub struct EngineOptions {
    pub preferred_backend: RenderBackend,
    pub device_pixel_ratio: f64,
    pub background_color: Color,
    pub debug: bool,
    pub max_zoom: f64,
    pub min_zoom: f64,
}

impl Default for EngineOptions {
    fn default() -> Self {
        Self { preferred_backend: RenderBackend::WebGpu, device_pixel_ratio: 1.0, background_color: Color::WHITE, debug: false, max_zoom: 256.0, min_zoom: 0.01 }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum RenderBackend { #[default] WebGpu, WebGl2, WebGl }

pub struct CanvasEngine {
    world: World,
    camera: Camera,
    scene: SceneGraph,
    renderer: Option<Renderer>,
    tool_manager: ToolManager,
    selection: SelectionState,
    options: EngineOptions,
    needs_render: bool,
}

impl CanvasEngine {
    pub fn new(options: EngineOptions) -> Self {
        Self { world: World::new(), camera: Camera::default(), scene: SceneGraph::new(), renderer: None, tool_manager: ToolManager::new(), selection: SelectionState::default(), options, needs_render: true }
    }

    pub async fn init(&mut self, width: u32, height: u32) -> Result<(), EngineError> {
        self.camera.set_viewport(width as f64, height as f64);
        self.renderer = Some(Renderer::new());
        Ok(())
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        self.camera.set_viewport(width as f64, height as f64);
        if let Some(renderer) = &mut self.renderer { renderer.resize(width, height); }
        self.needs_render = true;
    }

    pub fn render(&mut self) -> RenderStats {
        let start = std::time::Instant::now();
        let stats = if let Some(renderer) = &mut self.renderer {
            renderer.render(&self.world, &self.camera, &self.scene, &self.selection)
        } else { RenderStats::default() };
        self.needs_render = false;
        RenderStats { frame_time: start.elapsed().as_secs_f64() * 1000.0, ..stats }
    }

    pub fn request_render(&mut self) { self.needs_render = true; }
    pub fn needs_render(&self) -> bool { self.needs_render }

    pub fn handle_event(&mut self, event: InputEvent) -> bool {
        let consumed = self.tool_manager.handle_event(event, &mut self.world, &mut self.camera, &mut self.scene, &mut self.selection);
        if consumed { self.needs_render = true; }
        consumed
    }

    pub fn set_tool(&mut self, tool: ToolType) { self.tool_manager.set_tool(tool); }
    pub fn get_tool(&self) -> ToolType { self.tool_manager.current_tool() }
    pub fn get_camera(&self) -> &Camera { &self.camera }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera.x = x; self.camera.y = y;
        self.camera.zoom = zoom.clamp(self.options.min_zoom, self.options.max_zoom);
        self.needs_render = true;
    }

    pub fn pan_by(&mut self, dx: f64, dy: f64) { self.camera.pan_by(dx, dy); self.needs_render = true; }
    pub fn zoom_to(&mut self, zoom: f64, center_x: f64, center_y: f64) { self.camera.zoom_to(zoom, center_x, center_y); self.needs_render = true; }
    pub fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> Point { self.camera.screen_to_canvas(screen_x, screen_y) }
    pub fn canvas_to_screen(&self, canvas_x: f64, canvas_y: f64) -> Point { self.camera.canvas_to_screen(canvas_x, canvas_y) }
    pub fn get_selection(&self) -> &SelectionState { &self.selection }

    pub fn set_selection(&mut self, ids: Vec<ObjectId>) { self.selection.selected_ids = ids; self.needs_render = true; }
    pub fn clear_selection(&mut self) { self.selection.selected_ids.clear(); self.selection.bounds = None; self.needs_render = true; }
    pub fn get_all_object_ids(&self) -> Vec<ObjectId> { self.scene.get_all_object_ids() }
}
