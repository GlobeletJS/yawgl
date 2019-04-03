import { 
  createAttributeSetters, 
  setBuffersAndAttributes } from "./attributes.js";
import { 
  createUniformSetters, 
  setUniforms } from "./uniforms.js";

// Initialize a shader program
export function initShaderProgram(gl, vsSource, fsSource) {
  // NOTE: Load any WebGL extensions before calling this

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert( 'Unable to initialize the shader program: \n' +
        gl.getProgramInfoLog(shaderProgram) );
    // This is not very good error handling... should be returning the error
    return null;
  }

  return {
    program: shaderProgram,
    attributeSetters: createAttributeSetters(gl, shaderProgram),
    uniformSetters: createUniformSetters(gl,shaderProgram),
  };
}

// create shader of a given type, upload source, compile it
function loadShader(gl, type, source) {
  const shader = gl.createShader(type); // no error handling??

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // Now check for errors
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // this alert business is sloppy...
    alert( 'An error occurred compiling the shaders: \n' +
        gl.getShaderInfoLog(shader) );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function drawScene( gl, programInfo, bufferInfo, uniforms ) {
  // Make a blank canvas that fills the displayed size from CSS
  prepCanvas(gl);

  // Tell WebGL to use our program when drawing
  gl.useProgram(programInfo.program);

  // Prepare shader attributes.
  setBuffersAndAttributes( gl, programInfo.attributeSetters, bufferInfo );
  // Set the shader uniforms
  setUniforms( programInfo.uniformSetters, uniforms );

  // Draw the scene
  gl.drawElements(gl.TRIANGLES, bufferInfo.indices.vertexCount,
      bufferInfo.indices.type, bufferInfo.indices.offset);
}

function prepCanvas(gl) {
  // Set some parameters
  gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to transparent black
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  return;
}

export function drawOver( gl, programInfo, buffers, uniforms ) {
  // Overwrite whatever is on the canvas, without clearing anything

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

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
