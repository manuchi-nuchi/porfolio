
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
varying vec2 v_pixel;
uniform highp vec2 u_squareSize;

void main() {
    v_uv = a_uv;
    // v_pixel is always in [0, squareSize] for the square, regardless of position
    v_pixel = a_uv * u_squareSize;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
