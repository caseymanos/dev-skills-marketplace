//! Primitive types used throughout the canvas system.

use serde::{Deserialize, Serialize};

pub type ObjectId = String;
pub type PageId = String;
pub type DocumentId = String;
pub type UserId = String;
pub type ZIndex = String;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub const ZERO: Point = Point { x: 0.0, y: 0.0 };
    pub fn new(x: f64, y: f64) -> Self { Self { x, y } }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

impl Size {
    pub fn new(width: f64, height: f64) -> Self { Self { width, height } }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl BoundingBox {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self { Self { x, y, width, height } }

    pub fn contains(&self, point: Point) -> bool {
        point.x >= self.x && point.x <= self.x + self.width &&
        point.y >= self.y && point.y <= self.y + self.height
    }

    pub fn intersects(&self, other: &BoundingBox) -> bool {
        self.x < other.x + other.width && self.x + self.width > other.x &&
        self.y < other.y + other.height && self.y + self.height > other.y
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Color {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl Default for Color {
    fn default() -> Self { Self::BLACK }
}

impl Color {
    pub const BLACK: Color = Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    pub const WHITE: Color = Color { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
    pub const TRANSPARENT: Color = Color { r: 0.0, g: 0.0, b: 0.0, a: 0.0 };
    pub const RED: Color = Color { r: 1.0, g: 0.0, b: 0.0, a: 1.0 };

    pub fn new(r: f32, g: f32, b: f32, a: f32) -> Self { Self { r, g, b, a } }

    pub fn from_rgba8(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r: r as f32 / 255.0, g: g as f32 / 255.0, b: b as f32 / 255.0, a: a as f32 / 255.0 }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Transform {
    pub a: f64, pub b: f64, pub c: f64, pub d: f64, pub tx: f64, pub ty: f64,
}

impl Default for Transform {
    fn default() -> Self { Self::IDENTITY }
}

impl Transform {
    pub const IDENTITY: Transform = Transform { a: 1.0, b: 0.0, c: 0.0, d: 1.0, tx: 0.0, ty: 0.0 };

    pub fn translate(x: f64, y: f64) -> Self { Transform { tx: x, ty: y, ..Self::IDENTITY } }
    pub fn scale(sx: f64, sy: f64) -> Self { Transform { a: sx, d: sy, ..Self::IDENTITY } }

    pub fn multiply(&self, other: &Transform) -> Transform {
        Transform {
            a: self.a * other.a + self.c * other.b,
            b: self.b * other.a + self.d * other.b,
            c: self.a * other.c + self.c * other.d,
            d: self.b * other.c + self.d * other.d,
            tx: self.a * other.tx + self.c * other.ty + self.tx,
            ty: self.b * other.tx + self.d * other.ty + self.ty,
        }
    }

    pub fn apply(&self, point: Point) -> Point {
        Point {
            x: self.a * point.x + self.c * point.y + self.tx,
            y: self.b * point.x + self.d * point.y + self.ty,
        }
    }
}
