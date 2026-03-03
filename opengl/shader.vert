// Vertex shader
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
varying vec2 v_pixel;
uniform highp vec2 u_texSize;
uniform vec2 u_canvasSize;
void main() {
    v_uv = a_uv;
    // Map NDC to canvas pixel coordinates
    vec2 canvasPx = (a_position * 0.5 + 0.5) * u_canvasSize;
    // Map to texture pixel coordinates (centered square)
    v_pixel = canvasPx - 0.5 * (u_canvasSize - u_texSize);
    gl_Position = vec4(a_position, 0.0, 1.0);
}
