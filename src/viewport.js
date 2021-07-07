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
  };

  function setViewport() {
    // Update rectangles. boundingClientRect is relative to browser window
    dispRect = display.getBoundingClientRect();
    portRect = porthole.getBoundingClientRect();

    // Compute relative position of porthole vs display
    // Note flipped sign of Y! getBoundingClientRect increases downward, but
    // for WebGL we want Y increasing upward
    const bottom = dispRect.bottom - portRect.bottom;
    const left = portRect.left - dispRect.left;
    // Compute porthole size
    const width = portRect.right - portRect.left;
    const height = portRect.bottom - portRect.top;

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
