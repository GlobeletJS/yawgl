export function initScreen(canvas, fieldOfView) {
  // The canvas is a window into a 3D world.
  // fieldOfView is the vertical view angle range in degrees (floating point)

  // Compute values for transformation between the 3D world and the 2D canvas
  var tanFOV = Math.tan(fieldOfView * Math.PI / 180.0 / 2.0);
  var width = canvas.clientWidth;
  var height = canvas.clientHeight;
  var aspect = width / height;
  const maxRay = [aspect * tanFOV, tanFOV];
  // Pixel coordinates relative to the whole browser window
  var rect = canvas.getBoundingClientRect();

  return {
    canvas, // Back-reference
    resized,
    getRayParams,
    maxRay, // TODO: is it good to expose local state?
    topEdge: function() {
      return maxRay[1]; // tanFOV
    },
    rightEdge: function() {
      return maxRay[0]; // aspect * tanFOV
    },
  };

  function resized() {
    // Make sure the canvas drawingbuffer is the same size as the display
    // https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    aspect = width / height;
    maxRay[0] = aspect * tanFOV;

    // NOTE: for 3D geometries, we would need to update a projection matrix...

    if (canvas.width !== width || canvas.height !== height) {
      // Resize drawingbuffer to match resized display
      canvas.width = width;
      canvas.height = height;
      // Update coordinate system relative to browser window
      rect = canvas.getBoundingClientRect();
      // Let the calling program know the canvas was resized
      return true;
    }
    return false;
  }

  // Convert an event position on the screen into tangents of the angles
  // (relative to screen normal) of a ray shooting off into the 3D space
  function getRayParams(evnt) {
    // NOTE strange behavior of getBoundingClientRect()
    // rect.left and .top are equal to the coordinates given by evnt.clientX/Y
    // when the mouse is at the left top pixel in the box.
    // rect.right and .bottom are NOT equal to evnt.clientX/Y at the bottom
    // right pixel -- they are one more than the evnt.clientX/Y values.
    // Thus the number of pixels in the box is given by 
    //    canvas.clientWidth = rect.right - rect.left  (NO +1 !!)
    var x = evnt.clientX - rect.left;
    var y = rect.bottom - evnt.clientY - 1; // Flip sign to make +y upward

    // Normalized distances from center of box. We normalize by pixel DISTANCE
    // rather than pixel count, to ensure we get -1 and +1 at the ends.
    // (Confirm by considering the 2x2 case)
    var xratio = 2 * x / (width - 1) - 1;
    var yratio = 2 * y / (height - 1) -1;

    return {
      tanX: xratio * maxRay[0],
      tanY: yratio * maxRay[1],
    };
  }

}
