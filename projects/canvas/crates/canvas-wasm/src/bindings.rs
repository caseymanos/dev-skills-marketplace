//! WASM bindings for the canvas engine.

use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use js_sys::{Array, Object, Reflect};
use canvas_core::{CanvasEngine, EngineOptions, RenderBackend};

#[wasm_bindgen]
pub struct WasmCanvasEngine {
    engine: CanvasEngine,
}

#[wasm_bindgen]
impl WasmCanvasEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            engine: CanvasEngine::new(EngineOptions::default()),
        }
    }

    #[wasm_bindgen]
    pub async fn init(&mut self, canvas: HtmlCanvasElement, _options: JsValue) -> Result<(), JsValue> {
        self.engine
            .init(canvas)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn destroy(&mut self) {}

    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        self.engine.resize(width, height);
    }

    #[wasm_bindgen]
    pub fn render(&mut self) -> JsValue {
        let stats = self.engine.render();
        let obj = Object::new();
        Reflect::set(&obj, &"frameTime".into(), &JsValue::from_f64(stats.frame_time)).ok();
        Reflect::set(&obj, &"drawCalls".into(), &JsValue::from_f64(stats.draw_calls as f64)).ok();
        Reflect::set(&obj, &"objectsRendered".into(), &JsValue::from_f64(stats.objects_rendered as f64)).ok();
        Reflect::set(&obj, &"objectsCulled".into(), &JsValue::from_f64(stats.objects_culled as f64)).ok();
        obj.into()
    }

    #[wasm_bindgen(js_name = requestRender)]
    pub fn request_render(&mut self) {
        self.engine.request_render();
    }

    #[wasm_bindgen(js_name = needsRender)]
    pub fn needs_render(&self) -> bool {
        self.engine.needs_render()
    }

    #[wasm_bindgen(js_name = handleEvent)]
    pub fn handle_event(&mut self, event: JsValue) -> bool {
        parse_input_event(&event)
            .map(|e| self.engine.handle_event(e))
            .unwrap_or(false)
    }

    #[wasm_bindgen(js_name = setTool)]
    pub fn set_tool(&mut self, tool: &str) {
        let tool_type = match tool {
            "select" => canvas_core::ToolType::Select,
            "pan" => canvas_core::ToolType::Pan,
            "rectangle" => canvas_core::ToolType::Rectangle,
            "ellipse" => canvas_core::ToolType::Ellipse,
            "line" => canvas_core::ToolType::Line,
            "pen" => canvas_core::ToolType::Pen,
            "text" => canvas_core::ToolType::Text,
            _ => canvas_core::ToolType::Select,
        };
        self.engine.set_tool(tool_type);
    }

    #[wasm_bindgen(js_name = getTool)]
    pub fn get_tool(&self) -> String {
        match self.engine.get_tool() {
            canvas_core::ToolType::Select => "select",
            canvas_core::ToolType::Pan => "pan",
            canvas_core::ToolType::Rectangle => "rectangle",
            canvas_core::ToolType::Ellipse => "ellipse",
            canvas_core::ToolType::Line => "line",
            canvas_core::ToolType::Pen => "pen",
            canvas_core::ToolType::Text => "text",
        }
        .to_string()
    }

    #[wasm_bindgen(js_name = getCamera)]
    pub fn get_camera(&self) -> JsValue {
        let camera = self.engine.get_camera();
        let obj = Object::new();
        Reflect::set(&obj, &"x".into(), &JsValue::from_f64(camera.x)).ok();
        Reflect::set(&obj, &"y".into(), &JsValue::from_f64(camera.y)).ok();
        Reflect::set(&obj, &"zoom".into(), &JsValue::from_f64(camera.zoom)).ok();
        obj.into()
    }

    #[wasm_bindgen(js_name = setCamera)]
    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.engine.set_camera(x, y, zoom);
    }

    #[wasm_bindgen(js_name = panBy)]
    pub fn pan_by(&mut self, dx: f64, dy: f64) {
        self.engine.pan_by(dx, dy);
    }

    #[wasm_bindgen(js_name = zoomTo)]
    pub fn zoom_to(&mut self, zoom: f64, center_x: f64, center_y: f64) {
        self.engine.zoom_to(zoom, center_x, center_y);
    }

    #[wasm_bindgen(js_name = screenToCanvas)]
    pub fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> JsValue {
        let point = self.engine.screen_to_canvas(screen_x, screen_y);
        let obj = Object::new();
        Reflect::set(&obj, &"x".into(), &JsValue::from_f64(point.x)).ok();
        Reflect::set(&obj, &"y".into(), &JsValue::from_f64(point.y)).ok();
        obj.into()
    }

    #[wasm_bindgen(js_name = canvasToScreen)]
    pub fn canvas_to_screen(&self, canvas_x: f64, canvas_y: f64) -> JsValue {
        let point = self.engine.canvas_to_screen(canvas_x, canvas_y);
        let obj = Object::new();
        Reflect::set(&obj, &"x".into(), &JsValue::from_f64(point.x)).ok();
        Reflect::set(&obj, &"y".into(), &JsValue::from_f64(point.y)).ok();
        obj.into()
    }

    #[wasm_bindgen(js_name = getSelection)]
    pub fn get_selection(&self) -> JsValue {
        let selection = self.engine.get_selection();
        let obj = Object::new();
        let ids = Array::new();
        for id in &selection.selected_ids {
            ids.push(&JsValue::from_str(id));
        }
        Reflect::set(&obj, &"selectedIds".into(), &ids).ok();
        Reflect::set(&obj, &"bounds".into(), &JsValue::NULL).ok();
        obj.into()
    }

    #[wasm_bindgen(js_name = setSelection)]
    pub fn set_selection(&mut self, ids: &JsValue) {
        if let Some(arr) = ids.dyn_ref::<Array>() {
            let ids: Vec<String> = arr.iter().filter_map(|v| v.as_string()).collect();
            self.engine.set_selection(ids);
        }
    }

    #[wasm_bindgen(js_name = clearSelection)]
    pub fn clear_selection(&mut self) {
        self.engine.clear_selection();
    }
}

