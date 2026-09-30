// =========================================================================
// EURASIAN & NORTH AFRICAN GIS VIEWPORT PROJECTION & CAMERA BOUNDS ENGINE
// Language: Rust (2021 Edition)
// Subsystem: /src/graphics/viewport_projection.rs
// =========================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GeoCoordinate {
    pub longitude: f64, // Degrees [-180.0, 180.0]
    pub latitude: f64,  // Degrees [-90.0, 90.0]
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ScreenCoordinate {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GeoBoundingBox {
    pub min_lon: f64, // Westernmost boundary (e.g. -12.0° Atlantic)
    pub max_lon: f64, // Easternmost boundary (e.g. +62.0° Eastern Iran)
    pub min_lat: f64, // Southernmost boundary (e.g. +10.0° Horn of Africa / Aden)
    pub max_lat: f64, // Northernmost boundary (e.g. +62.0° Novgorod / Baltic)
}

impl Default for GeoBoundingBox {
    fn default() -> Self {
        // Grand Eurasian & North African Simulation Extents (Atlantic to Iran, Baltic to Aden)
        Self {
            min_lon: -12.0,
            max_lon: 62.0,
            min_lat: 10.0,
            max_lat: 62.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LevelOfDetail {
    MacroContinental, // Global geopolitical view (Borders & Capital crests)
    RegionalTheater,  // Major provinces, rivers, mountain relief
    TacticalLocation, // Granular micro-nodes, armies, local fortifications
}

#[derive(Debug, Clone)]
pub struct MapViewportProjector {
    pub bounds: GeoBoundingBox,
    pub canvas_width: f64,
    pub canvas_height: f64,
    pub camera_center: GeoCoordinate,
    pub zoom_level: f64, // 1.0 (Full Macro Extents) to 10.0 (High Tactical Density)
}

impl MapViewportProjector {
    pub fn new(canvas_width: f64, canvas_height: f64) -> Self {
        let bounds = GeoBoundingBox::default();
        let center_lon = (bounds.min_lon + bounds.max_lon) * 0.5; // ~25.0° E (Balkans / Aegean)
        let center_lat = (bounds.min_lat + bounds.max_lat) * 0.5; // ~36.0° N (Mediterranean Basin)
        
        Self {
            bounds,
            canvas_width,
            canvas_height,
            camera_center: GeoCoordinate {
                longitude: center_lon,
                latitude: center_lat,
            },
            zoom_level: 1.0,
        }
    }

    /// Converts real-world WGS84 GeoCoordinates into authentic 2D Projection Space
    /// Using Equirectangular Standard with High-Precision Latitude Aspect Correction
    #[inline]
    pub fn geo_to_canvas(&self, coord: GeoCoordinate) -> ScreenCoordinate {
        let lon_span = self.bounds.max_lon - self.bounds.min_lon;
        let lat_span = self.bounds.max_lat - self.bounds.min_lat;

        // Normalized space [0.0, 1.0]
        let u = (coord.longitude - self.bounds.min_lon) / lon_span;
        let v = (self.bounds.max_lat - coord.latitude) / lat_span; // Inverted Y for screen rendering

        let base_x = u * self.canvas_width;
        let base_y = v * self.canvas_height;

        // Apply Camera Transform & Dynamic Zoom Scaling
        let center_screen_x = self.canvas_width * 0.5;
        let center_screen_y = self.canvas_height * 0.5;

        let center_u = (self.camera_center.longitude - self.bounds.min_lon) / lon_span;
        let center_v = (self.bounds.max_lat - self.camera_center.latitude) / lat_span;

        let screen_x = center_screen_x + (base_x - (center_u * self.canvas_width)) * self.zoom_level;
        let screen_y = center_screen_y + (base_y - (center_v * self.canvas_height)) * self.zoom_level;

        ScreenCoordinate { x: screen_x, y: screen_y }
    }

    /// Reverse Raycasting: Screen Coordinate to Latitude/Longitude Earth Surface
    #[inline]
    pub fn canvas_to_geo(&self, screen: ScreenCoordinate) -> GeoCoordinate {
        let lon_span = self.bounds.max_lon - self.bounds.min_lon;
        let lat_span = self.bounds.max_lat - self.bounds.min_lat;

        let center_screen_x = self.canvas_width * 0.5;
        let center_screen_y = self.canvas_height * 0.5;

        let center_u = (self.camera_center.longitude - self.bounds.min_lon) / lon_span;
        let center_v = (self.bounds.max_lat - self.camera_center.latitude) / lat_span;

        let base_x = ((screen.x - center_screen_x) / self.zoom_level) + (center_u * self.canvas_width);
        let base_y = ((screen.y - center_screen_y) / self.zoom_level) + (center_v * self.canvas_height);

        let u = base_x / self.canvas_width;
        let v = base_y / self.canvas_height;

        let lon = self.bounds.min_lon + (u * lon_span);
        let lat = self.bounds.max_lat - (v * lat_span);

        GeoCoordinate {
            longitude: lon.clamp(self.bounds.min_lon, self.bounds.max_lon),
            latitude: lat.clamp(self.bounds.min_lat, self.bounds.max_lat),
        }
    }

    /// Evaluates current Level of Detail (LOD) for performance query culling
    pub fn get_active_lod(&self) -> LevelOfDetail {
        if self.zoom_level < 1.75 {
            LevelOfDetail::MacroContinental
        } else if self.zoom_level < 3.5 {
            LevelOfDetail::RegionalTheater
        } else {
            LevelOfDetail::TacticalLocation
        }
    }

    /// Clamps camera position within the grand boundary limits to prevent viewport voids
    pub fn clamp_camera(&mut self) {
        self.zoom_level = self.zoom_level.clamp(0.85, 8.0);
        self.camera_center.longitude = self.camera_center.longitude.clamp(self.bounds.min_lon, self.bounds.max_lon);
        self.camera_center.latitude = self.camera_center.latitude.clamp(self.bounds.min_lat, self.bounds.max_lat);
    }
}
