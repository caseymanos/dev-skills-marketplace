//! Document Schema (Automerge)
//!
//! Defines the Automerge document structure shared by all agents.
//! This is the single source of truth for canvas state.
//!
//! Owner: Shared (all agents read/write through Automerge)
//! Version: 1.0.0
//!
//! # Automerge Document Structure
//!
//! ```json
//! {
//!   "metadata": { ... },
//!   "pages": ["page-1", "page-2"],
//!   "objects": {
//!     "obj-abc123": { ... },
//!     "obj-def456": { ... }
//!   },
//!   "pageObjects": {
//!     "page-1": ["obj-abc123", "obj-def456"]
//!   }
//! }
//! ```

use automerge::{AutoCommit, ObjType, ScalarValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// IDENTIFIER TYPES
// =============================================================================

/// Unique identifier for objects (ULID format recommended)
pub type ObjectId = String;

/// Unique identifier for pages
pub type PageId = String;

/// Unique identifier for documents
pub type DocumentId = String;

/// Unique identifier for users
pub type UserId = String;

// =============================================================================
// PRIMITIVE TYPES
// =============================================================================

/// 2D point in canvas coordinates
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// 2D size
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

/// RGBA color (0.0-1.0 per channel for GPU compatibility)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Color {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl Color {
    pub const BLACK: Color = Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    pub const WHITE: Color = Color { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
    pub const TRANSPARENT: Color = Color { r: 0.0, g: 0.0, b: 0.0, a: 0.0 };
}

/// 2D transformation matrix (3x3, affine)
/// | a  c  tx |
/// | b  d  ty |
/// | 0  0  1  |
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Transform {
    pub a: f64,   // scale x
    pub b: f64,   // skew y
    pub c: f64,   // skew x
    pub d: f64,   // scale y
    pub tx: f64,  // translate x
    pub ty: f64,  // translate y
}

impl Default for Transform {
    fn default() -> Self {
        Self::IDENTITY
    }
}

impl Transform {
    pub const IDENTITY: Transform = Transform {
        a: 1.0, b: 0.0,
        c: 0.0, d: 1.0,
        tx: 0.0, ty: 0.0,
    };

    pub fn translate(x: f64, y: f64) -> Self {
        Transform { tx: x, ty: y, ..Self::IDENTITY }
    }

    pub fn scale(sx: f64, sy: f64) -> Self {
        Transform { a: sx, d: sy, ..Self::IDENTITY }
    }

    pub fn rotate(radians: f64) -> Self {
        let cos = radians.cos();
        let sin = radians.sin();
        Transform { a: cos, b: sin, c: -sin, d: cos, ..Self::IDENTITY }
    }
}

/// Fractional index for z-ordering (allows insertions between any two items)
/// Uses string-based fractional indexing (e.g., "a0", "a0V", "a1")
pub type ZIndex = String;

// =============================================================================
// DOCUMENT STRUCTURE
// =============================================================================

/// Root document structure stored in Automerge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasDocument {
    /// Document metadata
    pub metadata: DocumentMetadata,

    /// Ordered list of page IDs
    pub pages: Vec<PageId>,

    /// All objects in the document, keyed by ObjectId
    pub objects: HashMap<ObjectId, CanvasObject>,

    /// Objects per page (for efficient page-based queries)
    pub page_objects: HashMap<PageId, Vec<ObjectId>>,
}

/// Document metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub id: DocumentId,
    pub title: String,
    pub created_at: String,  // ISO 8601
    pub updated_at: String,  // ISO 8601
    pub created_by: UserId,
    pub version: u64,
}

// =============================================================================
// PAGE STRUCTURE
// =============================================================================

/// A page within the document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: PageId,
    pub name: String,
    pub background_color: Color,
    pub width: f64,
    pub height: f64,
}

// =============================================================================
// CANVAS OBJECT TYPES
// =============================================================================

