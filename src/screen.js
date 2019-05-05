export function initView(display, porthole, fieldOfView) {
  // The porthole is a window into a 3D world, as portrayed on a background
  // display. See twgljs.org/examples/itemlist.html
  // fieldOfView is the vertical view angle range in degrees (floating point)

  // Compute values for transformation between the 3D world and the 2D porthole
  var tanFOV = Math.tan(fieldOfView * Math.PI / 180.0 / 2.0);

  // Pixel coordinates relative to the whole browser window
  var portRect = porthole.getBoundingClientRect();
  var dispRect = display.getBoundingClientRect();

  // Porthole coordinates relative to display rectangle
  const viewport = {
    left: portRect.left - dispRect.left,
    // Note flipped sign of Y! getBoundingClientRect increases downward, but
    // for WebGL we want Y increasing upward
    bottom: dispRect.bottom - portRect.bottom,
    width: porthole.clientWidth,
    height: porthole.clientHeight,
  };
  var aspect = viewport.width / viewport.height;
  const maxRay = [aspect * tanFOV, tanFOV];

  return {
    element: porthole, // Back-reference
    viewport,
    changed,
    getRayParams,
    maxRay, // TODO: is it good to expose local state?
    topEdge: function() {
      return maxRay[1]; // tanFOV
    },
    rightEdge: function() {
      return maxRay[0]; // aspect * tanFOV
    },
  };

  function changed() {
    // Update rectangles. boundingClientRect is relative to browser window
    portRect = porthole.getBoundingClientRect();
    dispRect = display.getBoundingClientRect();

    // Compute relative position of porthole vs display
    let left = portRect.left - dispRect.left;
    let bottom = dispRect.bottom - portRect.bottom;
    // Compute porthole size
    let width = portRect.right - portRect.left;
    let height = portRect.bottom - portRect.top;

    // If any change, update the viewport
    if (viewport.left !== left || viewport.bottom !== bottom ||
        viewport.width !== width || viewport.height !== height) {
      viewport.left = left;
      viewport.bottom = bottom;
      viewport.width = width;
      viewport.height = height;

      // Recompute derived parameters
      aspect = width / height;
      maxRay[0] = aspect * tanFOV;

      // Let the calling program know that the porthole changed
      return true;
    }
    return false;
  }

  // Convert a position on the screen into tangents of the angles
  // (relative to screen normal) of a ray shooting off into the 3D space
  function getRayParams(clientX, clientY) {
    // NOTE strange behavior of getBoundingClientRect()
    // rect.left and .top are equal to the coordinates given by clientX/Y
    // when the mouse is at the left top pixel in the box.
    // rect.right and .bottom are NOT equal to clientX/Y at the bottom
    // right pixel -- they are one more than the clientX/Y values.
    // Thus the number of pixels in the box is given by 
    //    porthole.clientWidth = rect.right - rect.left  (NO +1 !!)
    var x = clientX - portRect.left;
    var y = portRect.bottom - clientY - 1; // Flip sign to make +y upward

    // Normalized distances from center of box. We normalize by pixel DISTANCE
    // rather than pixel count, to ensure we get -1 and +1 at the ends.
    // (Confirm by considering the 2x2 case)
    var xratio = 2 * x / (viewport.width - 1) - 1;
    var yratio = 2 * y / (viewport.height - 1) -1;

    return {
      tanX: xratio * maxRay[0],
      tanY: yratio * maxRay[1],
    };
  }
}

// Make sure the canvas drawingbuffer is the same size as the display
// webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
export function resizeCanvasToDisplaySize(canvas) {
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    // Resize drawingbuffer to match resized display
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}
