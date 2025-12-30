//! Text rendering with MSDF fonts.
//!
//! This module provides high-quality text rendering using Multi-channel Signed Distance Fields.
//! MSDF fonts allow for crisp text at any scale without needing multiple font sizes.

use std::collections::HashMap;
use std::sync::Arc;
use wgpu::util::DeviceExt;

/// Vertex for text rendering
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct TextVertex {
    pub position: [f32; 2],
    pub uv: [f32; 2],
    pub color: [f32; 4],
}

impl TextVertex {
    pub fn desc() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<TextVertex>() as wgpu::BufferAddress,
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
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 4]>() as wgpu::BufferAddress,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32x4,
                },
            ],
        }
    }
}

/// Glyph metrics for a single character
#[derive(Debug, Clone, Copy)]
pub struct GlyphMetrics {
    /// UV coordinates in the atlas (normalized 0-1)
    pub uv_min: [f32; 2],
    pub uv_max: [f32; 2],
    /// Size of the glyph in pixels at base font size
    pub width: f32,
    pub height: f32,
    /// Offset from baseline
    pub bearing_x: f32,
    pub bearing_y: f32,
    /// Advance to next character
    pub advance: f32,
}

/// Font atlas containing MSDF texture and glyph metrics
pub struct FontAtlas {
    /// Glyph metrics indexed by character
    pub glyphs: HashMap<char, GlyphMetrics>,
    /// Base font size the atlas was generated at
    pub base_size: f32,
    /// Line height
    pub line_height: f32,
    /// Atlas texture dimensions
    pub atlas_width: u32,
    pub atlas_height: u32,
}

impl FontAtlas {
    /// Create a built-in monospace font atlas with basic ASCII characters
    /// This is a fallback when no custom font is loaded
    pub fn builtin() -> Self {
        let mut glyphs = HashMap::new();

        // Define a simple monospace character set
        // Each character is 8x16 pixels in a 16x16 grid (256 chars)
        let char_width = 8.0;
        let char_height = 16.0;
        let atlas_cols = 16;
        let atlas_width = 128.0;
        let atlas_height = 128.0;

        // Basic ASCII printable characters (32-126)
        for code in 32u8..=126 {
            let c = code as char;
            let col = (code - 32) % atlas_cols;
            let row = (code - 32) / atlas_cols;

            let uv_x = col as f32 * char_width / atlas_width;
            let uv_y = row as f32 * char_height / atlas_height;

            glyphs.insert(
                c,
                GlyphMetrics {
                    uv_min: [uv_x, uv_y],
                    uv_max: [uv_x + char_width / atlas_width, uv_y + char_height / atlas_height],
                    width: char_width,
                    height: char_height,
                    bearing_x: 0.0,
                    bearing_y: char_height,
                    advance: char_width,
                },
            );
        }

        Self {
            glyphs,
            base_size: 16.0,
            line_height: 20.0,
            atlas_width: 128,
            atlas_height: 128,
        }
    }

    /// Get metrics for a character, falling back to '?' if not found
    pub fn get_glyph(&self, c: char) -> Option<&GlyphMetrics> {
        self.glyphs.get(&c).or_else(|| self.glyphs.get(&'?'))
    }

    /// Calculate text dimensions
    pub fn measure_text(&self, text: &str, font_size: f32) -> (f32, f32) {
        let scale = font_size / self.base_size;
        let mut width = 0.0f32;
        let mut max_width = 0.0f32;
        let mut lines = 1;

        for c in text.chars() {
            if c == '\n' {
                max_width = max_width.max(width);
                width = 0.0;
                lines += 1;
                continue;
            }

            if let Some(glyph) = self.get_glyph(c) {
                width += glyph.advance * scale;
            }
        }

        max_width = max_width.max(width);
        let height = lines as f32 * self.line_height * scale;

        (max_width, height)
    }
}

