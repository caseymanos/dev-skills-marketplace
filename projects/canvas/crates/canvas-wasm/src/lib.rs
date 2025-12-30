//! Canvas WASM Bindings - WebAssembly interface for the canvas engine.

use wasm_bindgen::prelude::*;

mod bindings;
mod utils;

pub use bindings::*;

#[wasm_bindgen(start)]
pub fn main() { console_error_panic_hook::set_once(); }
