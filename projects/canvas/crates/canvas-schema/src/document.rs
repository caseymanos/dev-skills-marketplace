//! Canvas document structure for Automerge.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::objects::{CanvasObject, Page};
use crate::types::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasDocument {
    pub metadata: DocumentMetadata,
    pub pages: Vec<PageId>,
    pub page_data: HashMap<PageId, Page>,
    pub objects: HashMap<ObjectId, CanvasObject>,
    pub page_objects: HashMap<PageId, Vec<ObjectId>>,
}

impl CanvasDocument {
    pub fn new(id: DocumentId, title: String, created_by: UserId) -> Self {
        let page_id = crate::generate_page_id();
        let page = Page { id: page_id.clone(), name: "Page 1".to_string(), ..Default::default() };
        let now = format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs());

        Self {
            metadata: DocumentMetadata { id, title, created_at: now.clone(), updated_at: now, created_by, version: 1 },
            pages: vec![page_id.clone()],
            page_data: HashMap::from([(page_id.clone(), page)]),
            objects: HashMap::new(),
            page_objects: HashMap::from([(page_id, vec![])]),
        }
    }

    pub fn add_object(&mut self, object: CanvasObject) {
        let id = object.base().id.clone();
        let page_id = object.base().page_id.clone();
        self.objects.insert(id.clone(), object);
        if let Some(page_objects) = self.page_objects.get_mut(&page_id) {
            page_objects.push(id);
        }
        self.metadata.version += 1;
    }

    pub fn remove_object(&mut self, id: &ObjectId) -> Option<CanvasObject> {
        if let Some(object) = self.objects.remove(id) {
            let page_id = &object.base().page_id;
            if let Some(page_objects) = self.page_objects.get_mut(page_id) {
                page_objects.retain(|obj_id| obj_id != id);
            }
            self.metadata.version += 1;
            Some(object)
        } else { None }
    }

    pub fn get_object(&self, id: &ObjectId) -> Option<&CanvasObject> { self.objects.get(id) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub id: DocumentId,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub created_by: UserId,
    pub version: u64,
}

pub mod paths {
    pub const METADATA: &str = "metadata";
    pub const PAGES: &str = "pages";
    pub const OBJECTS: &str = "objects";
    pub const PAGE_OBJECTS: &str = "pageObjects";
}
