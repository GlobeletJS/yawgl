#version 300 es

in vec2 position;
in vec4 fillColor;
in float fillOpacity;

out vec4 fillStyle;

void main() {
  fillStyle = fillColor * fillOpacity;
  gl_Position = vec4(position, 0.0, 1.0);
}
