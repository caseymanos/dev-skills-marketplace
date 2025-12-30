//! ECS Components for canvas objects.

use bevy_ecs::prelude::*;
use canvas_schema::{
    Color, FillStyle, ObjectId, Point, StrokeStyle, Transform,
};

/// Unique identifier for a canvas object
#[derive(Component, Debug, Clone)]
pub struct ObjectIdComponent(pub ObjectId);

/// Transform component with local and world transforms
#[derive(Component, Debug, Clone, Copy)]
pub struct TransformComponent {
    pub local: Transform,
    pub world: Transform,
}

impl Default for TransformComponent {
    fn default() -> Self {
        Self {
            local: Transform::IDENTITY,
            world: Transform::IDENTITY,
        }
    }
}

/// Z-index for render ordering (fractional indexing string)
#[derive(Component, Debug, Clone)]
pub struct ZIndexComponent(pub String);

impl Default for ZIndexComponent {
    fn default() -> Self {
        Self("Zz".to_string())
    }
}

/// Visibility and lock state
#[derive(Component, Debug, Clone, Copy)]
pub struct VisibilityComponent {
    pub visible: bool,
    pub locked: bool,
}

impl Default for VisibilityComponent {
    fn default() -> Self {
        Self {
            visible: true,
            locked: false,
        }
    }
}

/// Marker component for shape type
#[derive(Component, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShapeType {
    Rectangle,
    Ellipse,
    Line,
    Polyline,
    Path,
    Text,
    Image,
    Group,
}

/// Rectangle-specific properties
#[derive(Component, Debug, Clone, Copy)]
pub struct RectangleComponent {
    pub width: f64,
    pub height: f64,
    pub corner_radius: [f64; 4],
}

/// Ellipse-specific properties
#[derive(Component, Debug, Clone, Copy)]
pub struct EllipseComponent {
    pub radius_x: f64,
    pub radius_y: f64,
}

/// Line-specific properties
#[derive(Component, Debug, Clone, Copy)]
pub struct LineComponent {
    pub start: Point,
    pub end: Point,
}

/// Polyline-specific properties
#[derive(Component, Debug, Clone)]
pub struct PolylineComponent {
    pub points: Vec<Point>,
    pub closed: bool,
}

/// Path-specific properties
#[derive(Component, Debug, Clone)]
pub struct PathComponent {
    pub path_data: String,
}

/// Text-specific properties
#[derive(Component, Debug, Clone)]
pub struct TextComponent {
    pub content: String,
    pub width: f64,
    pub height: f64,
    pub font_family: String,
    pub font_size: f64,
    pub font_weight: u16,
    pub fill: Color,
}

/// Image-specific properties
#[derive(Component, Debug, Clone)]
pub struct ImageComponent {
    pub src: String,
    pub width: f64,
    pub height: f64,
}

/// Group-specific properties
#[derive(Component, Debug, Clone)]
pub struct GroupComponent {
    pub children: Vec<ObjectId>,
    pub clip_content: bool,
}

/// Fill style component
#[derive(Component, Debug, Clone)]
pub struct FillComponent(pub FillStyle);

/// Stroke style component
#[derive(Component, Debug, Clone)]
pub struct StrokeComponent(pub StrokeStyle);

/// Parent entity reference for hierarchical transforms
#[derive(Component, Debug, Clone, Copy)]
pub struct ParentComponent(pub Entity);

/// Children entities for hierarchical transforms
#[derive(Component, Debug, Clone, Default)]
pub struct ChildrenComponent(pub Vec<Entity>);

/// Marks an entity as needing its world transform recalculated
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct DirtyTransform;

/// Bounding box in local space
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct LocalBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Bounding box in world space (computed)
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct WorldBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Marker for entities that need to be rendered
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct Renderable;

/// Selection state
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct Selected;

/// Hover state
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct Hovered;
