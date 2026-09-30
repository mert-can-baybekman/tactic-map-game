// =========================================================================
// GRAND STRATEGY EARTH COMPOSITOR: MULTI-LAYER FRAGMENT & VERTEX SHADER
// Pipeline Stages:
// [1. Ocean Specular & Bathymetry Shelf] ->
// [2. Smoothed Landmass Elevation & Topographic Hillshade] ->
// [3. Transparent Geopolitical Sovereign Color Washes] ->
// [4. Organic Vector Trade Flow & Blockade Interdiction Edges]
// =========================================================================

#version 300 es
precision highp float;
precision highp sampler2D;

// UNIFORM BINDINGS
layout(std140) uniform CameraData {
    mat4 u_viewProjectionMatrix;
    vec2 u_viewportResolution;
    vec2 u_cameraPanOffset;
    float u_zoomLevel;
    float u_timeSeconds;
};

layout(std140) uniform LightingParameters {
    vec3 u_sunDirection;       // Normalized light vector (azimuth 315 deg, elevation 45 deg)
    vec4 u_sunAmbientColor;     // Soft ambient illumination
    vec4 u_sunDiffuseColor;     // Directional sunlight tint
    float u_hillshadeIntensity; // Height bump attenuation factor
    float u_waterSpecularPower; // Specular gloss exponent
};

// TEXTURE SAMPLER SLOTS
uniform sampler2D s_topographicHeightmap; // R16F normalized elevation [0.0 = sea level, 1.0 = 5000m]
uniform sampler2D s_bathymetryShelfMap;   // R8 coastal distance field (shallow shelf vs oceanic trench)
uniform sampler2D s_politicalWashAtlas;   // RGBA sovereign color overlays (England red, France blue, etc.)
uniform sampler2D s_biomeNormalMap;       // Tangent space normal perturbation for mountain relief
uniform sampler2D s_tradeInterdictionMask;// Dynamic bitmask of active naval blockades and routes

// VARYING INPUTS FROM VERTEX SHADER
in vec2 v_texCoord;
in vec3 v_worldPosition;
in vec4 v_screenPosition;

// FINAL RENDER TARGET
out vec4 fragColor;

// CONSTANTS: PHYSICAL PALETTES
const vec3 SHALLOW_TURQUOISE_SHELF = vec3(0.04, 0.45, 0.58); // Vibrant coastal shallow halo
const vec3 MID_DEPTH_NAVY          = vec3(0.02, 0.12, 0.28); // Continental slope basin
const vec3 ABYSSAL_DEEP_OCEAN      = vec3(0.008, 0.04, 0.11); // Deep trench / open Atlantic
const vec3 TERRAIN_LOWLAND_PLAINS  = vec3(0.12, 0.19, 0.14); // Arable farmlands
const vec3 TERRAIN_PLATEAU_STEPPE  = vec3(0.19, 0.17, 0.12); // Anatolian & Iranian high plateaus
const vec3 TERRAIN_MOUNTAIN_ROCK   = vec3(0.32, 0.28, 0.23); // Alps, Taurus, Zagros cliffs
const vec3 MOUNTAIN_SNOW_PEAKS     = vec3(0.82, 0.85, 0.88); // Glacial mountain tops

// =========================================================================
// STAGE 1: MULTI-STATE WATER SPECULAR & BATHYMETRY SHADER
// =========================================================================
vec4 ComputeOceanBathymetry(vec2 uv, vec3 normal, vec3 viewDir) {
    float shelfDistance = texture(s_bathymetryShelfMap, uv).r;
    
    // Smooth coastal gradient: vibrant turquoise shelf -> deep ocean void
    float shelfFactor = smoothstep(0.0, 0.35, shelfDistance);
    vec3 baseWaterColor = mix(SHALLOW_TURQUOISE_SHELF, MID_DEPTH_NAVY, shelfFactor);
    baseWaterColor = mix(baseWaterColor, ABYSSAL_DEEP_OCEAN, smoothstep(0.35, 0.90, shelfDistance));

    // Dynamic water micro-wave normal perturbation
    vec2 waveOffset1 = vec2(sin(uv.y * 80.0 + u_timeSeconds * 0.4), cos(uv.x * 80.0 + u_timeSeconds * 0.4)) * 0.002;
    vec2 waveOffset2 = vec2(cos(uv.y * 120.0 - u_timeSeconds * 0.6), sin(uv.x * 120.0 - u_timeSeconds * 0.6)) * 0.0015;
    vec3 waterNormal = normalize(vec3(waveOffset1 + waveOffset2, 1.0));

    // Blinn-Phong specular shimmer
    vec3 halfVector = normalize(u_sunDirection + viewDir);
    float specAngle = max(0.0, dot(waterNormal, halfVector));
    float specular = pow(specAngle, u_waterSpecularPower) * (1.0 - shelfFactor * 0.5);

    // Fresnel reflectance
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, vec3(0.0, 0.0, 1.0))), 3.0) * 0.4;
    vec3 finalWater = baseWaterColor + (u_sunDiffuseColor.rgb * specular) + fresnel;

    return vec4(finalWater, 1.0);
}

