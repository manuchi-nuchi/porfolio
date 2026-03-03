// Fragment shader
precision mediump float;

varying vec2 v_uv;
varying vec2 v_pixel;
uniform sampler2D u_perlin;
uniform highp vec2 u_texSize;
uniform float u_A;
uniform float u_B;
uniform float u_outlineWidth;

void main() {
    vec2 texel = (floor(v_pixel) + 0.5) / u_texSize;
    float n = texture2D(u_perlin, texel).r;
    vec3 color = vec3(1.0, 0.0, 0.0); // constant color (red)
    
    float uvA = u_A / 100.0;
    float uvB = u_B / 100.0;
    
    float V = clamp(((1.0 - v_uv.y) - uvA) / (uvB - uvA), 0.0, 1.0);
    
    if (n < V) // already showing
    {
        if (n > V - u_outlineWidth)
            color = vec3(1.0, 1.0, 1.0);

        gl_FragColor = vec4(color, 1.0);
    }
    else // still hidden
    {
        gl_FragColor = vec4(color, 0);
    }
    
    return;
}