/// Discriminated union of all canvas object types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanvasObject {
    #[serde(rename = "rectangle")]
    Rectangle(RectangleObject),

    #[serde(rename = "ellipse")]
    Ellipse(EllipseObject),

    #[serde(rename = "line")]
    Line(LineObject),

    #[serde(rename = "polyline")]
    Polyline(PolylineObject),

    #[serde(rename = "path")]
    Path(PathObject),

    #[serde(rename = "text")]
    Text(TextObject),

    #[serde(rename = "image")]
    Image(ImageObject),

    #[serde(rename = "group")]
    Group(GroupObject),
}

impl CanvasObject {
    /// Get the base properties common to all objects
    pub fn base(&self) -> &BaseObjectProperties {
        match self {
            CanvasObject::Rectangle(o) => &o.base,
            CanvasObject::Ellipse(o) => &o.base,
            CanvasObject::Line(o) => &o.base,
            CanvasObject::Polyline(o) => &o.base,
            CanvasObject::Path(o) => &o.base,
            CanvasObject::Text(o) => &o.base,
            CanvasObject::Image(o) => &o.base,
            CanvasObject::Group(o) => &o.base,
        }
    }

    pub fn base_mut(&mut self) -> &mut BaseObjectProperties {
        match self {
            CanvasObject::Rectangle(o) => &mut o.base,
            CanvasObject::Ellipse(o) => &mut o.base,
            CanvasObject::Line(o) => &mut o.base,
            CanvasObject::Polyline(o) => &mut o.base,
            CanvasObject::Path(o) => &mut o.base,
            CanvasObject::Text(o) => &mut o.base,
            CanvasObject::Image(o) => &mut o.base,
            CanvasObject::Group(o) => &mut o.base,
        }
    }
}

/// Properties common to all canvas objects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseObjectProperties {
    /// Unique object identifier
    pub id: ObjectId,

    /// Page this object belongs to
    pub page_id: PageId,

    /// Parent object ID (for grouping)
    pub parent_id: Option<ObjectId>,

    /// Local transform relative to parent
    pub transform: Transform,

    /// Z-ordering index (fractional)
    pub z_index: ZIndex,

    /// Visibility flag
    pub visible: bool,

    /// Lock flag (prevents editing)
    pub locked: bool,

    /// Object name (for layers panel)
    pub name: Option<String>,
}

// =============================================================================
// SHAPE OBJECTS
// =============================================================================

/// Stroke style properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeStyle {
    pub color: Color,
    pub width: f64,
    pub cap: StrokeCap,
    pub join: StrokeJoin,
    pub dash_array: Option<Vec<f64>>,
    pub dash_offset: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StrokeCap {
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StrokeJoin {
    Miter,
    Round,
    Bevel,
}

/// Fill style properties
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FillStyle {
    #[serde(rename = "solid")]
    Solid { color: Color },

    #[serde(rename = "linear_gradient")]
    LinearGradient {
        start: Point,
        end: Point,
        stops: Vec<GradientStop>,
    },

    #[serde(rename = "radial_gradient")]
    RadialGradient {
        center: Point,
        radius: f64,
        stops: Vec<GradientStop>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GradientStop {
    pub offset: f64,  // 0.0 to 1.0
    pub color: Color,
}

/// Rectangle object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RectangleObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub width: f64,
    pub height: f64,
    pub corner_radius: [f64; 4],  // [top-left, top-right, bottom-right, bottom-left]
    pub fill: Option<FillStyle>,
    pub stroke: Option<StrokeStyle>,
}

/// Ellipse object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EllipseObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub radius_x: f64,
    pub radius_y: f64,
    pub fill: Option<FillStyle>,
    pub stroke: Option<StrokeStyle>,
}

/// Line object (two points)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub start: Point,
    pub end: Point,
    pub stroke: StrokeStyle,
}

/// Polyline object (multiple connected points)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub points: Vec<Point>,
    pub closed: bool,
    pub fill: Option<FillStyle>,
    pub stroke: Option<StrokeStyle>,
}

/// Path object (SVG-like path commands)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    /// SVG path data string (e.g., "M 0 0 L 100 100 Q 50 50 0 100 Z")
    pub path_data: String,
    pub fill: Option<FillStyle>,
    pub stroke: Option<StrokeStyle>,
}

