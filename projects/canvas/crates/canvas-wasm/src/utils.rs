//! WASM utility functions

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_panic_hook() { console_error_panic_hook::set_once(); }

#[wasm_bindgen]
pub fn log(message: &str) { web_sys::console::log_1(&message.into()); }

#[wasm_bindgen]
pub fn now() -> f64 { web_sys::window().and_then(|w| w.performance()).map(|p| p.now()).unwrap_or(0.0) }

#[allow(dead_code)]
pub fn request_animation_frame(f: &Closure<dyn FnMut()>) {
    web_sys::window().expect("no window").request_animation_frame(f.as_ref().unchecked_ref()).expect("should register requestAnimationFrame");
}
