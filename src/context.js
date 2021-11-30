import { initProgram } from "./program.js";
import { initAttributeMethods } from "./attributes.js";
import { initTextureMethods } from "./textures.js";
import { resizeCanvasToDisplaySize } from "./resize-canvas.js";

export function initContext(arg) {
  const argType =
    (arg instanceof WebGL2RenderingContext) ? "context" :
    (arg instanceof HTMLCanvasElement) ? "canvas" :
    "unknown";
  if (argType === "unknown") throw "yawgl initContext: arg must be either " +
    "a HTMLCanvasElement or a WebGL2RenderingContext";

  const canvas = (argType === "canvas") ? arg : arg.canvas;
  const gl = (argType === "context") ? arg : arg.getContext("webgl2");

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const api = { gl,
    initProgram: (vert, frag) => initProgram(gl, vert, frag),
    resizeCanvasToDisplaySize: (s) => resizeCanvasToDisplaySize(canvas, s),
    bindFramebufferAndSetViewport,
    clear,
    clipRect,
    draw,
  };

  return Object.assign(api, initAttributeMethods(gl), initTextureMethods(gl));

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
