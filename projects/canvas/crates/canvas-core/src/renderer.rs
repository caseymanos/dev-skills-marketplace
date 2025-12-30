//! Renderer - GPU rendering with wgpu.

use bevy_ecs::prelude::*;
use canvas_schema::{Color, FillStyle};
use crate::camera::Camera;
use crate::engine::{RenderStats, SelectionState};
use crate::ecs::{
    EllipseComponent, FillComponent, LineComponent, RectangleComponent, Renderable,
    ShapeType, StrokeComponent, TextComponent, TransformComponent, VisibilityComponent, ZIndexComponent,
};
use crate::scene::SceneGraph;
use crate::text::{TextRenderer, TextVertex};
use std::sync::Arc;

const SHAPE_SHADER: &str = include_str!("shaders/shape.wgsl");

/// Maximum vertices per frame (grows dynamically if needed)
const INITIAL_VERTEX_CAPACITY: usize = 4096;
const INITIAL_INDEX_CAPACITY: usize = 8192;

pub struct Renderer {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    background_color: Color,
    pipeline: wgpu::RenderPipeline,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    camera_bind_group_layout: wgpu::BindGroupLayout,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    vertex_capacity: usize,
    index_capacity: usize,
    text_renderer: Option<TextRenderer>,
}

impl Renderer {
    pub async fn new(
        canvas: web_sys::HtmlCanvasElement,
        width: u32,
        height: u32,
        background_color: Color,
    ) -> Result<Self, String> {
        // Create wgpu instance with WebGPU primary, WebGL2 fallback
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL,
            ..Default::default()
        });

        // Create surface from canvas using raw handles (wgpu 23 API)
        let surface = {
            use wasm_bindgen::JsCast;
            let canvas_js: &wasm_bindgen::JsValue = canvas.as_ref();
            let obj = std::ptr::NonNull::from(canvas_js).cast();
            let raw_window_handle = raw_window_handle::WebCanvasWindowHandle::new(obj).into();
            let raw_display_handle = raw_window_handle::WebDisplayHandle::new().into();

            unsafe {
                instance.create_surface_unsafe(wgpu::SurfaceTargetUnsafe::RawHandle {
                    raw_display_handle,
                    raw_window_handle,
                })
            }
            .map_err(|e| format!("Failed to create surface: {}", e))?
        };

        // Request adapter
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| "No suitable GPU adapter found".to_string())?;

        log::info!("Using adapter: {:?}", adapter.get_info());

        // Request device
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Canvas Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    memory_hints: wgpu::MemoryHints::default(),
                },
                None,
            )
            .await
            .map_err(|e| format!("Failed to create device: {}", e))?;

        let device = Arc::new(device);
        let queue = Arc::new(queue);

        // Get surface capabilities and configure
        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: width.max(1),
            height: height.max(1),
            present_mode: wgpu::PresentMode::AutoVsync,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };

        surface.configure(&device, &config);

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Shape Shader"),
            source: wgpu::ShaderSource::Wgsl(SHAPE_SHADER.into()),
        });

        // Create camera uniform buffer
        let camera_uniform = CameraUniform::new();
        let camera_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Camera Buffer"),
            contents: bytemuck::cast_slice(&[camera_uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Camera Bind Group Layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        // Create bind group
        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Camera Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: camera_buffer.as_entire_binding(),
            }],
        });

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Shape Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create render pipeline
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Shape Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        // Create dynamic vertex and index buffers with initial capacity
        let vertex_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Vertex Buffer"),
            size: (INITIAL_VERTEX_CAPACITY * std::mem::size_of::<Vertex>()) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let index_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Index Buffer"),
            size: (INITIAL_INDEX_CAPACITY * std::mem::size_of::<u16>()) as u64,
            usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Create text renderer
        let text_renderer = TextRenderer::new(
            device.clone(),
            queue.clone(),
            format,
            &bind_group_layout,
        );

        log::info!("Renderer initialized: {}x{}, format: {:?}", width, height, format);

        Ok(Self {
            device,
            queue,
            surface,
            config,
            background_color,
            pipeline,
            camera_buffer,
            camera_bind_group,
            camera_bind_group_layout: bind_group_layout,
            vertex_buffer,
            index_buffer,
            vertex_capacity: INITIAL_VERTEX_CAPACITY,
            index_capacity: INITIAL_INDEX_CAPACITY,
            text_renderer: Some(text_renderer),
        })
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.device, &self.config);
        }
    }

    pub fn set_background_color(&mut self, color: Color) {
        self.background_color = color;
    }

    pub fn render(
        &mut self,
        world: &mut World,
        camera: &Camera,
        _scene: &SceneGraph,
        _selection: &SelectionState,
    ) -> RenderStats {
        // Update camera uniform
        let mut camera_uniform = CameraUniform::new();
        camera_uniform.update_from_camera(camera);
        self.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[camera_uniform]));

        // Build vertex and index data from ECS entities
        let (vertices, indices, objects_rendered) = self.build_geometry(world);

        // Build text geometry
        let (text_vertices, text_indices, text_count) = self.build_text_geometry(world);

        // Upload shape geometry data if we have any
        let num_indices = indices.len() as u32;
        if !vertices.is_empty() {
            // Resize buffers if needed
            if vertices.len() > self.vertex_capacity {
                self.vertex_capacity = vertices.len().next_power_of_two();
                self.vertex_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Vertex Buffer"),
                    size: (self.vertex_capacity * std::mem::size_of::<Vertex>()) as u64,
                    usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
            }
            if indices.len() > self.index_capacity {
                self.index_capacity = indices.len().next_power_of_two();
                self.index_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Index Buffer"),
                    size: (self.index_capacity * std::mem::size_of::<u16>()) as u64,
                    usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
            }

            self.queue.write_buffer(&self.vertex_buffer, 0, bytemuck::cast_slice(&vertices));
            self.queue.write_buffer(&self.index_buffer, 0, bytemuck::cast_slice(&indices));
        }

        // Get the next frame
        let frame = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.surface.configure(&self.device, &self.config);
                return RenderStats::default();
            }
            Err(e) => {
                log::error!("Surface error: {:?}", e);
                return RenderStats::default();
            }
        };

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });

        let mut draw_calls = 0u32;

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: self.background_color.r as f64,
                            g: self.background_color.g as f64,
                            b: self.background_color.b as f64,
                            a: self.background_color.a as f64,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Render shapes
            if num_indices > 0 {
                render_pass.set_pipeline(&self.pipeline);
                render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
                render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
                render_pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
                render_pass.draw_indexed(0..num_indices, 0, 0..1);
                draw_calls += 1;
            }

            // Render text
            if !text_indices.is_empty() {
                if let Some(text_renderer) = &mut self.text_renderer {
                    text_renderer.render(
                        &mut render_pass,
                        &text_vertices,
                        &text_indices,
                        &self.camera_bind_group,
                    );
                    draw_calls += 1;
                }
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        frame.present();

        RenderStats {
            frame_time: 0.0,
            draw_calls,
            objects_rendered: objects_rendered + text_count,
            objects_culled: 0,
        }
    }

    /// Build geometry from ECS entities
    fn build_geometry(&self, world: &mut World) -> (Vec<Vertex>, Vec<u16>, u32) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let mut objects_rendered = 0u32;

        // Query all renderable entities with their components, sorted by z-index
        let mut entities: Vec<_> = world
            .query_filtered::<(
                Entity,
                &TransformComponent,
                &ZIndexComponent,
                &VisibilityComponent,
                Option<&ShapeType>,
                Option<&RectangleComponent>,
                Option<&EllipseComponent>,
                Option<&LineComponent>,
                Option<&FillComponent>,
                Option<&StrokeComponent>,
            ), With<Renderable>>()
            .iter(world)
            .filter(|(_, _, _, vis, _, _, _, _, _, _)| vis.visible)
            .collect();

        // Sort by z-index
        entities.sort_by(|a, b| a.2.0.cmp(&b.2.0));

        for (
            _entity,
            transform,
            _z_index,
            _visibility,
            shape_type,
            rect,
            ellipse,
            line,
            fill,
            stroke,
        ) in entities
        {
            let base_vertex = vertices.len() as u16;

            match shape_type {
                Some(ShapeType::Rectangle) => {
                    if let Some(rect) = rect {
                        self.add_rectangle(
                            &mut vertices,
                            &mut indices,
                            base_vertex,
                            transform,
                            rect,
                            fill,
                            stroke,
                        );
                        objects_rendered += 1;
                    }
                }
                Some(ShapeType::Ellipse) => {
                    if let Some(ellipse) = ellipse {
                        self.add_ellipse(
                            &mut vertices,
                            &mut indices,
                            base_vertex,
                            transform,
                            ellipse,
                            fill,
                            stroke,
                        );
                        objects_rendered += 1;
                    }
                }
                Some(ShapeType::Line) => {
                    if let Some(line) = line {
                        self.add_line(
                            &mut vertices,
                            &mut indices,
                            base_vertex,
                            transform,
                            line,
                            stroke,
                        );
                        objects_rendered += 1;
                    }
                }
                // Text is handled separately
                _ => {}
            }
        }

        (vertices, indices, objects_rendered)
    }

    /// Build text geometry from ECS entities
    fn build_text_geometry(&self, world: &mut World) -> (Vec<TextVertex>, Vec<u16>, u32) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let mut text_count = 0u32;

        let text_renderer = match &self.text_renderer {
            Some(tr) => tr,
            None => return (vertices, indices, 0),
        };

        // Query text entities
        let mut text_entities: Vec<_> = world
            .query_filtered::<(
                &TransformComponent,
                &ZIndexComponent,
                &VisibilityComponent,
                &TextComponent,
            ), With<Renderable>>()
            .iter(world)
            .filter(|(_, _, vis, _)| vis.visible)
            .collect();

        // Sort by z-index
        text_entities.sort_by(|a, b| a.1.0.cmp(&b.1.0));

        for (transform, _z_index, _visibility, text) in text_entities {
            let color = [text.fill.r, text.fill.g, text.fill.b, text.fill.a];

            let (text_verts, text_indices) = text_renderer.generate_text_geometry(
                &text.content,
                0.0, // Text starts at transform origin
                0.0,
                text.font_size as f32,
                color,
                &transform.world,
            );

            // Offset indices for batch rendering
            let base_vertex = vertices.len() as u16;
            vertices.extend(text_verts);
            indices.extend(text_indices.iter().map(|i| i + base_vertex));
            text_count += 1;
        }

        (vertices, indices, text_count)
    }

    /// Add rectangle vertices and indices
    fn add_rectangle(
        &self,
        vertices: &mut Vec<Vertex>,
        indices: &mut Vec<u16>,
        base_vertex: u16,
        transform: &TransformComponent,
        rect: &RectangleComponent,
        fill: Option<&FillComponent>,
        stroke: Option<&StrokeComponent>,
    ) {
        let color = self.get_fill_color(fill);
        let t = &transform.world;

        // Rectangle vertices (4 corners)
        let w = rect.width as f32;
        let h = rect.height as f32;

        // Apply transform to each corner
        let corners = [
            (0.0, 0.0),     // top-left
            (w, 0.0),       // top-right
            (w, h),         // bottom-right
            (0.0, h),       // bottom-left
        ];

        for (lx, ly) in corners {
            let x = (t.a * lx as f64 + t.c * ly as f64 + t.tx) as f32;
            let y = (t.b * lx as f64 + t.d * ly as f64 + t.ty) as f32;
            vertices.push(Vertex { position: [x, y], color });
        }

        // Two triangles for the quad
        indices.extend_from_slice(&[
            base_vertex,
            base_vertex + 1,
            base_vertex + 2,
            base_vertex,
            base_vertex + 2,
            base_vertex + 3,
        ]);

        // Add stroke outline if present
        if let Some(stroke_comp) = stroke {
            let stroke_color = [
                stroke_comp.0.color.r,
                stroke_comp.0.color.g,
                stroke_comp.0.color.b,
                stroke_comp.0.color.a,
            ];
            let stroke_width = stroke_comp.0.width as f32;
            self.add_stroke_outline(vertices, indices, base_vertex, &corners, t, stroke_color, stroke_width);
        }
    }

    /// Add ellipse vertices and indices (approximated with triangles)
    fn add_ellipse(
        &self,
        vertices: &mut Vec<Vertex>,
        indices: &mut Vec<u16>,
        base_vertex: u16,
        transform: &TransformComponent,
        ellipse: &EllipseComponent,
        fill: Option<&FillComponent>,
        _stroke: Option<&StrokeComponent>,
    ) {
        let color = self.get_fill_color(fill);
        let t = &transform.world;
        let rx = ellipse.radius_x as f32;
        let ry = ellipse.radius_y as f32;

        // Number of segments for circle approximation
        const SEGMENTS: usize = 32;

        // Center vertex
        let cx = t.tx as f32;
        let cy = t.ty as f32;
        vertices.push(Vertex { position: [cx, cy], color });

        // Perimeter vertices
        for i in 0..SEGMENTS {
            let angle = (i as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
            let lx = angle.cos() * rx;
            let ly = angle.sin() * ry;
            let x = (t.a * lx as f64 + t.c * ly as f64 + t.tx) as f32;
            let y = (t.b * lx as f64 + t.d * ly as f64 + t.ty) as f32;
            vertices.push(Vertex { position: [x, y], color });
        }

        // Triangle fan indices
        for i in 0..SEGMENTS {
            let next = (i + 1) % SEGMENTS;
            indices.extend_from_slice(&[
                base_vertex,                      // center
                base_vertex + 1 + i as u16,       // current
                base_vertex + 1 + next as u16,    // next
            ]);
        }
    }

    /// Add line vertices and indices (as a quad with thickness)
    fn add_line(
        &self,
        vertices: &mut Vec<Vertex>,
        indices: &mut Vec<u16>,
        base_vertex: u16,
        transform: &TransformComponent,
        line: &LineComponent,
        stroke: Option<&StrokeComponent>,
    ) {
        let stroke_width = stroke.map(|s| s.0.width).unwrap_or(1.0) as f32;
        let color = stroke
            .map(|s| [s.0.color.r, s.0.color.g, s.0.color.b, s.0.color.a])
            .unwrap_or([0.0, 0.0, 0.0, 1.0]);

        let t = &transform.world;

        // Transform start and end points
        let x1 = (t.a * line.start.x + t.c * line.start.y + t.tx) as f32;
        let y1 = (t.b * line.start.x + t.d * line.start.y + t.ty) as f32;
        let x2 = (t.a * line.end.x + t.c * line.end.y + t.tx) as f32;
        let y2 = (t.b * line.end.x + t.d * line.end.y + t.ty) as f32;

        // Calculate perpendicular for line thickness
        let dx = x2 - x1;
        let dy = y2 - y1;
        let len = (dx * dx + dy * dy).sqrt();
        if len < 0.001 {
            return;
        }

        let half_width = stroke_width / 2.0;
        let nx = -dy / len * half_width;
        let ny = dx / len * half_width;

        // Four vertices forming the line quad
        vertices.push(Vertex { position: [x1 + nx, y1 + ny], color });
        vertices.push(Vertex { position: [x1 - nx, y1 - ny], color });
        vertices.push(Vertex { position: [x2 - nx, y2 - ny], color });
        vertices.push(Vertex { position: [x2 + nx, y2 + ny], color });

        // Two triangles
        indices.extend_from_slice(&[
            base_vertex,
            base_vertex + 1,
            base_vertex + 2,
            base_vertex,
            base_vertex + 2,
            base_vertex + 3,
        ]);
    }

    /// Add stroke outline around a shape
    fn add_stroke_outline(
        &self,
        _vertices: &mut Vec<Vertex>,
        _indices: &mut Vec<u16>,
        _base_vertex: u16,
        _corners: &[(f32, f32); 4],
        _transform: &canvas_schema::Transform,
        _color: [f32; 4],
        _width: f32,
    ) {
        // TODO: Implement proper stroke outline rendering
        // For now, strokes are not rendered separately
    }

    /// Extract fill color from FillComponent
    fn get_fill_color(&self, fill: Option<&FillComponent>) -> [f32; 4] {
        match fill {
            Some(FillComponent(FillStyle::Solid { color })) => {
                [color.r, color.g, color.b, color.a]
            }
            Some(FillComponent(FillStyle::LinearGradient { stops, .. })) => {
                // Use first gradient stop color as fallback
                stops.first().map(|s| [s.color.r, s.color.g, s.color.b, s.color.a])
                    .unwrap_or([1.0, 1.0, 1.0, 1.0])
            }
            Some(FillComponent(FillStyle::RadialGradient { stops, .. })) => {
                // Use first gradient stop color as fallback
                stops.first().map(|s| [s.color.r, s.color.g, s.color.b, s.color.a])
                    .unwrap_or([1.0, 1.0, 1.0, 1.0])
            }
            None => [1.0, 1.0, 1.0, 1.0], // Default white
        }
    }

    pub fn device(&self) -> &wgpu::Device {
        &self.device
    }

    pub fn queue(&self) -> &wgpu::Queue {
        &self.queue
    }
}

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
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x4,
                },
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
    pub fn new() -> Self {
        Self {
            view_proj: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    pub fn update_from_camera(&mut self, camera: &Camera) {
        let view = camera.view_matrix();
        let w = camera.viewport_width as f32;
        let h = camera.viewport_height as f32;
        let zoom = camera.zoom as f32;

        // Create orthographic projection with camera transform
        // This maps canvas coordinates to clip space [-1, 1]
        self.view_proj = [
            [2.0 * zoom / w, 0.0, 0.0, 0.0],
            [0.0, -2.0 * zoom / h, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [
                -1.0 - 2.0 * camera.x as f32 * zoom / w,
                1.0 + 2.0 * camera.y as f32 * zoom / h,
                0.0,
                1.0,
            ],
        ];
    }
}

impl Default for CameraUniform {
    fn default() -> Self {
        Self::new()
    }
}

// Re-export wgpu buffer utilities
use wgpu::util::DeviceExt;