// =============================================================================
// TEXT OBJECT
// =============================================================================

/// Text alignment
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign {
    Left,
    Center,
    Right,
    Justify,
}

/// Text vertical alignment
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TextVerticalAlign {
    Top,
    Middle,
    Bottom,
}

/// Text object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub content: String,
    pub width: f64,
    pub height: f64,

    // Typography
    pub font_family: String,
    pub font_size: f64,
    pub font_weight: u16,  // 100-900
    pub font_style: FontStyle,
    pub line_height: f64,
    pub letter_spacing: f64,

    // Alignment
    pub text_align: TextAlign,
    pub vertical_align: TextVerticalAlign,

    // Styling
    pub fill: Color,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FontStyle {
    Normal,
    Italic,
}

// =============================================================================
// IMAGE OBJECT
// =============================================================================

/// Image object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    pub width: f64,
    pub height: f64,

    /// Image source URL or data URI
    pub src: String,

    /// Original image dimensions (for aspect ratio)
    pub original_width: f64,
    pub original_height: f64,

    /// Crop region (normalized 0-1)
    pub crop: Option<ImageCrop>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageCrop {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

// =============================================================================
// GROUP OBJECT
// =============================================================================

/// Group object (container for other objects)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupObject {
    #[serde(flatten)]
    pub base: BaseObjectProperties,

    /// Child object IDs (order matters for z-index within group)
    pub children: Vec<ObjectId>,

    /// Whether the group clips its children
    pub clip_content: bool,
}

// =============================================================================
// AUTOMERGE HELPERS
// =============================================================================

/// Path constants for accessing document fields in Automerge
pub mod paths {
    pub const METADATA: &str = "metadata";
    pub const PAGES: &str = "pages";
    pub const OBJECTS: &str = "objects";
    pub const PAGE_OBJECTS: &str = "pageObjects";
}

/// Generate a new ULID-style object ID
pub fn generate_object_id() -> ObjectId {
    use std::time::{SystemTime, UNIX_EPOCH};

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let random: u64 = rand::random();

    format!("{:012x}{:016x}", timestamp, random)
}

/// Generate a fractional z-index between two existing indices
pub fn generate_z_index_between(before: Option<&str>, after: Option<&str>) -> ZIndex {
    // Simplified fractional indexing
    // In production, use a proper library like fractional-indexing
    match (before, after) {
        (None, None) => "a0".to_string(),
        (None, Some(a)) => {
            // Insert before 'a'
            let mut chars: Vec<char> = a.chars().collect();
            if let Some(last) = chars.last_mut() {
                if *last > 'A' {
                    *last = (*last as u8 - 1) as char;
                } else {
                    chars.push('V');
                }
            }
            chars.into_iter().collect()
        }
        (Some(b), None) => {
            // Insert after 'b'
            let mut chars: Vec<char> = b.chars().collect();
            if let Some(last) = chars.last_mut() {
                if *last < 'z' {
                    *last = (*last as u8 + 1) as char;
                } else {
                    chars.push('0');
                }
            }
            chars.into_iter().collect()
        }
        (Some(b), Some(a)) => {
            // Insert between 'b' and 'a'
            format!("{}V", b)
        }
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transform_identity() {
        let t = Transform::IDENTITY;
        assert_eq!(t.a, 1.0);
        assert_eq!(t.d, 1.0);
        assert_eq!(t.tx, 0.0);
        assert_eq!(t.ty, 0.0);
    }

    #[test]
    fn test_generate_object_id() {
        let id1 = generate_object_id();
        let id2 = generate_object_id();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 28);
    }

    #[test]
    fn test_z_index_generation() {
        let first = generate_z_index_between(None, None);
        assert_eq!(first, "a0");

        let after = generate_z_index_between(Some("a0"), None);
        assert!(after > "a0");

        let before = generate_z_index_between(None, Some("a0"));
        assert!(before < "a0");
    }
}
