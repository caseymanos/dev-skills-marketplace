//! Tool system for canvas interaction.

use bevy_ecs::prelude::*;
use crate::camera::Camera;
use crate::engine::SelectionState;
use crate::input::InputEvent;
use crate::scene::SceneGraph;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ToolType { #[default] Select, Pan, Rectangle, Ellipse, Line, Pen, Text }

impl ToolType {
    pub fn cursor(&self) -> &'static str {
        match self { ToolType::Select => "default", ToolType::Pan => "grab", ToolType::Rectangle | ToolType::Ellipse | ToolType::Line | ToolType::Pen => "crosshair", ToolType::Text => "text" }
    }
}

pub struct ToolManager {
    current_tool: ToolType,
    state: ToolState,
}

#[derive(Debug, Clone, Default)]
struct ToolState {
    is_dragging: bool,
    drag_start: Option<canvas_schema::Point>,
    drag_current: Option<canvas_schema::Point>,
    active_object: Option<canvas_schema::ObjectId>,
}

impl ToolManager {
    pub fn new() -> Self { Self { current_tool: ToolType::Select, state: ToolState::default() } }
    pub fn current_tool(&self) -> ToolType { self.current_tool }
    pub fn set_tool(&mut self, tool: ToolType) { self.state = ToolState::default(); self.current_tool = tool; }
    pub fn cursor(&self) -> &'static str { if self.state.is_dragging && self.current_tool == ToolType::Pan { "grabbing" } else { self.current_tool.cursor() } }

    pub fn handle_event(&mut self, event: InputEvent, _world: &mut World, camera: &mut Camera, scene: &mut SceneGraph, selection: &mut SelectionState) -> bool {
        match self.current_tool {
            ToolType::Select => self.handle_select_event(event, camera, scene, selection),
            ToolType::Pan => self.handle_pan_event(event, camera),
            _ => self.handle_draw_event(event),
        }
    }

    fn handle_select_event(&mut self, event: InputEvent, _camera: &mut Camera, scene: &mut SceneGraph, selection: &mut SelectionState) -> bool {
        match event {
            InputEvent::PointerDown { canvas_x, canvas_y, button, .. } => {
                if button == 0 {
                    let point = canvas_schema::Point::new(canvas_x, canvas_y);
                    if let Some(node) = scene.hit_test(point) { selection.selected_ids = vec![node.id.clone()]; }
                    else { selection.selected_ids.clear(); }
                    self.state.is_dragging = true;
                    self.state.drag_start = Some(point);
                    true
                } else { false }
            }
            InputEvent::PointerMove { .. } => self.state.is_dragging,
            InputEvent::PointerUp { .. } => { self.state.is_dragging = false; self.state.drag_start = None; true }
            _ => false,
        }
    }

    fn handle_pan_event(&mut self, event: InputEvent, camera: &mut Camera) -> bool {
        match event {
            InputEvent::PointerDown { screen_x, screen_y, button, .. } => {
                if button == 0 || button == 1 { self.state.is_dragging = true; self.state.drag_start = Some(canvas_schema::Point::new(screen_x, screen_y)); true }
                else { false }
            }
            InputEvent::PointerMove { screen_x, screen_y, .. } => {
                if self.state.is_dragging {
                    if let Some(start) = self.state.drag_start {
                        camera.pan_by(screen_x - start.x, screen_y - start.y);
                        self.state.drag_start = Some(canvas_schema::Point::new(screen_x, screen_y));
                    }
                    true
                } else { false }
            }
            InputEvent::PointerUp { .. } => { self.state.is_dragging = false; self.state.drag_start = None; true }
            InputEvent::Wheel { delta_x, delta_y, screen_x, screen_y, modifiers, .. } => {
                if modifiers.ctrl || modifiers.meta { camera.zoom_by(if delta_y > 0.0 { 0.9 } else { 1.1 }, screen_x, screen_y); }
                else { camera.pan_by(-delta_x, -delta_y); }
                true
            }
            _ => false,
        }
    }

    fn handle_draw_event(&mut self, event: InputEvent) -> bool {
        match event {
            InputEvent::PointerDown { canvas_x, canvas_y, button, .. } => {
                if button == 0 { self.state.is_dragging = true; self.state.drag_start = Some(canvas_schema::Point::new(canvas_x, canvas_y)); true }
                else { false }
            }
            InputEvent::PointerMove { canvas_x, canvas_y, .. } => {
                if self.state.is_dragging { self.state.drag_current = Some(canvas_schema::Point::new(canvas_x, canvas_y)); true }
                else { false }
            }
            InputEvent::PointerUp { .. } => { self.state.is_dragging = false; self.state.drag_start = None; self.state.drag_current = None; self.state.active_object = None; true }
            _ => false,
        }
    }
}

impl Default for ToolManager { fn default() -> Self { Self::new() } }