/// Text renderer manages font resources and generates geometry
pub struct TextRenderer {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    pipeline: wgpu::RenderPipeline,
    font_bind_group_layout: wgpu::BindGroupLayout,
    font_bind_group: wgpu::BindGroup,
    font_atlas: FontAtlas,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    vertex_capacity: usize,
    index_capacity: usize,
}

const TEXT_SHADER: &str = include_str!("shaders/text.wgsl");
const INITIAL_TEXT_VERTICES: usize = 1024;
const INITIAL_TEXT_INDICES: usize = 2048;

impl TextRenderer {
    pub fn new(
        device: Arc<wgpu::Device>,
        queue: Arc<wgpu::Queue>,
        format: wgpu::TextureFormat,
        camera_bind_group_layout: &wgpu::BindGroupLayout,
    ) -> Self {
        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Text Shader"),
            source: wgpu::ShaderSource::Wgsl(TEXT_SHADER.into()),
        });

        // Create font texture bind group layout
        let font_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Font Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        // Create font atlas and texture
        let font_atlas = FontAtlas::builtin();
        let (font_texture, font_bind_group) =
            Self::create_builtin_font_texture(&device, &queue, &font_bind_group_layout, &font_atlas);

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Text Pipeline Layout"),
            bind_group_layouts: &[camera_bind_group_layout, &font_bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create render pipeline
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Text Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[TextVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main_sdf"), // Use SDF shader for builtin font
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

        // Create vertex and index buffers
        let vertex_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Text Vertex Buffer"),
            size: (INITIAL_TEXT_VERTICES * std::mem::size_of::<TextVertex>()) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let index_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Text Index Buffer"),
            size: (INITIAL_TEXT_INDICES * std::mem::size_of::<u16>()) as u64,
            usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Self {
            device,
            queue,
            pipeline,
            font_bind_group_layout,
            font_bind_group,
            font_atlas,
            vertex_buffer,
            index_buffer,
            vertex_capacity: INITIAL_TEXT_VERTICES,
            index_capacity: INITIAL_TEXT_INDICES,
        }
    }

    /// Create a simple SDF texture for the builtin font
    fn create_builtin_font_texture(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        bind_group_layout: &wgpu::BindGroupLayout,
        atlas: &FontAtlas,
    ) -> (wgpu::Texture, wgpu::BindGroup) {
        // Generate a simple SDF texture with basic glyphs
        // For a real implementation, this would load a pre-generated MSDF atlas
        let width = atlas.atlas_width;
        let height = atlas.atlas_height;

        // Create a simple filled rectangle for each character position
        // In production, you'd load an actual MSDF font atlas
        let mut data = vec![0u8; (width * height * 4) as usize];

        // Fill with a simple pattern - each character cell has a filled center
        for row in 0..height {
            for col in 0..width {
                let idx = ((row * width + col) * 4) as usize;
                let cell_x = col % 8;
                let cell_y = row % 16;

                // Create a simple rectangular glyph shape
                let inside = cell_x >= 1 && cell_x <= 6 && cell_y >= 2 && cell_y <= 13;

                // SDF value: 1.0 inside, 0.0 outside, with gradient at edges
                let distance = if inside {
                    let dx = (cell_x as f32 - 3.5).abs() / 3.5;
                    let dy = (cell_y as f32 - 7.5).abs() / 6.5;
                    let d = 1.0 - dx.max(dy);
                    (0.5 + d * 0.5).min(1.0)
                } else {
                    let dx = if cell_x < 1 {
                        1 - cell_x
                    } else if cell_x > 6 {
                        cell_x - 6
                    } else {
                        0
                    };
                    let dy = if cell_y < 2 {
                        2 - cell_y
                    } else if cell_y > 13 {
                        cell_y - 13
                    } else {
                        0
                    };
                    let d = ((dx * dx + dy * dy) as f32).sqrt();
                    (0.5 - d * 0.1).max(0.0)
                };

                let v = (distance * 255.0) as u8;
                data[idx] = v;     // R
                data[idx + 1] = v; // G
                data[idx + 2] = v; // B
                data[idx + 3] = v; // A (used for SDF)
            }
        }

        let texture = device.create_texture_with_data(
            queue,
            &wgpu::TextureDescriptor {
                label: Some("Font Atlas Texture"),
                size: wgpu::Extent3d {
                    width,
                    height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            },
            wgpu::util::TextureDataOrder::LayerMajor,
            &data,
        );

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Font Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Font Bind Group"),
            layout: bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
        });

        (texture, bind_group)
    }

    /// Generate vertices for text
    pub fn generate_text_geometry(
        &self,
        text: &str,
        x: f32,
        y: f32,
        font_size: f32,
        color: [f32; 4],
        transform: &canvas_schema::Transform,
    ) -> (Vec<TextVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();

        let scale = font_size / self.font_atlas.base_size;
        let mut cursor_x = 0.0f32;
        let mut cursor_y = 0.0f32;

        for c in text.chars() {
            if c == '\n' {
                cursor_x = 0.0;
                cursor_y += self.font_atlas.line_height * scale;
                continue;
            }

            let Some(glyph) = self.font_atlas.get_glyph(c) else {
                continue;
            };

            let base_vertex = vertices.len() as u16;

            // Calculate glyph quad corners in local space
            let gx = cursor_x + glyph.bearing_x * scale;
            let gy = cursor_y + (self.font_atlas.base_size - glyph.bearing_y) * scale;
            let gw = glyph.width * scale;
            let gh = glyph.height * scale;

            // Quad corners (top-left, top-right, bottom-right, bottom-left)
            let corners = [
                (gx, gy),
                (gx + gw, gy),
                (gx + gw, gy + gh),
                (gx, gy + gh),
            ];

            let uvs = [
                glyph.uv_min,
                [glyph.uv_max[0], glyph.uv_min[1]],
                glyph.uv_max,
                [glyph.uv_min[0], glyph.uv_max[1]],
            ];

            for i in 0..4 {
                let (lx, ly) = corners[i];
                // Apply transform
                let px = (transform.a * (x + lx) as f64 + transform.c * (y + ly) as f64 + transform.tx) as f32;
                let py = (transform.b * (x + lx) as f64 + transform.d * (y + ly) as f64 + transform.ty) as f32;

                vertices.push(TextVertex {
                    position: [px, py],
                    uv: uvs[i],
                    color,
                });
            }

            // Two triangles per glyph
            indices.extend_from_slice(&[
                base_vertex,
                base_vertex + 1,
                base_vertex + 2,
                base_vertex,
                base_vertex + 2,
                base_vertex + 3,
            ]);

            cursor_x += glyph.advance * scale;
        }

        (vertices, indices)
    }

    /// Render text entities
    pub fn render<'a>(
        &'a mut self,
        render_pass: &mut wgpu::RenderPass<'a>,
        vertices: &[TextVertex],
        indices: &[u16],
        camera_bind_group: &'a wgpu::BindGroup,
    ) {
        if indices.is_empty() {
            return;
        }

        // Resize buffers if needed
        if vertices.len() > self.vertex_capacity {
            self.vertex_capacity = vertices.len().next_power_of_two();
            self.vertex_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Text Vertex Buffer"),
                size: (self.vertex_capacity * std::mem::size_of::<TextVertex>()) as u64,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
        }
        if indices.len() > self.index_capacity {
            self.index_capacity = indices.len().next_power_of_two();
            self.index_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Text Index Buffer"),
                size: (self.index_capacity * std::mem::size_of::<u16>()) as u64,
                usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
        }

        self.queue.write_buffer(&self.vertex_buffer, 0, bytemuck::cast_slice(vertices));
        self.queue.write_buffer(&self.index_buffer, 0, bytemuck::cast_slice(indices));

        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, camera_bind_group, &[]);
        render_pass.set_bind_group(1, &self.font_bind_group, &[]);
        render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        render_pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
        render_pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    /// Get reference to font atlas for text measurement
    pub fn font_atlas(&self) -> &FontAtlas {
        &self.font_atlas
    }
}
