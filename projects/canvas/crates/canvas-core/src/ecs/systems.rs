//! ECS Systems for canvas processing.

use bevy_ecs::prelude::*;
use super::components::*;

/// System to update world transforms based on hierarchy
pub fn update_transforms_system(
    mut query: Query<
        (&TransformComponent, &mut WorldBounds, &LocalBounds),
        With<DirtyTransform>,
    >,
) {
    for (transform, mut world_bounds, local_bounds) in query.iter_mut() {
        // Apply world transform to local bounds
        world_bounds.x = local_bounds.x + transform.world.tx;
        world_bounds.y = local_bounds.y + transform.world.ty;
        world_bounds.width = local_bounds.width;
        world_bounds.height = local_bounds.height;
    }
}

/// Query for visible renderable entities sorted by z-index
pub fn get_render_order(world: &mut World) -> Vec<(Entity, String)> {
    let mut query = world.query_filtered::<(Entity, &ZIndexComponent, &VisibilityComponent), With<Renderable>>();

    let mut entities: Vec<(Entity, String)> = query
        .iter(world)
        .filter(|(_, _, vis)| vis.visible)
        .map(|(entity, z, _)| (entity, z.0.clone()))
        .collect();

    // Sort by z-index (fractional indexing)
    entities.sort_by(|a, b| a.1.cmp(&b.1));
    entities
}

/// Query for entities within a bounding box
pub fn get_entities_in_bounds(
    world: &mut World,
    bounds_x: f64,
    bounds_y: f64,
    bounds_width: f64,
    bounds_height: f64,
) -> Vec<Entity> {
    let mut query = world.query_filtered::<(Entity, &WorldBounds, &VisibilityComponent), With<Renderable>>();

    query
        .iter(world)
        .filter(|(_, wb, vis)| {
            vis.visible
                && wb.x < bounds_x + bounds_width
                && wb.x + wb.width > bounds_x
                && wb.y < bounds_y + bounds_height
                && wb.y + wb.height > bounds_y
        })
        .map(|(entity, _, _)| entity)
        .collect()
}

/// Hit test - find topmost entity at a point
pub fn hit_test(world: &mut World, x: f64, y: f64) -> Option<Entity> {
    let mut query = world.query_filtered::<(Entity, &WorldBounds, &ZIndexComponent, &VisibilityComponent), With<Renderable>>();

    let mut hits: Vec<(Entity, String)> = query
        .iter(world)
        .filter(|(_, wb, _, vis)| {
            vis.visible
                && !vis.locked
                && x >= wb.x
                && x <= wb.x + wb.width
                && y >= wb.y
                && y <= wb.y + wb.height
        })
        .map(|(entity, _, z, _)| (entity, z.0.clone()))
        .collect();

    // Sort by z-index descending (topmost first)
    hits.sort_by(|a, b| b.1.cmp(&a.1));
    hits.first().map(|(entity, _)| *entity)
}

/// Query for selected entities
pub fn get_selected_entities(world: &mut World) -> Vec<Entity> {
    let mut query = world.query_filtered::<Entity, With<Selected>>();
    query.iter(world).collect()
}

/// Add selected marker to entity
pub fn select_entity(world: &mut World, entity: Entity) {
    if let Ok(mut entity_mut) = world.get_entity_mut(entity) {
        entity_mut.insert(Selected);
    }
}

/// Remove selected marker from entity
pub fn deselect_entity(world: &mut World, entity: Entity) {
    if let Ok(mut entity_mut) = world.get_entity_mut(entity) {
        entity_mut.remove::<Selected>();
    }
}

/// Clear all selections
pub fn clear_selection(world: &mut World) {
    let selected: Vec<Entity> = get_selected_entities(world);
    for entity in selected {
        deselect_entity(world, entity);
    }
}

/// Get rectangle data for rendering
pub fn get_rectangle_data(
    world: &World,
    entity: Entity,
) -> Option<(TransformComponent, RectangleComponent, Option<FillComponent>, Option<StrokeComponent>)> {
    let entity_ref = world.get_entity(entity).ok()?;

    let transform = entity_ref.get::<TransformComponent>()?.clone();
    let rect = entity_ref.get::<RectangleComponent>()?.clone();
    let fill = entity_ref.get::<FillComponent>().cloned();
    let stroke = entity_ref.get::<StrokeComponent>().cloned();

    Some((transform, rect, fill, stroke))
}

/// Get ellipse data for rendering
pub fn get_ellipse_data(
    world: &World,
    entity: Entity,
) -> Option<(TransformComponent, EllipseComponent, Option<FillComponent>, Option<StrokeComponent>)> {
    let entity_ref = world.get_entity(entity).ok()?;

    let transform = entity_ref.get::<TransformComponent>()?.clone();
    let ellipse = entity_ref.get::<EllipseComponent>()?.clone();
    let fill = entity_ref.get::<FillComponent>().cloned();
    let stroke = entity_ref.get::<StrokeComponent>().cloned();

    Some((transform, ellipse, fill, stroke))
}
