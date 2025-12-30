// MSDF Text shader for high-quality text rendering

struct CameraUniform {
    view_proj: mat4x4<f32>,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

@group(1) @binding(0)
var font_texture: texture_2d<f32>;

@group(1) @binding(1)
var font_sampler: sampler;

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = camera.view_proj * vec4<f32>(in.position, 0.0, 1.0);
    out.uv = in.uv;
    out.color = in.color;
    return out;
}

// Median of three values - used for MSDF
fn median(r: f32, g: f32, b: f32) -> f32 {
    return max(min(r, g), min(max(r, g), b));
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the MSDF texture
    let msdf = textureSample(font_texture, font_sampler, in.uv);

    // Get the signed distance from the median of RGB channels
    let sd = median(msdf.r, msdf.g, msdf.b);

    // Calculate screen-space derivative for anti-aliasing
    let screen_px_range = 4.0; // Adjust based on font generation settings
    let screen_px_distance = screen_px_range * (sd - 0.5);

    // Apply anti-aliasing with smoothstep
    let alpha = clamp(screen_px_distance + 0.5, 0.0, 1.0);

    // Discard fully transparent pixels
    if (alpha < 0.01) {
        discard;
    }

    return vec4<f32>(in.color.rgb, in.color.a * alpha);
}

// Alternative SDF fragment shader (single channel)
@fragment
fn fs_main_sdf(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the SDF texture (alpha channel contains distance)
    let sd = textureSample(font_texture, font_sampler, in.uv).a;

    // Calculate anti-aliased alpha
    let screen_px_range = 4.0;
    let screen_px_distance = screen_px_range * (sd - 0.5);
    let alpha = clamp(screen_px_distance + 0.5, 0.0, 1.0);

    if (alpha < 0.01) {
        discard;
    }

    return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
