import { createAttributeSetters } from "./attributes.js";
import { createUniformSetters } from "./uniforms.js";

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
    throw Error('Unable to initialize the shader program: \n' +
        gl.getProgramInfoLog(shaderProgram) );
    return null;
  }

  return {
    program: shaderProgram,
    attributeSetters: createAttributeSetters(gl, shaderProgram),
    uniformSetters: createUniformSetters(gl, shaderProgram),
  };
}

// create shader of a given type, upload source, compile it
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw Error('An error occurred compiling the shaders: \n' +
        gl.getShaderInfoLog(shader) );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
