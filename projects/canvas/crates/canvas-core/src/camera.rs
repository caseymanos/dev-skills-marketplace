//! 2D Camera system for canvas pan and zoom.

use canvas_schema::{Point, Transform, BoundingBox};

#[derive(Debug, Clone, Copy)]
pub struct Camera {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
    pub viewport_width: f64,
    pub viewport_height: f64,
}

impl Default for Camera {
    fn default() -> Self { Self { x: 0.0, y: 0.0, zoom: 1.0, viewport_width: 800.0, viewport_height: 600.0 } }
}

impl Camera {
    pub const MIN_ZOOM: f64 = 0.01;
    pub const MAX_ZOOM: f64 = 256.0;

    pub fn new(viewport_width: f64, viewport_height: f64) -> Self {
        Self { viewport_width, viewport_height, ..Default::default() }
    }

    pub fn set_viewport(&mut self, width: f64, height: f64) {
        self.viewport_width = width;
        self.viewport_height = height;
    }

    pub fn pan_by(&mut self, dx: f64, dy: f64) {
        self.x -= dx / self.zoom;
        self.y -= dy / self.zoom;
    }

    pub fn zoom_to(&mut self, new_zoom: f64, screen_x: f64, screen_y: f64) {
        let new_zoom = new_zoom.clamp(Self::MIN_ZOOM, Self::MAX_ZOOM);
        let canvas_point = self.screen_to_canvas(screen_x, screen_y);
        self.zoom = new_zoom;
        let new_screen = self.canvas_to_screen(canvas_point.x, canvas_point.y);
        self.x += (new_screen.x - screen_x) / self.zoom;
        self.y += (new_screen.y - screen_y) / self.zoom;
    }

    pub fn zoom_by(&mut self, factor: f64, screen_x: f64, screen_y: f64) {
        self.zoom_to(self.zoom * factor, screen_x, screen_y);
    }

    pub fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> Point {
        Point {
            x: (screen_x - self.viewport_width / 2.0) / self.zoom + self.x,
            y: (screen_y - self.viewport_height / 2.0) / self.zoom + self.y,
        }
    }

    pub fn canvas_to_screen(&self, canvas_x: f64, canvas_y: f64) -> Point {
        Point {
            x: (canvas_x - self.x) * self.zoom + self.viewport_width / 2.0,
            y: (canvas_y - self.y) * self.zoom + self.viewport_height / 2.0,
        }
    }

    pub fn view_matrix(&self) -> Transform {
        Transform {
            a: self.zoom, b: 0.0, c: 0.0, d: self.zoom,
            tx: -self.x * self.zoom + self.viewport_width / 2.0,
            ty: -self.y * self.zoom + self.viewport_height / 2.0,
        }
    }

    pub fn visible_bounds(&self) -> BoundingBox {
        let half_width = self.viewport_width / (2.0 * self.zoom);
        let half_height = self.viewport_height / (2.0 * self.zoom);
        BoundingBox { x: self.x - half_width, y: self.y - half_height, width: half_width * 2.0, height: half_height * 2.0 }
    }
}
