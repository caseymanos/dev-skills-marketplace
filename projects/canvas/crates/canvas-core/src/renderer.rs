//! Renderer - GPU rendering with wgpu.

use bevy_ecs::prelude::*;
use canvas_schema::Color;
use crate::camera::Camera;
use crate::engine::{RenderStats, SelectionState};
use crate::scene::SceneGraph;

pub struct Renderer {
    width: u32,
    height: u32,
    background_color: Color,
    initialized: bool,
}

impl Renderer {
    pub fn new() -> Self { Self { width: 800, height: 600, background_color: Color::WHITE, initialized: false } }
    pub fn resize(&mut self, width: u32, height: u32) { self.width = width; self.height = height; }
    pub fn set_background_color(&mut self, color: Color) { self.background_color = color; }

    pub fn render(&mut self, _world: &World, _camera: &Camera, _scene: &SceneGraph, _selection: &SelectionState) -> RenderStats {
        RenderStats { frame_time: 0.0, draw_calls: 0, objects_rendered: 0, objects_culled: 0 }
    }
}

impl Default for Renderer { fn default() -> Self { Self::new() } }

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex {
    pub position: [f32; 2],
    pub color: [f32; 4],
}

impl Vertex {
    pub fn desc() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute { offset: 0, shader_location: 0, format: wgpu::VertexFormat::Float32x2 },
                wgpu::VertexAttribute { offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress, shader_location: 1, format: wgpu::VertexFormat::Float32x4 },
            ],
        }
    }
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct CameraUniform {
    pub view_proj: [[f32; 4]; 4],
}

impl CameraUniform {
    pub fn new() -> Self { Self { view_proj: [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]] } }

    pub fn update_from_camera(&mut self, camera: &Camera) {
        let view = camera.view_matrix();
        let w = camera.viewport_width as f32;
        let h = camera.viewport_height as f32;
        self.view_proj = [
            [2.0 / w, 0.0, 0.0, 0.0],
            [0.0, -2.0 / h, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [-1.0 + 2.0 * view.tx as f32 / w, 1.0 - 2.0 * view.ty as f32 / h, 0.0, 1.0],
        ];
    }
}

impl Default for CameraUniform { fn default() -> Self { Self::new() } }