// =========================================================================
// STAGE 2: TOPOGRAPHIC HEIGHT BLENDING & HILLSHADE NORMAL SAMPLING
// =========================================================================
vec4 ComputeTopographicElevation(vec2 uv) {
    float height = texture(s_topographicHeightmap, uv).r;

    // Finite difference gradient for procedural normal generation
    vec2 texelSize = 1.0 / u_viewportResolution;
    float hL = texture(s_topographicHeightmap, uv - vec2(texelSize.x, 0.0)).r;
    float hR = texture(s_topographicHeightmap, uv + vec2(texelSize.x, 0.0)).r;
    float hD = texture(s_topographicHeightmap, uv - vec2(0.0, texelSize.y)).r;
    float hU = texture(s_topographicHeightmap, uv + vec2(0.0, texelSize.y)).r;

    // Normal gradient vector
    vec3 terrainNormal = normalize(vec3((hL - hR) * u_hillshadeIntensity, (hD - hU) * u_hillshadeIntensity, 1.0));

    // Lambertian diffuse hillshade
    float hillshade = max(0.2, dot(terrainNormal, u_sunDirection));

    // Elevation-based hypsometric tinting
    vec3 landBase;
    if (height < 0.25) {
        landBase = mix(TERRAIN_LOWLAND_PLAINS, TERRAIN_PLATEAU_STEPPE, height / 0.25);
    } else if (height < 0.70) {
        landBase = mix(TERRAIN_PLATEAU_STEPPE, TERRAIN_MOUNTAIN_ROCK, (height - 0.25) / 0.45);
    } else {
        landBase = mix(TERRAIN_MOUNTAIN_ROCK, MOUNTAIN_SNOW_PEAKS, (height - 0.70) / 0.30);
    }

    // Soft topographic shadows along Alps, Balkans, Zagros, and Taurus
    vec3 shadedTerrain = landBase * (hillshade * u_sunDiffuseColor.rgb + u_sunAmbientColor.rgb);
    return vec4(shadedTerrain, 1.0);
}

// =========================================================================
// STAGE 3: TRANSPARENT SOVEREIGN GEOPOLITICAL COLOR WASH OVERLAYS
// =========================================================================
vec4 BlendPoliticalWash(vec4 terrainColor, vec2 uv) {
    vec4 politicalSample = texture(s_politicalWashAtlas, uv);
    if (politicalSample.a < 0.01) return terrainColor;

    // Soft light blend preserving topographic relief underneath sovereign borders
    vec3 blended = mix(terrainColor.rgb, politicalSample.rgb, politicalSample.a * 0.35);
    return vec4(blended, 1.0);
}

// =========================================================================
// STAGE 4: ORGANIC TRADE LINE & STRAIT BLOCKADE INTERDICTION COMPOSITING
// =========================================================================
vec4 CompositeLogisticalEdges(vec4 currentColor, vec2 uv) {
    vec4 tradeSample = texture(s_tradeInterdictionMask, uv);
    if (tradeSample.a < 0.01) return currentColor;

    // tradeSample.r = Silk Road flow (Amber / Orange)
    // tradeSample.g = Red Sea / Mediterranean maritime (Cyan / Blue)
    // tradeSample.b = Steppe supply line (White)
    // tradeSample.a = Interdiction / Blockade pulse (Crimson #ef4444)

    vec3 edgeColor = currentColor.rgb;
    if (tradeSample.a > 0.5) {
        // Active naval blockade overrides route color to glowing crimson
        float pulse = 0.7 + 0.3 * sin(u_timeSeconds * 4.0);
        edgeColor = mix(edgeColor, vec3(0.94, 0.27, 0.27), pulse);
    } else {
        vec3 routeTint = vec3(0.0);
        routeTint += vec3(0.96, 0.62, 0.07) * tradeSample.r; // Silk Road Orange
        routeTint += vec3(0.0, 0.90, 1.0) * tradeSample.g;   // Maritime Cyan
        routeTint += vec3(0.97, 0.98, 1.0) * tradeSample.b;  // Steppe White
        edgeColor = mix(edgeColor, routeTint, 0.85);
    }

    return vec4(edgeColor, 1.0);
}

// =========================================================================
// MASTER SHADER EXECUTION MAIN LOOP
// =========================================================================
void main() {
    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0)); // Orthographic / 2.5D camera vector
    float isLand = texture(s_topographicHeightmap, v_texCoord).a; // Alpha channel masks land vs water

    vec4 color;
    if (isLand < 0.5) {
        // Pipeline Stage 1: Dynamic Ocean & Bathymetric Shelf
        color = ComputeOceanBathymetry(v_texCoord, vec3(0.0, 0.0, 1.0), viewDir);
    } else {
        // Pipeline Stage 2: Smoothed Landmass Elevation & Shaded Relief
        color = ComputeTopographicElevation(v_texCoord);
        // Pipeline Stage 3: Transparent Sovereign Color Wash
        color = BlendPoliticalWash(color, v_texCoord);
    }

    // Pipeline Stage 4: Curved Trade Edges & Blockade Composing
    color = CompositeLogisticalEdges(color, v_texCoord);

    fragColor = color;
}
