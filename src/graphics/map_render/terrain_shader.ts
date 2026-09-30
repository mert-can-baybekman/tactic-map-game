/**
 * High-Fidelity Terrain & Heightmap Shader Pipeline
 * Provides WebGL / Canvas shader pipelines for multi-layer topographic rendering,
 * bathymetric ocean gradients, 2.5D mountain hillshading, and river network rasterization.
 */

export interface TerrainShaderUniforms {
  u_resolution: [number, number];
  u_camera_offset: [number, number];
  u_zoom_level: number;
  u_sun_azimuth: number; // 315 degrees standard NW lighting for hillshading
  u_sun_elevation: number; // 45 degrees
  u_political_alpha: number; // Blending strength in political map mode
  u_lod_factor: number; // 0.0 (macro) to 1.0 (tactical micro)
}

export const TERRAIN_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  attribute float a_elevation;
  attribute float a_biomeType; // 0: Sea, 1: Farmland, 2: Hills, 3: Mountains, 4: Forest

  uniform vec2 u_resolution;
  uniform vec2 u_camera_offset;
  uniform float u_zoom_level;

  varying vec2 v_texCoord;
  varying float v_elevation;
  varying float v_biomeType;

  void main() {
    vec2 world_pos = (a_position - u_camera_offset) * u_zoom_level;
    vec2 clip_space = (world_pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip_space * vec2(1.0, -1.0), 0.0, 1.0);

    v_texCoord = a_texCoord;
    v_elevation = a_elevation;
    v_biomeType = a_biomeType;
  }
`;

export const TERRAIN_FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 v_texCoord;
  varying float v_elevation;
  varying float v_biomeType;

  uniform vec2 u_resolution;
  uniform float u_sun_azimuth;
  uniform float u_sun_elevation;
  uniform float u_political_alpha;
  uniform float u_lod_factor;

  // Real-world bathymetric and topographic gradient palette
  vec3 getOceanColor(float depth) {
    vec3 deepWater = vec3(0.027, 0.075, 0.145);  // #071325 Deep Mediterranean / Atlantic
    vec3 shallowWater = vec3(0.055, 0.180, 0.320); // #0e2e52 Coastal shallows
    return mix(deepWater, shallowWater, clamp(depth, 0.0, 1.0));
  }

  vec3 getLandColor(float elevation, float biome) {
    vec3 farmlands = vec3(0.125, 0.220, 0.145); // #203825 Fertile plains (Paris, London)
    vec3 hills = vec3(0.240, 0.230, 0.170);     // #3d3b2b Undulating hills (Bursa, Balkans)
    vec3 mountains = vec3(0.350, 0.310, 0.270); // #594f45 Alpine rocky ridges
    vec3 snow = vec3(0.780, 0.820, 0.860);      // High peak glaciers

    if (biome < 0.5) return farmlands;
    if (elevation > 0.8) return mix(mountains, snow, (elevation - 0.8) * 5.0);
    if (elevation > 0.45) return mix(hills, mountains, (elevation - 0.45) / 0.35);
    return mix(farmlands, hills, elevation / 0.45);
  }

  void main() {
    if (v_biomeType < 0.5) {
      // Ocean / Sea Body with bathymetric gradient
      vec3 waterCol = getOceanColor(1.0 - v_elevation);
      gl_FragColor = vec4(waterCol, 1.0);
      return;
    }

    // 2.5D Topographic Lambertian Hillshade calculation
    float slope = clamp(v_elevation * 1.8, 0.0, 1.0);
    float hillshade = 0.5 + 0.5 * sin(u_sun_azimuth) * slope;

    vec3 landBase = getLandColor(v_elevation, v_biomeType);
    vec3 shadedTerrain = landBase * hillshade;

    // Tactical grid contour fading based on LOD
    if (u_lod_factor > 0.5) {
      float contour = mod(v_elevation * 100.0, 10.0);
      if (contour < 0.8) {
        shadedTerrain *= 0.92; // Subtle contour line
      }
    }

    gl_FragColor = vec4(shadedTerrain, 1.0);
  }
`;

export class TerrainShaderPipeline {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: TerrainShaderUniforms = {
    u_resolution: [1600, 900],
    u_camera_offset: [0, 0],
    u_zoom_level: 1.0,
    u_sun_azimuth: (315.0 * Math.PI) / 180.0,
    u_sun_elevation: (45.0 * Math.PI) / 180.0,
    u_political_alpha: 0.35,
    u_lod_factor: 0.0
  };

  public init(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl');
    if (!gl) return false;
    this.gl = gl;

    const vert = this.compileShader(gl.VERTEX_SHADER, TERRAIN_VERTEX_SHADER);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, TERRAIN_FRAGMENT_SHADER);
    if (!vert || !frag) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Shader link failure:', gl.getProgramInfoLog(prog));
      return false;
    }

    this.program = prog;
    return true;
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, src);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public updateUniforms(partial: Partial<TerrainShaderUniforms>): void {
    Object.assign(this.uniforms, partial);
  }

  public getUniforms(): TerrainShaderUniforms {
    return { ...this.uniforms };
  }
}
