//! Canvas object types and their properties.

use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanvasObject {
    #[serde(rename = "rectangle")] Rectangle(RectangleObject),
    #[serde(rename = "ellipse")] Ellipse(EllipseObject),
    #[serde(rename = "line")] Line(LineObject),
    #[serde(rename = "polyline")] Polyline(PolylineObject),
    #[serde(rename = "path")] Path(PathObject),
    #[serde(rename = "text")] Text(TextObject),
    #[serde(rename = "image")] Image(ImageObject),
    #[serde(rename = "group")] Group(GroupObject),
}

impl CanvasObject {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseObjectProperties {
    pub id: ObjectId,
    pub page_id: PageId,
    pub parent_id: Option<ObjectId>,
    pub transform: Transform,
    pub z_index: ZIndex,
    pub visible: bool,
    pub locked: bool,
    pub name: Option<String>,
}

impl BaseObjectProperties {
    pub fn new(id: ObjectId, page_id: PageId) -> Self {
        Self { id, page_id, parent_id: None, transform: Transform::IDENTITY, z_index: "Zz".to_string(), visible: true, locked: false, name: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeStyle {
    pub color: Color,
    pub width: f64,
    pub cap: StrokeCap,
    pub join: StrokeJoin,
    pub dash_array: Option<Vec<f64>>,
    pub dash_offset: f64,
}

impl Default for StrokeStyle {
    fn default() -> Self { Self { color: Color::BLACK, width: 1.0, cap: StrokeCap::Butt, join: StrokeJoin::Miter, dash_array: None, dash_offset: 0.0 } }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum StrokeCap { #[default] Butt, Round, Square }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum StrokeJoin { #[default] Miter, Round, Bevel }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FillStyle {
    #[serde(rename = "solid")] Solid { color: Color },
    #[serde(rename = "linear_gradient")] LinearGradient { start: Point, end: Point, stops: Vec<GradientStop> },
    #[serde(rename = "radial_gradient")] RadialGradient { center: Point, radius: f64, stops: Vec<GradientStop> },
}

impl Default for FillStyle {
    fn default() -> Self { FillStyle::Solid { color: Color::WHITE } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GradientStop { pub offset: f64, pub color: Color }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RectangleObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub width: f64, pub height: f64, pub corner_radius: [f64; 4],
    pub fill: Option<FillStyle>, pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EllipseObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub radius_x: f64, pub radius_y: f64,
    pub fill: Option<FillStyle>, pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub start: Point, pub end: Point, pub stroke: StrokeStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub points: Vec<Point>, pub closed: bool,
    pub fill: Option<FillStyle>, pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub path_data: String,
    pub fill: Option<FillStyle>, pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign { #[default] Left, Center, Right, Justify }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TextVerticalAlign { #[default] Top, Middle, Bottom }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum FontStyle { #[default] Normal, Italic }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub content: String, pub width: f64, pub height: f64,
    pub font_family: String, pub font_size: f64, pub font_weight: u16, pub font_style: FontStyle,
    pub line_height: f64, pub letter_spacing: f64, pub text_align: TextAlign, pub vertical_align: TextVerticalAlign,
    pub fill: Color,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageCrop { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub width: f64, pub height: f64, pub src: String,
    pub original_width: f64, pub original_height: f64, pub crop: Option<ImageCrop>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupObject {
    #[serde(flatten)] pub base: BaseObjectProperties,
    pub children: Vec<ObjectId>, pub clip_content: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: PageId, pub name: String, pub background_color: Color, pub width: f64, pub height: f64,
}

impl Default for Page {
    fn default() -> Self { Self { id: String::new(), name: "Page 1".to_string(), background_color: Color::WHITE, width: 1920.0, height: 1080.0 } }
}
