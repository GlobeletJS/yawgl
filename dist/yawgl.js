function createUniformSetter(gl, program, info, textureUnit) {
  const { name, type, size } = info;
  const isArray = name.endsWith("[0]");
  const loc = gl.getUniformLocation(program, name);

  switch (type) {
    case gl.FLOAT:
      return (isArray)
        ? (v) => gl.uniform1fv(loc, v)
        : (v) => gl.uniform1f(loc, v);
    case gl.FLOAT_VEC2:
      return (v) => gl.uniform2fv(loc, v);
    case gl.FLOAT_VEC3:
      return (v) => gl.uniform3fv(loc, v);
    case gl.FLOAT_VEC4:
      return (v) => gl.uniform4fv(loc, v);
    case gl.INT:
      return (isArray)
        ? (v) => gl.uniform1iv(loc, v)
        : (v) => gl.uniform1i(loc, v);
    case gl.INT_VEC2:
      return (v) => gl.uniform2iv(loc, v);
    case gl.INT_VEC3:
      return (v) => gl.uniform3iv(loc, v);
    case gl.INT_VEC4:
      return (v) => gl.uniform4iv(loc, v);
    case gl.BOOL:
      return (v) => gl.uniform1iv(loc, v);
    case gl.BOOL_VEC2:
      return (v) => gl.uniform2iv(loc, v);
    case gl.BOOL_VEC3:
      return (v) => gl.uniform3iv(loc, v);
    case gl.BOOL_VEC4:
      return (v) => gl.uniform4iv(loc, v);
    case gl.FLOAT_MAT2:
      return (v) => gl.uniformMatrix2fv(loc, false, v);
    case gl.FLOAT_MAT3:
      return (v) => gl.uniformMatrix3fv(loc, false, v);
    case gl.FLOAT_MAT4:
      return (v) => gl.uniformMatrix4fv(loc, false, v);
    case gl.SAMPLER_2D:
      return getTextureSetter(gl.TEXTURE_2D);
    case gl.SAMPLER_CUBE:
      return getTextureSetter(gl.TEXTURE_CUBE_MAP);
    default:  // we should never get here
      throw "unknown type: 0x" + type.toString(16);
  }

  function getTextureSetter(bindPoint) {
    return (isArray)
      ? buildTextureArraySetter(bindPoint)
      : buildTextureSetter(bindPoint);
  }

  function buildTextureSetter(bindPoint) {
    gl.uniform1i(loc, textureUnit);

    return function(texture) {
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(bindPoint, texture);
    };
  }

  function buildTextureArraySetter(bindPoint) {
    const units = Array.from(Array(size), () => textureUnit++);
    gl.uniform1iv(loc, units);

    return function(textures) {
      textures.forEach((texture, i) => {
        gl.activeTexture(gl.TEXTURE0 + units[i]);
        gl.bindTexture(bindPoint, texture);
      });
    };
  }
}

function createUniformSetters(gl, program) {
  // Collect info about all the uniforms used by the program
  const uniformInfo = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) })
    .map((v, i) => gl.getActiveUniform(program, i))
    .filter(info => info !== undefined);

  const textureTypes = [gl.SAMPLER_2D, gl.SAMPLER_CUBE];
  let textureUnit = 1; // Skip the first texture unit: used for initTexture

  // Make sure program is active, in case we need to set texture units
  gl.useProgram(program);

  return uniformInfo.reduce((d, info) => {
    const { name, type, size } = info;
    const isArray = name.endsWith("[0]");
    const key = isArray ? name.slice(0, -3) : name;

    d[key] = createUniformSetter(gl, program, info, textureUnit);

    if (textureTypes.includes(type)) textureUnit += size;

    return d;
  }, {});
}

