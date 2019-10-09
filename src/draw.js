import { setBuffersAndAttributes } from "./attributes.js";
import { setUniforms } from "./uniforms.js";

export function drawScene(gl, programInfo, bufferInfo, uniforms, viewport) {
  // Make a blank canvas that fills the displayed size from CSS
  prepCanvas(gl, viewport);

  // Tell WebGL to use our program when drawing
  gl.useProgram(programInfo.program);

  // Prepare shader attributes.
  setBuffersAndAttributes( gl, programInfo.attributeSetters, bufferInfo );
  // Set the shader uniforms
  setUniforms( programInfo.uniformSetters, uniforms );

  // Draw the scene
  gl.drawElements(gl.TRIANGLES, bufferInfo.indices.vertexCount,
      bufferInfo.indices.type, bufferInfo.indices.offset);

  // Turn off the scissor test for now  TODO: is this necessary?
  gl.disable(gl.SCISSOR_TEST);
}

function prepCanvas(gl, port) {
  // Set some parameters
  gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to transparent black
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Tell WebGL how to convert from clip space to pixels
  if (port !== undefined) {
    gl.viewport(port.left, port.bottom, port.width, port.height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(port.left, port.bottom, port.width, port.height);
  } else {
    // Use the whole canvas
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  // Clear the canvas AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  return;
}

export function drawOver(gl, programInfo, buffers, uniforms) {
  // Overwrite whatever is on the canvas, without clearing anything
  // BEWARE: make sure viewport is already set appropriately

  // Set up program, attributes, and uniforms
  gl.useProgram(programInfo.program);
  setBuffersAndAttributes( gl, programInfo.attributeSetters, buffers );
  setUniforms( programInfo.uniformSetters, uniforms );

  // Draw the scene
  gl.drawElements( gl.TRIANGLES, buffers.indices.vertexCount,
      buffers.indices.type, buffers.indices.offset );

  return;
}

export function clearRect(gl, x, y, width, height) {
  // Set some parameters
  gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to transparent black
  gl.clearDepth(1.0);

  // Use scissor to constrain clearing. 
  // See https://stackoverflow.com/a/11545738/10082269
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(x, y, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.SCISSOR_TEST);

  return;
}
