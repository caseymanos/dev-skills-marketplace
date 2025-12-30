//! ECS module - Entity Component System for canvas objects using bevy_ecs.

mod components;
mod systems;

pub use components::*;
pub use systems::*;

use bevy_ecs::prelude::*;
use canvas_schema::{ObjectId, CanvasObject};

/// Spawn a canvas object as an ECS entity
pub fn spawn_object(world: &mut World, object: CanvasObject) -> Entity {
    let base = object.base();

    // Create base entity with common components
    let mut entity_commands = world.spawn((
        ObjectIdComponent(base.id.clone()),
        TransformComponent {
            local: base.transform,
            world: base.transform,
        },
        ZIndexComponent(base.z_index.clone()),
        VisibilityComponent {
            visible: base.visible,
            locked: base.locked,
        },
    ));

    // Add type-specific components
    match object {
        CanvasObject::Rectangle(rect) => {
            entity_commands.insert((
                ShapeType::Rectangle,
                RectangleComponent {
                    width: rect.width,
                    height: rect.height,
                    corner_radius: rect.corner_radius,
                },
            ));
            if let Some(fill) = rect.fill {
                entity_commands.insert(FillComponent(fill));
            }
            if let Some(stroke) = rect.stroke {
                entity_commands.insert(StrokeComponent(stroke));
            }
        }
        CanvasObject::Ellipse(ellipse) => {
            entity_commands.insert((
                ShapeType::Ellipse,
                EllipseComponent {
                    radius_x: ellipse.radius_x,
                    radius_y: ellipse.radius_y,
                },
            ));
            if let Some(fill) = ellipse.fill {
                entity_commands.insert(FillComponent(fill));
            }
            if let Some(stroke) = ellipse.stroke {
                entity_commands.insert(StrokeComponent(stroke));
            }
        }
        CanvasObject::Line(line) => {
            entity_commands.insert((
                ShapeType::Line,
                LineComponent {
                    start: line.start,
                    end: line.end,
                },
                StrokeComponent(line.stroke),
            ));
        }
        CanvasObject::Polyline(polyline) => {
            entity_commands.insert((
                ShapeType::Polyline,
                PolylineComponent {
                    points: polyline.points,
                    closed: polyline.closed,
                },
            ));
            if let Some(fill) = polyline.fill {
                entity_commands.insert(FillComponent(fill));
            }
            if let Some(stroke) = polyline.stroke {
                entity_commands.insert(StrokeComponent(stroke));
            }
        }
        CanvasObject::Path(path) => {
            entity_commands.insert((
                ShapeType::Path,
                PathComponent {
                    path_data: path.path_data,
                },
            ));
            if let Some(fill) = path.fill {
                entity_commands.insert(FillComponent(fill));
            }
            if let Some(stroke) = path.stroke {
                entity_commands.insert(StrokeComponent(stroke));
            }
        }
        CanvasObject::Text(text) => {
            entity_commands.insert((
                ShapeType::Text,
                TextComponent {
                    content: text.content,
                    width: text.width,
                    height: text.height,
                    font_family: text.font_family,
                    font_size: text.font_size,
                    font_weight: text.font_weight,
                    fill: text.fill,
                },
            ));
        }
        CanvasObject::Image(image) => {
            entity_commands.insert((
                ShapeType::Image,
                ImageComponent {
                    src: image.src,
                    width: image.width,
                    height: image.height,
                },
            ));
        }
        CanvasObject::Group(group) => {
            entity_commands.insert((
                ShapeType::Group,
                GroupComponent {
                    children: group.children,
                    clip_content: group.clip_content,
                },
            ));
        }
    }

    entity_commands.id()
}

/// Despawn an entity and remove it from the world
pub fn despawn_object(world: &mut World, entity: Entity) {
    world.despawn(entity);
}

/// Find entity by ObjectId
pub fn find_entity_by_id(world: &mut World, id: &ObjectId) -> Option<Entity> {
    let mut query = world.query::<(Entity, &ObjectIdComponent)>();
    for (entity, obj_id) in query.iter(world) {
        if &obj_id.0 == id {
            return Some(entity);
        }
    }
    None
}
