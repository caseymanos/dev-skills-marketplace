//! Input event types for canvas interaction.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Modifiers { pub shift: bool, pub ctrl: bool, pub alt: bool, pub meta: bool }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InputEvent {
    PointerDown { canvas_x: f64, canvas_y: f64, screen_x: f64, screen_y: f64, button: u8, buttons: u8, modifiers: Modifiers, pressure: f32, pointer_id: i32 },
    PointerMove { canvas_x: f64, canvas_y: f64, screen_x: f64, screen_y: f64, button: u8, buttons: u8, modifiers: Modifiers, pressure: f32, pointer_id: i32 },
    PointerUp { canvas_x: f64, canvas_y: f64, screen_x: f64, screen_y: f64, button: u8, buttons: u8, modifiers: Modifiers, pressure: f32, pointer_id: i32 },
    Wheel { canvas_x: f64, canvas_y: f64, screen_x: f64, screen_y: f64, delta_x: f64, delta_y: f64, delta_z: f64, modifiers: Modifiers },
    KeyDown { key: String, code: String, modifiers: Modifiers },
    KeyUp { key: String, code: String, modifiers: Modifiers },
}

impl InputEvent {
    pub fn modifiers(&self) -> Modifiers {
        match self { InputEvent::PointerDown { modifiers, .. } | InputEvent::PointerMove { modifiers, .. } | InputEvent::PointerUp { modifiers, .. } | InputEvent::Wheel { modifiers, .. } | InputEvent::KeyDown { modifiers, .. } | InputEvent::KeyUp { modifiers, .. } => *modifiers }
    }
}