function initAttributes(gl, program) {
  // Construct a dictionary of the locations of each attribute in the program
  const attrIndices = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) })
    .map((v, i) => gl.getActiveAttrib(program, i).name)
    .reduce((d, n) => (d[n] = gl.getAttribLocation(program, n), d), {});

  // Construct a dictionary of functions to set a constant value for a given
  // vertex attribute, when a per-vertex buffer is not needed
  const constantSetters = Object.entries(attrIndices).reduce((d, [name, i]) => {
    d[name] = function(v) {
      gl.disableVertexAttribArray(i);
      const method = getConstMethod(v.length);
      if (method) gl[method](i, v);
    };
    return d;
  }, {});

  function getConstMethod(len) {
    if (len === undefined) return "vertexAttrib1f";
    if ([1, 2, 3, 4].includes(len)) return "vertexAttrib" + len + "fv";
  }

  function constructVao({ attributes, indices }) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    Object.entries(attributes).forEach(([name, a]) => {
      const index = attrIndices[name];
      if (index === undefined) return;

      gl.enableVertexAttribArray(index);
      gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
      gl.vertexAttribPointer(
        index,                // index of attribute in program
        a.numComponents || a.size, // Number of elements to read per vertex
        a.type || gl.FLOAT,   // Type of each element
        a.normalize || false, // Whether to normalize it
        a.stride || 0,        // Byte spacing between vertices
        a.offset || 0         // Byte # to start reading from
      );
      gl.vertexAttribDivisor(index, a.divisor || 0);
    });

    if (indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.buffer);

    gl.bindVertexArray(null);
    return vao;
  }

  return { constantSetters, constructVao };
}

function initProgram(gl, vertexSrc, fragmentSrc) {
  const program = gl.createProgram();
  gl.attachShader(program, loadShader(gl, gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, loadShader(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    fail("Unable to link the program", gl.getProgramInfoLog(program));
  }

  const { constantSetters, constructVao } = initAttributes(gl, program);
  const uniformSetters = createUniformSetters(gl, program);

  return {
    uniformSetters: Object.assign(uniformSetters, constantSetters),
    use: () => gl.useProgram(program),
    constructVao,
  };
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    console.log("shader source = " + source);
    fail("An error occured compiling the shader", log);
  }

  return shader;
}

function fail(msg, log) {
  throw Error("yawgl.initProgram: " + msg + ":\n" + log);
}

function initAttributeMethods(gl) {
  return { createBuffer, initAttribute, initIndices, initQuad };

  function createBuffer(data, bindPoint = gl.ARRAY_BUFFER) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(bindPoint, buffer);
    gl.bufferData(bindPoint, data, gl.STATIC_DRAW);
    return buffer;
  }

  function initAttribute(options) {
    // Set defaults for unsupplied values
    const {
      buffer = createBuffer(options.data),
      numComponents = 3,
      type = gl.FLOAT,
      normalize = false,
      stride = 0,
      offset = 0,
      divisor = 1,
    } = options;

    // Return attribute state object
    return { buffer, numComponents, type, normalize, stride, offset, divisor };
  }

  function initIndices(options) {
    const {
      buffer = createBuffer(options.data, gl.ELEMENT_ARRAY_BUFFER),
      type = gl.UNSIGNED_INT,
      offset = 0,
    } = options;

    return { buffer, type, offset };
  }

  function initQuad({ x0 = -1.0, y0 = -1.0, x1 = 1.0, y1 = 1.0 } = {}) {
    // Create a buffer with the position of the vertices within one instance
    const data = new Float32Array([
      x0, y0,  x1, y0,  x1, y1,
      x0, y0,  x1, y1,  x0, y1,
    ]);

    return initAttribute({ data, numComponents: 2, divisor: 0 });
  }
}