impl Default for WasmCanvasEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn parse_input_event(event: &JsValue) -> Option<canvas_core::InputEvent> {
    let obj = event.dyn_ref::<Object>()?;
    let event_type = Reflect::get(obj, &"type".into()).ok()?.as_string()?;
    let get_f64 =
        |key: &str| Reflect::get(obj, &key.into()).ok().and_then(|v| v.as_f64()).unwrap_or(0.0);
    let get_modifiers = || {
        Reflect::get(obj, &"modifiers".into())
            .ok()
            .and_then(|m| {
                m.dyn_ref::<Object>().map(|mo| canvas_core::Modifiers {
                    shift: Reflect::get(mo, &"shift".into())
                        .ok()
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    ctrl: Reflect::get(mo, &"ctrl".into())
                        .ok()
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    alt: Reflect::get(mo, &"alt".into())
                        .ok()
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    meta: Reflect::get(mo, &"meta".into())
                        .ok()
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                })
            })
            .unwrap_or_default()
    };

    match event_type.as_str() {
        "pointerdown" => Some(canvas_core::InputEvent::PointerDown {
            canvas_x: get_f64("canvasX"),
            canvas_y: get_f64("canvasY"),
            screen_x: get_f64("screenX"),
            screen_y: get_f64("screenY"),
            button: get_f64("button") as u8,
            buttons: get_f64("buttons") as u8,
            modifiers: get_modifiers(),
            pressure: get_f64("pressure") as f32,
            pointer_id: get_f64("pointerId") as i32,
        }),
        "pointermove" => Some(canvas_core::InputEvent::PointerMove {
            canvas_x: get_f64("canvasX"),
            canvas_y: get_f64("canvasY"),
            screen_x: get_f64("screenX"),
            screen_y: get_f64("screenY"),
            button: get_f64("button") as u8,
            buttons: get_f64("buttons") as u8,
            modifiers: get_modifiers(),
            pressure: get_f64("pressure") as f32,
            pointer_id: get_f64("pointerId") as i32,
        }),
        "pointerup" => Some(canvas_core::InputEvent::PointerUp {
            canvas_x: get_f64("canvasX"),
            canvas_y: get_f64("canvasY"),
            screen_x: get_f64("screenX"),
            screen_y: get_f64("screenY"),
            button: get_f64("button") as u8,
            buttons: get_f64("buttons") as u8,
            modifiers: get_modifiers(),
            pressure: get_f64("pressure") as f32,
            pointer_id: get_f64("pointerId") as i32,
        }),
        "wheel" => Some(canvas_core::InputEvent::Wheel {
            canvas_x: get_f64("canvasX"),
            canvas_y: get_f64("canvasY"),
            screen_x: get_f64("screenX"),
            screen_y: get_f64("screenY"),
            delta_x: get_f64("deltaX"),
            delta_y: get_f64("deltaY"),
            delta_z: get_f64("deltaZ"),
            modifiers: get_modifiers(),
        }),
        "keydown" => Some(canvas_core::InputEvent::KeyDown {
            key: Reflect::get(obj, &"key".into())
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_default(),
            code: Reflect::get(obj, &"code".into())
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_default(),
            modifiers: get_modifiers(),
        }),
        "keyup" => Some(canvas_core::InputEvent::KeyUp {
            key: Reflect::get(obj, &"key".into())
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_default(),
            code: Reflect::get(obj, &"code".into())
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_default(),
            modifiers: get_modifiers(),
        }),
        _ => None,
    }
}
