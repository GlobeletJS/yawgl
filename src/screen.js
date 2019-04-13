export function initView(viewElement, fieldOfView) {
  // The viewElement is a window into a 3D world, as portrayed on a background
  // canvas. See twgljs.org/examples/itemlist.html
  // fieldOfView is the vertical view angle range in degrees (floating point)

  // Compute values for transformation between the 3D world and the 2D viewElement
  var tanFOV = Math.tan(fieldOfView * Math.PI / 180.0 / 2.0);
  var width = viewElement.clientWidth;
  var height = viewElement.clientHeight;
  var aspect = width / height;
  const maxRay = [aspect * tanFOV, tanFOV];
  // Pixel coordinates relative to the whole browser window
  var rect = viewElement.getBoundingClientRect();

  return {
    viewElement, // Back-reference
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
    if (viewElement.clientWidth !== width || 
        viewElement.clientHeight !== height) {
      // viewElement has changed size. Store updated dimensions
      width = viewElement.clientWidth;
      height = viewElement.clientHeight;
      // Recompute derived transform parameters
      aspect = width / height;
      maxRay[0] = aspect * tanFOV;
      // Update coordinate system relative to browser window
      rect = viewElement.getBoundingClientRect();
      // Let the calling program know the viewElement was resized
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
    //    viewElement.clientWidth = rect.right - rect.left  (NO +1 !!)
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

// Make sure the viewElement drawingbuffer is the same size as the display
// webglfundamentals.org/webgl/lessons/webgl-resizing-the-viewElement.html
export function resizeCanvasToDisplaySize(canvas) {
  var width = canvas.clientWidth;
  var height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    // Resize drawingbuffer to match resized display
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}
