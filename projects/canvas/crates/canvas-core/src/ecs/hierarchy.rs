//! Hierarchical scene graph operations for ECS entities.

use bevy_ecs::prelude::*;
use canvas_schema::Transform;
use super::components::*;

/// Set parent-child relationship between entities
pub fn set_parent(world: &mut World, child: Entity, parent: Entity) {
    // Remove from old parent if exists
    if let Ok(entity_ref) = world.get_entity(child) {
        if let Some(old_parent_comp) = entity_ref.get::<ParentComponent>() {
            let old_parent = old_parent_comp.0;
            if let Ok(mut old_parent_mut) = world.get_entity_mut(old_parent) {
                if let Some(mut children) = old_parent_mut.get_mut::<ChildrenComponent>() {
                    children.0.retain(|&c| c != child);
                }
            }
        }
    }

    // Set new parent on child
    if let Ok(mut child_mut) = world.get_entity_mut(child) {
        child_mut.insert(ParentComponent(parent));
        child_mut.insert(DirtyTransform);
    }

    // Add child to new parent's children list
    if let Ok(mut parent_mut) = world.get_entity_mut(parent) {
        if let Some(mut children) = parent_mut.get_mut::<ChildrenComponent>() {
            if !children.0.contains(&child) {
                children.0.push(child);
            }
        } else {
            parent_mut.insert(ChildrenComponent(vec![child]));
        }
    }
}

/// Remove parent from entity (make it a root)
pub fn remove_parent(world: &mut World, child: Entity) {
    // Get old parent
    let old_parent = {
        if let Ok(entity_ref) = world.get_entity(child) {
            entity_ref.get::<ParentComponent>().map(|p| p.0)
        } else {
            None
        }
    };

    // Remove from old parent's children
    if let Some(parent) = old_parent {
        if let Ok(mut parent_mut) = world.get_entity_mut(parent) {
            if let Some(mut children) = parent_mut.get_mut::<ChildrenComponent>() {
                children.0.retain(|&c| c != child);
            }
        }
    }

    // Remove parent component from child
    if let Ok(mut child_mut) = world.get_entity_mut(child) {
        child_mut.remove::<ParentComponent>();
        child_mut.insert(DirtyTransform);
    }
}

/// Get all root entities (entities without parents)
pub fn get_roots(world: &mut World) -> Vec<Entity> {
    let mut query = world.query_filtered::<Entity, (With<Renderable>, Without<ParentComponent>)>();
    query.iter(world).collect()
}

/// Get children of an entity
pub fn get_children(world: &World, parent: Entity) -> Vec<Entity> {
    if let Ok(entity_ref) = world.get_entity(parent) {
        if let Some(children) = entity_ref.get::<ChildrenComponent>() {
            return children.0.clone();
        }
    }
    Vec::new()
}

/// Get parent of an entity
pub fn get_parent(world: &World, child: Entity) -> Option<Entity> {
    if let Ok(entity_ref) = world.get_entity(child) {
        entity_ref.get::<ParentComponent>().map(|p| p.0)
    } else {
        None
    }
}

/// Get all ancestors of an entity (parent, grandparent, etc.)
pub fn get_ancestors(world: &World, entity: Entity) -> Vec<Entity> {
    let mut ancestors = Vec::new();
    let mut current = entity;

    while let Some(parent) = get_parent(world, current) {
        ancestors.push(parent);
        current = parent;
    }

    ancestors
}

/// Get all descendants of an entity (children, grandchildren, etc.)
pub fn get_descendants(world: &World, entity: Entity) -> Vec<Entity> {
    let mut descendants = Vec::new();
    let mut stack = get_children(world, entity);

    while let Some(child) = stack.pop() {
        descendants.push(child);
        stack.extend(get_children(world, child));
    }

    descendants
}

/// Propagate transforms from parents to children
/// Call this after modifying any transforms
pub fn propagate_transforms(world: &mut World) {
    // Get all root entities
    let roots = get_roots(world);

    // Process each root and its descendants
    for root in roots {
        propagate_transform_recursive(world, root, Transform::IDENTITY);
    }
}

