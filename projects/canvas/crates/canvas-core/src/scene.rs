//! Scene Graph - hierarchical object management.

use std::collections::HashMap;
use canvas_schema::{ObjectId, Transform, BoundingBox, Point};

#[derive(Debug, Clone)]
pub struct SceneNode {
    pub id: ObjectId,
    pub parent: Option<ObjectId>,
    pub children: Vec<ObjectId>,
    pub local_transform: Transform,
    pub world_transform: Transform,
    pub local_bounds: BoundingBox,
    pub world_bounds: BoundingBox,
    pub z_index: String,
    pub visible: bool,
    dirty: bool,
}

impl SceneNode {
    pub fn new(id: ObjectId) -> Self {
        Self { id, parent: None, children: Vec::new(), local_transform: Transform::IDENTITY, world_transform: Transform::IDENTITY,
               local_bounds: BoundingBox::default(), world_bounds: BoundingBox::default(), z_index: "Zz".to_string(), visible: true, dirty: true }
    }
    pub fn mark_dirty(&mut self) { self.dirty = true; }
}

pub struct SceneGraph {
    nodes: HashMap<ObjectId, SceneNode>,
    roots: Vec<ObjectId>,
}

impl SceneGraph {
    pub fn new() -> Self { Self { nodes: HashMap::new(), roots: Vec::new() } }

    pub fn add_node(&mut self, id: ObjectId, parent: Option<&ObjectId>) -> &mut SceneNode {
        let mut node = SceneNode::new(id.clone());
        if let Some(parent_id) = parent {
            node.parent = Some(parent_id.clone());
            if let Some(parent_node) = self.nodes.get_mut(parent_id) { parent_node.children.push(id.clone()); }
        } else { self.roots.push(id.clone()); }
        self.nodes.insert(id.clone(), node);
        self.nodes.get_mut(&id).unwrap()
    }

    pub fn remove_node(&mut self, id: &ObjectId) -> Option<SceneNode> {
        if let Some(node) = self.nodes.remove(id) {
            if let Some(parent_id) = &node.parent {
                if let Some(parent) = self.nodes.get_mut(parent_id) { parent.children.retain(|child| child != id); }
            } else { self.roots.retain(|root| root != id); }
            for child_id in &node.children { self.remove_node(child_id); }
            Some(node)
        } else { None }
    }

    pub fn get_node(&self, id: &ObjectId) -> Option<&SceneNode> { self.nodes.get(id) }
    pub fn get_node_mut(&mut self, id: &ObjectId) -> Option<&mut SceneNode> { self.nodes.get_mut(id) }
    pub fn get_all_object_ids(&self) -> Vec<ObjectId> { self.nodes.keys().cloned().collect() }
    pub fn get_roots(&self) -> &[ObjectId] { &self.roots }

    pub fn update_transforms(&mut self) {
        let roots = self.roots.clone();
        for root_id in roots { self.update_node_transform(&root_id, &Transform::IDENTITY); }
    }

    fn update_node_transform(&mut self, id: &ObjectId, parent_transform: &Transform) {
        let (world_transform, children) = {
            let node = match self.nodes.get_mut(id) { Some(n) => n, None => return };
            node.world_transform = parent_transform.multiply(&node.local_transform);
            node.dirty = false;
            node.world_bounds = BoundingBox { x: node.local_bounds.x + node.world_transform.tx, y: node.local_bounds.y + node.world_transform.ty, width: node.local_bounds.width, height: node.local_bounds.height };
            (node.world_transform, node.children.clone())
        };
        for child_id in children { self.update_node_transform(&child_id, &world_transform); }
    }

    pub fn get_visible_in_bounds(&self, bounds: &BoundingBox) -> Vec<&SceneNode> {
        self.nodes.values().filter(|node| node.visible && bounds.intersects(&node.world_bounds)).collect()
    }

    pub fn get_render_order(&self) -> Vec<&SceneNode> {
        let mut nodes: Vec<_> = self.nodes.values().filter(|n| n.visible).collect();
        nodes.sort_by(|a, b| a.z_index.cmp(&b.z_index));
        nodes
    }

    pub fn hit_test(&self, point: Point) -> Option<&SceneNode> {
        let mut nodes: Vec<_> = self.nodes.values().filter(|n| n.visible).collect();
        nodes.sort_by(|a, b| b.z_index.cmp(&a.z_index));
        nodes.into_iter().find(|node| node.world_bounds.contains(point))
    }
}

impl Default for SceneGraph { fn default() -> Self { Self::new() } }
