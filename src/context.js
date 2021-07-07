import { initProgram } from "./program.js";
import { initAttributeMethods } from "./attributes.js";
import { initTextureMethods } from "./textures.js";

export function initContext(gl) {
  // Input is an extended WebGL context, as created by yawgl.getExtendedContext
  const canvas = gl.canvas;
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const api = { gl,
    initProgram: (vert, frag) => initProgram(gl, vert, frag),
    resizeCanvasToDisplaySize,
    bindFramebufferAndSetViewport,
    clear,
    clipRect,
    draw,
  };

  return Object.assign(api, initAttributeMethods(gl), initTextureMethods(gl));

  function resizeCanvasToDisplaySize(multiplier) {
    if (!multiplier || multiplier < 0) multiplier = 1;

    const width = Math.floor(canvas.clientWidth * multiplier);
    const height = Math.floor(canvas.clientHeight * multiplier);

    if (canvas.width === width && canvas.height === height) return false;

    canvas.width = width;
    canvas.height = height;
    return true;
  }

  function bindFramebufferAndSetViewport(options = {}) {
    const { buffer = null, size = gl.canvas } = options;
    const { width, height } = size;
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.viewport(0, 0, width, height);
  }

  function clear(color = [0.0, 0.0, 0.0, 0.0]) {
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(...color);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function clipRect(x, y, width, height) {
    gl.enable(gl.SCISSOR_TEST);
    const roundedArgs = [x, y, width, height].map(Math.round);
    gl.scissor(...roundedArgs);
  }

  function draw({ vao, indices, count = 6, instanceCount = 1 }) {
    const mode = gl.TRIANGLES;
    gl.bindVertexArray(vao);
    if (indices) {
      const { type, offset } = indices;
      gl.drawElementsInstanced(mode, count, type, offset, instanceCount);
    } else {
      gl.drawArraysInstanced(mode, 0, count, instanceCount);
    }
    gl.bindVertexArray(null);
  }
}
