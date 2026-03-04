// Fragment shader
precision mediump float;

varying vec2 v_uv;
varying vec2 v_pixel;
uniform sampler2D u_perlin;
uniform highp vec2 u_texSize;
uniform float u_A;
uniform float u_B;
uniform float u_outlineWidth;
uniform vec3 u_color;
uniform float uSquareHeight;

void main() {
    vec2 texel = (floor(v_pixel) + 0.5) / u_texSize;
    float n = texture2D(u_perlin, texel).r;
    vec3 color = u_color;
    float uvA = u_A / uSquareHeight;
    float uvB = u_B / uSquareHeight;
    float V = clamp(((1.0 - v_uv.y) - uvA) / (uvB - uvA), 0.0, 1.0);

    // --- Rounded corners logic (circular in screen space) ---
    float baseRadiusPx = 10.0;
    float widthPx = 100.0;
    float heightPx = uSquareHeight;
    float radiusX = baseRadiusPx / widthPx;
    float radiusY = baseRadiusPx / heightPx;
    vec2 c = v_uv;
    float dist = 0.0;
    if (c.x < radiusX && c.y < radiusY) dist = length(vec2((c.x - radiusX) / radiusX, (c.y - radiusY) / radiusY));
    else if (c.x > 1.0 - radiusX && c.y < radiusY) dist = length(vec2((c.x - (1.0 - radiusX)) / radiusX, (c.y - radiusY) / radiusY));
    else if (c.x < radiusX && c.y > 1.0 - radiusY) dist = length(vec2((c.x - radiusX) / radiusX, (c.y - (1.0 - radiusY)) / radiusY));
    else if (c.x > 1.0 - radiusX && c.y > 1.0 - radiusY) dist = length(vec2((c.x - (1.0 - radiusX)) / radiusX, (c.y - (1.0 - radiusY)) / radiusY));
    if (dist > 1.0) discard;
    // --- End rounded corners logic ---

    if ((1.0 - v_uv.y) < uvB) // fully revealed
    {
        gl_FragColor = vec4(color, 1.0);
    }
    else if (n < V) // transition zone
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
