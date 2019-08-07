export function initView(porthole, fieldOfView) {
  // The porthole is an HTML element acting as a window into a 3D world
  // fieldOfView is the vertical view angle range in degrees (floating point)

  // Compute values for transformation between the 3D world and the 2D porthole
  var portRect, width, height, aspect;
  var tanFOV = Math.tan(fieldOfView * Math.PI / 180.0 / 2.0);
  const maxRay = [];

  computeRayParams(); // Set initial values

  return {
    element: porthole, // Back-reference
    changed: computeRayParams,

    width: () => width,
    height: () => height,
    topEdge: () => maxRay[1],   // tanFOV
    rightEdge: () => maxRay[0], // aspect * tanFOV
    maxRay, // TODO: is it good to expose local state?
    getRayParams,
  };

  function computeRayParams() {
    // Compute porthole size
    portRect = porthole.getBoundingClientRect();
    let newWidth = portRect.right - portRect.left;
    let newHeight = portRect.bottom - portRect.top;

    // Exit if no change
    if (width === newWidth && height === newHeight) return false;

    // Update stored values
    width = newWidth;
    height = newHeight;
    aspect = width / height;
    maxRay[0] = aspect * tanFOV;
    maxRay[1] = tanFOV; // Probably no change, but it is exposed externally

    // Let the calling program know that the porthole changed
    return true;
  }

  // Convert a position on the screen into tangents of the angles
  // (relative to screen normal) of a ray shooting off into the 3D space
  function getRayParams(rayVec, clientX, clientY) {
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
    var xratio = 2 * x / (width - 1) - 1;
    var yratio = 2 * y / (height - 1) -1;

    rayVec[0] = xratio * maxRay[0];
    rayVec[1] = yratio * maxRay[1];
    //rayVec[2] = -1.0;
    //rayVec[3] = 0.0;
    return;
  }
}

export function initViewport(display, porthole) {
  // Stores and updates the parameters required for gl.viewport, for WebGL
  // rendering to an element overlaying a larger background canvas.
  // See twgljs.org/examples/itemlist.html.
  // Inputs are HTML elements whose boundingClientRects match the background
  // canvas (display) and the desired area for rendering the scene (porthole)

  var portRect, dispRect;
  const viewport = {};

  setViewport(); // Set initial values

  return {
    element: porthole, // Back-reference
    viewport,
    changed: setViewport,
  }

  function setViewport() {
    // Update rectangles. boundingClientRect is relative to browser window
    dispRect = display.getBoundingClientRect();
    portRect = porthole.getBoundingClientRect();

    // Compute relative position of porthole vs display
    // Note flipped sign of Y! getBoundingClientRect increases downward, but
    // for WebGL we want Y increasing upward
    let bottom = dispRect.bottom - portRect.bottom;
    let left = portRect.left - dispRect.left;
    // Compute porthole size
    let width = portRect.right - portRect.left;
    let height = portRect.bottom - portRect.top;

    // Exit if no change
    if (viewport.left === left && viewport.bottom === bottom &&
        viewport.width === width && viewport.height === height) return false;

    // Update the viewport
    viewport.left = left;
    viewport.bottom = bottom;
    viewport.width = width;
    viewport.height = height;

    // Let the calling program know that the porthole changed
    return true;
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
