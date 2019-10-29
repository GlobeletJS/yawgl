export function resizeCanvasToDisplaySize(canvas, multiplier) {
  // Make sure the canvas drawingbuffer is the same size as the display
  // webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html

  // multiplier allows scaling. Example: multiplier = window.devicePixelRatio
  multiplier = multiplier || 1;
  multiplier = Math.max(0, multiplier); // Don't allow negative scaling

  const width = Math.floor(canvas.clientWidth * multiplier);
  const height = Math.floor(canvas.clientHeight * multiplier);

  // Exit if no change
  if (canvas.width === width && canvas.height === height) return false;

  // Resize drawingbuffer to match resized display
  canvas.width = width;
  canvas.height = height;
  return true;
}