function initMipMapper(gl, target) {
  const setAnisotropy = setupAnisotropy(gl, target);

  return function({ mips = true }) {
    if (mips) {
      setAnisotropy();
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(target);
    } else {
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
}

function setupAnisotropy(gl, target) {
  const ext = gl.getExtension("EXT_texture_filter_anisotropic");
  if (!ext) return () => undefined;

  const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  const pname = ext.TEXTURE_MAX_ANISOTROPY_EXT;

  // BEWARE: this texParameterf call is slow on Intel integrated graphics.
  return () => gl.texParameterf(target, pname, maxAnisotropy);
}

function initTextureMethods(gl) {
  const target = gl.TEXTURE_2D;
  const level = 0; // Mipmap level for image uploads
  const type = gl.UNSIGNED_BYTE;
  const border = 0;
  const getMips = initMipMapper(gl, target);

  return { initTexture, updateMips, initFramebuffer };

  function initTexture(options) {
    const {
      format = gl.RGBA,
      image, // ImageData, HTMLImageElement, HTMLCanvasElement, ImageBitmap
      data = null,  // ArrayBufferView
      mips = true,
      wrapS = gl.CLAMP_TO_EDGE,
      wrapT = gl.CLAMP_TO_EDGE,
    } = options;

    // For Image input, get size from element. Otherwise it must be supplied
    const { width = 1, height = 1 } = (image) ? image : options;

    const texture = gl.createTexture();

    // Work with first texture unit. Leave others unchanged (may be in use)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(target, texture);

    gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT);
    if (format !== gl.RGBA) gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    if (image) {
      gl.texImage2D(target, level, format, format, type, image);
    } else {
      gl.texImage2D(target, level, format,
        width, height, border, format, type, data);
    }

    getMips({ mips });

    return texture;
  }

  function updateMips(texture) {
    gl.bindTexture(target, texture);
    gl.generateMipmap(target);
  }

  function initFramebuffer({ width, height }) {
    const texture = initTexture({ width, height });

    const buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      target, texture, level);

    gl.bindTexture(target, null);

    return {
      sampler: texture, // TODO: rename to texture?
      buffer,
      size: { width, height },
    };
  }
}

function resizeCanvasToDisplaySize(canvas, multiplier) {
  // Make sure the canvas drawingbuffer is the same size as the display
  // webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html

  // multiplier allows scaling. Example: multiplier = window.devicePixelRatio
  if (!multiplier || multiplier < 0) multiplier = 1;

  const width = Math.floor(canvas.clientWidth * multiplier);
  const height = Math.floor(canvas.clientHeight * multiplier);

  // Exit if no change
  if (canvas.width === width && canvas.height === height) return false;

  // Resize drawingbuffer to match resized display
  canvas.width = width;
  canvas.height = height;
  return true;
}

function initContext(arg) {
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

function initView(porthole, fieldOfView) {
  // The porthole is an HTML element acting as a window into a 3D world
  // fieldOfView is the vertical view angle range in degrees (floating point)

  // Compute values for transformation between the 3D world and the 2D porthole
  let portRect, width, height, aspect;
  const tanFOV = Math.tan(fieldOfView * Math.PI / 180.0 / 2.0);
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
    const newWidth = portRect.right - portRect.left;
    const newHeight = portRect.bottom - portRect.top;

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
    const x = clientX - portRect.left;
    const y = portRect.bottom - clientY - 1; // Flip sign to make +y upward

    // Normalized distances from center of box. We normalize by pixel DISTANCE
    // rather than pixel count, to ensure we get -1 and +1 at the ends.
    // (Confirm by considering the 2x2 case)
    const xratio = 2 * x / (width - 1) - 1;
    const yratio = 2 * y / (height - 1) - 1;

    rayVec[0] = xratio * maxRay[0];
    rayVec[1] = yratio * maxRay[1];
    // rayVec[2] = -1.0;
    // rayVec[3] = 0.0;
    return;
  }
}

function initViewport(display, porthole) {
  // Stores and updates the parameters required for gl.viewport, for WebGL
  // rendering to an element overlaying a larger background canvas.
  // See twgljs.org/examples/itemlist.html.
  // Inputs are HTML elements whose boundingClientRects match the background
  // canvas (display) and the desired area for rendering the scene (porthole)

  let portRect, dispRect;
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

export { initContext, initProgram, initView, initViewport, resizeCanvasToDisplaySize };
