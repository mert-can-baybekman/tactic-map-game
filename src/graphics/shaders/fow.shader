// =========================================================================
// GPU-ACCELERATED FOG OF WAR (FoW) VISION SHADER
// Language: OpenGL Shading Language (GLSL 450) / Metal Shading Language
// Subsystem: /src/graphics/shaders/fow.shader
// =========================================================================

#version 450 core

// FoW STATE ENUM
// 0.0 = Terra Incognita (Black, Unexplored)
// 0.5 = Shroud of War (Semi-Transparent Dark Grey, Explored Topography Visible, Foreign Units Culled)
// 1.0 = Active Vision (Fully Visible, Real-Time Tactical Information)

layout(location = 0) in vec2 v_TexCoord;       // Screen UV [0.0, 1.0]
layout(location = 1) in vec2 v_GeoLatLon;      // Real-World Latitude & Longitude

layout(location = 0) out vec4 out_FoWColor;

// UNIFORMS
layout(binding = 0) uniform FoWUniforms {
    vec4 u_TerraIncognitaColor;  // vec4(0.02, 0.02, 0.03, 1.00)
    vec4 u_ShroudOfWarColor;     // vec4(0.12, 0.14, 0.18, 0.65)
    vec4 u_ActiveVisionColor;    // vec4(1.00, 1.00, 1.00, 0.00)
    float u_FoWTransitionSoftness; // 0.08
    uint u_ActiveEntityCount;
};

// STRUCTURE: Vision Entity Source (Armies, Navies, Controlled Forts)
struct VisionSource {
    vec2 screenPos;             // [X, Y] Canvas Coordinates
    float visionRadius;         // Base_Radius + Leader_Scouting_Trait
    float pad;
};

layout(std430, binding = 1) readonly buffer VisionBuffer {
    VisionSource u_VisionSources[];
};

// SAMPLER: Historical Exploration Bitmask (1-bit per cell: 1=Explored, 0=Terra Incognita)
layout(binding = 2) uniform sampler2D u_ExplorationHistoryTexture;

void main() {
    // 1. Sample Exploration History
    float isExplored = texture(u_ExplorationHistoryTexture, v_TexCoord).r;

    // 2. Terra Incognita Pass: If unmapped, render solid black mask
    if (isExplored < 0.1) {
        out_FoWColor = u_TerraIncognitaColor;
        return;
    }

    // 3. Dynamic Vision Casting Pass (Real-Time Circular Projections)
    vec2 currentFragCoord = v_TexCoord * vec2(1600.0, 900.0);
    float maxVisionIntensity = 0.0;

    for (uint i = 0u; i < u_ActiveEntityCount; i++) {
        VisionSource source = u_VisionSources[i];
        float dist = distance(currentFragCoord, source.screenPos);

        if (dist < source.visionRadius) {
            // Smooth hermite interpolation at the perimeter of the vision circle
            float edgeDist = source.visionRadius - dist;
            float intensity = smoothstep(0.0, source.visionRadius * u_FoWTransitionSoftness, edgeDist);
            maxVisionIntensity = max(maxVisionIntensity, intensity);

            if (maxVisionIntensity >= 0.99) break; // Early termination optimization
        }
    }

    // 4. Multi-State Compositing
    // Interpolate between Shroud of War (0.0) and Active Vision (1.0)
    vec4 fowResult = mix(u_ShroudOfWarColor, u_ActiveVisionColor, maxVisionIntensity);

    out_FoWColor = fowResult;
}