fn propagate_transform_recursive(world: &mut World, entity: Entity, parent_world_transform: Transform) {
    // Get local transform and compute world transform
    let (world_transform, children) = {
        let Ok(entity_ref) = world.get_entity(entity) else {
            return;
        };

        let local_transform = entity_ref
            .get::<TransformComponent>()
            .map(|t| t.local)
            .unwrap_or(Transform::IDENTITY);

        let world_transform = parent_world_transform.multiply(&local_transform);

        let children = entity_ref
            .get::<ChildrenComponent>()
            .map(|c| c.0.clone())
            .unwrap_or_default();

        (world_transform, children)
    };

    // Update entity's world transform
    if let Ok(mut entity_mut) = world.get_entity_mut(entity) {
        if let Some(mut transform) = entity_mut.get_mut::<TransformComponent>() {
            transform.world = world_transform;
        }
        entity_mut.remove::<DirtyTransform>();

        // Update world bounds based on local bounds and world transform
        if let Some(local_bounds) = entity_mut.get::<LocalBounds>().copied() {
            let world_bounds = WorldBounds {
                x: local_bounds.x + world_transform.tx,
                y: local_bounds.y + world_transform.ty,
                width: local_bounds.width,
                height: local_bounds.height,
            };
            entity_mut.insert(world_bounds);
        }
    }

    // Recursively update children
    for child in children {
        propagate_transform_recursive(world, child, world_transform);
    }
}

/// Mark an entity and all its descendants as needing transform update
pub fn mark_transform_dirty(world: &mut World, entity: Entity) {
    if let Ok(mut entity_mut) = world.get_entity_mut(entity) {
        entity_mut.insert(DirtyTransform);
    }

    // Mark all descendants dirty
    let descendants = get_descendants(world, entity);
    for desc in descendants {
        if let Ok(mut entity_mut) = world.get_entity_mut(desc) {
            entity_mut.insert(DirtyTransform);
        }
    }
}

/// Reparent an entity to a new parent, preserving world position
pub fn reparent_preserve_world(world: &mut World, child: Entity, new_parent: Option<Entity>) {
    // Get current world transform
    let world_transform = {
        if let Ok(entity_ref) = world.get_entity(child) {
            entity_ref
                .get::<TransformComponent>()
                .map(|t| t.world)
                .unwrap_or(Transform::IDENTITY)
        } else {
            return;
        }
    };

    // Get new parent's world transform
    let parent_world = if let Some(parent) = new_parent {
        if let Ok(entity_ref) = world.get_entity(parent) {
            entity_ref
                .get::<TransformComponent>()
                .map(|t| t.world)
                .unwrap_or(Transform::IDENTITY)
        } else {
            Transform::IDENTITY
        }
    } else {
        Transform::IDENTITY
    };

    // Calculate new local transform to preserve world position
    let parent_inverse = parent_world.inverse();
    let new_local = parent_inverse.multiply(&world_transform);

    // Set new parent
    if let Some(parent) = new_parent {
        set_parent(world, child, parent);
    } else {
        remove_parent(world, child);
    }

    // Update local transform
    if let Ok(mut entity_mut) = world.get_entity_mut(child) {
        if let Some(mut transform) = entity_mut.get_mut::<TransformComponent>() {
            transform.local = new_local;
        }
    }

    // Propagate transforms
    propagate_transforms(world);
}

/// Get the depth of an entity in the hierarchy (0 for roots)
pub fn get_depth(world: &World, entity: Entity) -> usize {
    get_ancestors(world, entity).len()
}

/// Check if an entity is an ancestor of another
pub fn is_ancestor_of(world: &World, potential_ancestor: Entity, entity: Entity) -> bool {
    get_ancestors(world, entity).contains(&potential_ancestor)
}

/// Check if an entity is a descendant of another
pub fn is_descendant_of(world: &World, potential_descendant: Entity, entity: Entity) -> bool {
    is_ancestor_of(world, entity, potential_descendant)
}
