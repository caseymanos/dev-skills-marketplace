//! Utility functions for ID generation and fractional indexing.

use crate::types::*;

pub fn generate_object_id() -> ObjectId {
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let random: u64 = rand::random();
    format!("obj-{:012x}{:08x}", timestamp, random as u32)
}

pub fn generate_page_id() -> PageId {
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let random: u64 = rand::random();
    format!("page-{:012x}{:08x}", timestamp, random as u32)
}

pub fn generate_document_id() -> DocumentId {
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let random: u64 = rand::random();
    format!("doc-{:012x}{:08x}", timestamp, random as u32)
}

/// Generate a fractional z-index between two existing indices using base-62.
pub fn generate_z_index_between(before: Option<&str>, after: Option<&str>) -> ZIndex {
    const CHARS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    fn char_index(c: char) -> Option<usize> { CHARS.iter().position(|&ch| ch as char == c) }
    fn index_char(i: usize) -> char { CHARS[i.min(CHARS.len() - 1)] as char }

    match (before, after) {
        (None, None) => "Zz".to_string(),
        (None, Some(a)) => format!("0{}", a),
        (Some(b), None) => format!("{}z", b),
        (Some(b), Some(_a)) => {
            let b_chars: Vec<char> = b.chars().collect();
            let mid_char = index_char(CHARS.len() / 2);
            let mut result: String = b_chars.iter().collect();
            result.push(mid_char);
            result
        }
    }
}

pub fn generate_z_index_after(current: Option<&str>) -> ZIndex { generate_z_index_between(current, None) }
pub fn generate_z_index_before(current: Option<&str>) -> ZIndex { generate_z_index_between(None, current) }
