function getExtendedContext(canvas) {
  const haveCanvas = canvas instanceof Element;
  if (!haveCanvas || canvas.tagName.toLowerCase() !== "canvas") {
    throw Error("ERROR in yawgl.getExtendedContext: not a valid Canvas!");
  }

  // developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
  //   #Take_advantage_of_universally_supported_WebGL_1_extensions
  const universalExtensions = [
    "ANGLE_instanced_arrays",
    "EXT_blend_minmax",
    "OES_element_index_uint",
    "OES_standard_derivatives",
    "OES_vertex_array_object",
    "WEBGL_debug_renderer_info",
    "WEBGL_lose_context"
  ];

  // Get a WebGL context, and extend it
  const gl = canvas.getContext("webgl");
  universalExtensions.forEach(ext => getAndApplyExtension(gl, ext));

  // Modify the shaderSource method to add a preamble
  const SHADER_PREAMBLE = `
#extension GL_OES_standard_derivatives : enable
#line 1
`;
  const shaderSource = gl.shaderSource;
  gl.shaderSource = function(shader, source) {
    const modified = (source.indexOf("GL_OES_standard_derivatives") < 0)
      ? SHADER_PREAMBLE + source
      : source;
    shaderSource.call(gl, shader, modified);
  };

  return gl;
}

function getAndApplyExtension(gl, name) {
  // https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
  const ext = gl.getExtension(name);
  if (!ext) {
    console.log("yawgl: WebGL extension " + name + " not supported!");
    return null;
  }

  const fnSuffix = name.split("_")[0];
  const enumSuffix = '_' + fnSuffix;

  for (const key in ext) {
    const value = ext[key];
    const isFunc = typeof value === 'function';
    const suffix = isFunc ? fnSuffix : enumSuffix;
    let name = key;
    // examples of where this is not true are WEBGL_compressed_texture_s3tc
    // and WEBGL_compressed_texture_pvrtc
    if (key.endsWith(suffix)) {
      name = key.substring(0, key.length - suffix.length);
    }
    if (gl[name] !== undefined) {
      if (!isFunc && gl[name] !== value) {
        console.warn("conflict:", name, gl[name], value, key);
      }
    } else if (isFunc) {
      gl[name] = (function(origFn) {
        return function() {
          return origFn.apply(ext, arguments);
        };
      })(value);
    } else {
      gl[name] = value;
    }
  }

  return ext;
}

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
      throw("unknown type: 0x" + type.toString(16));
  }

  function getTextureSetter(bindPoint) {
    return (isArray)
      ? buildTextureArraySetter(bindPoint)
      : buildTextureSetter(bindPoint);
  }

  function buildTextureSetter(bindPoint) {
    return function(texture) {
      gl.uniform1i(loc, textureUnit);
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(bindPoint, texture);
    };
  }

  function buildTextureArraySetter(bindPoint) {
    const units = Array.from(Array(size), () => textureUnit++);
    return function(textures) {
      gl.uniform1iv(loc, units);
      textures.forEach((texture, i) => {
        gl.activeTexture(gl.TEXTURE0 + units[i]);
        gl.bindTexture(bindPoint, texture);
      });
    };
  }
}

function createUniformSetters(gl, program) {
  const typeSizes = {
    [gl.FLOAT]: 1,
    [gl.FLOAT_VEC2]: 2,
    [gl.FLOAT_VEC3]: 3,
    [gl.FLOAT_VEC4]: 4,
    [gl.INT]: 1,
    [gl.INT_VEC2]: 2,
    [gl.INT_VEC3]: 3,
    [gl.INT_VEC4]: 4,
    [gl.BOOL]: 1,
    [gl.BOOL_VEC2]: 2,
    [gl.BOOL_VEC3]: 3,
    [gl.BOOL_VEC4]: 4,
    [gl.FLOAT_MAT2]: 4,
    [gl.FLOAT_MAT3]: 9,
    [gl.FLOAT_MAT4]: 16,
    [gl.SAMPLER_2D]: 1,
    [gl.SAMPLER_CUBE]: 1,
  };

  // Collect info about all the uniforms used by the program
  const uniformInfo = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) })
    .map((v, i) => gl.getActiveUniform(program, i))
    .filter(info => info !== undefined);

  const textureTypes = [gl.SAMPLER_2D, gl.SAMPLER_CUBE];
  var textureUnit = 0;

  return uniformInfo.reduce((d, info) => {
    let { name, type, size } = info;
    let isArray = name.endsWith("[0]");
    let key = isArray ? name.slice(0, -3) : name;

    //let setter = createUniformSetter(gl, program, info, textureUnit);
    //d[key] = wrapSetter(setter, isArray, type, size);
    d[key] = createUniformSetter(gl, program, info, textureUnit);

    if (textureTypes.includes(type)) textureUnit += size;

    return d;
  }, {});
}

function initAttributes(gl, program) {
  // Construct a dictionary of the indices of each attribute used by program
  const attrIndices = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) })
    .map((v, i) => gl.getActiveAttrib(program, i))
    .reduce((d, { name }, index) => (d[name] = index, d), {});

  // Construct a dictionary of functions to set a constant value for a given
  // vertex attribute, when a per-vertex buffer is not needed
  const constantSetters = Object.entries(attrIndices).reduce((d, [name, i]) => {
    d[name] = function(v) {
      gl.disableVertexAttribArray(i);

      // For float attributes, the supplied value may be a Number
      if (v.length === undefined) return gl.vertexAttrib1f(i, v);

      if (![1, 2, 3, 4].includes(v.length)) return;
      const methodName = "vertexAttrib" + v.length + "fv";
      gl[methodName](i, v);
    };
    return d;
  }, {});

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
    let log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
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

function initContext(gl) {
  // Input is an extended WebGL context, as created by yawgl.getExtendedContext
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const api = { gl,
    initProgram: (vert, frag) => initProgram(gl, vert, frag),

    bindFramebufferAndSetViewport,
    clear,
    clipRect,
    draw,
  };

  return Object.assign(api, initAttributeMethods(gl));

  function bindFramebufferAndSetViewport(framebuffer, size = gl.canvas) {
    let { width, height } = size;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
  }

  function clear(color = [0.0, 0.0, 0.0, 0.0]) {
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(...color);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function clipRect(x, y, width, height) {
    gl.enable(gl.SCISSOR_TEST);
    let roundedArgs = [x, y, width, height].map(Math.round);
    gl.scissor(...roundedArgs);
  }

  function draw({ vao, indices, count = 6, instanceCount = 1 }) {
    const mode = gl.TRIANGLES;
    gl.bindVertexArray(vao);
    if (indices) {
      let { type, offset } = indices;
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

function initViewport(display, porthole) {
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

function resizeCanvasToDisplaySize(canvas, multiplier) {
  // Make sure the canvas drawingbuffer is the same size as the display
  // webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html

  // multiplier allows scaling. Example: multiplier = window.devicePixelRatio
  if (!multiplier || multiplier < 0) multplier = 1;

  const width = Math.floor(canvas.clientWidth * multiplier);
  const height = Math.floor(canvas.clientHeight * multiplier);

  // Exit if no change
  if (canvas.width === width && canvas.height === height) return false;

  // Resize drawingbuffer to match resized display
  canvas.width = width;
  canvas.height = height;
  return true;
}

function setupMipMaps(gl, target, width, height) {
  // We are using WebGL1 (for compatibility with mobile browsers) which can't
  // handle mipmapping for non-power-of-2 images. Maybe we should provide
  // pre-computed mipmaps? see https://stackoverflow.com/a/21540856/10082269
  if (isPowerOf2(width) && isPowerOf2(height)) {
    gl.generateMipmap(target);
    // Clamp to avoid wrapping around poles
    // TODO: this may not work with circular coordinates?
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else { // Turn off mipmapping 
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // Set wrapping to clamp to edge
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  return;
}

function setTextureAnisotropy(gl, target) {
  var ext = (
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic') || 
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
      );
  if (ext) {
    var maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    // BEWARE: this texParameterf call is slow on Intel integrated graphics.
    // Avoid this entire function if at all possible.
    gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, 
        maxAnisotropy);
  }
  return;
}

function isPowerOf2(value) {
  // This trick uses bitwise operators.
  // See https://stackoverflow.com/a/30924333/10082269
  return value && !(value & (value - 1));
  // For a better explanation, with some errors in the solution, see
  // https://stackoverflow.com/a/30924360/10082269
}

function initTexture(gl, width, height) {
  // Initializes a 2D texture object, extending the default gl.createTexture()
  // The GL context and the binding target are implicitly saved in the closure.
  // Returns the sampler (as a property) along with update and replace methods.
  // Input data is an ImageData object

  const target = gl.TEXTURE_2D;
  const texture = gl.createTexture();
  gl.bindTexture(target, texture);

  // Initialize with default parameters
  const level = 0;  // Mipmap level
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const border = 0;

  gl.texImage2D(target, level, internalFormat, width, height, border,
      srcFormat, srcType, null);

  // Set up mipmapping and anisotropic filtering, if appropriate
  setupMipMaps(gl, target, width, height);
  setTextureAnisotropy(gl, target);

  return {
    sampler: texture,
    replace,
    update,
  }

  function replace( image ) {
    // Replaces the texture with the supplied image data
    // WARNING: will change texture width/height to match the image
    gl.bindTexture(target, texture);
    gl.texImage2D(target, level, internalFormat, srcFormat, srcType, image);

    // Re-do mipmap setup, since width/height may have changed
    setupMipMaps(gl, target, image.width, image.height);
    return;
  }

  function update( image ) {
    // Updates a portion of the texture with the supplied image data.
    gl.bindTexture(target, texture);

    // Image will be written starting from the pixel (xoffset, yoffset).
    // If these values are not set on the input, use (0,0)
    var xoff = image.xoffset || 0;
    var yoff = image.yoffset || 0;
    gl.texSubImage2D(target, level, xoff, yoff, srcFormat, srcType, image);

    setupMipMaps(gl, target, image.width, image.height);
    return;
  }
}

function loadTexture(gl, url, callBack) {
  // Initialize a single-pixel image to use before the supplied image loads
  const width = 1;
  const height = 1;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  const dummy = new ImageData(width, height, pixel);

  const texture = initTexture(gl, dummy);

  // Load image asynchronously from supplied URL
  const image = new Image();
  image.onload = function () {
    texture.replace(image);
    callBack();
  };
  image.src = url;

  return texture.sampler;
}

function loadCubeMapTexture(gl, urlArray, callBack) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  // Initialize a single-pixel image to use before the supplied image load
  const level = 0;                 // Mipmap level
  const internalFormat = gl.RGBA;  // 4 values per pixel
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  for (let i = 0; i < 6; i++) {
    gl.texImage2D( gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, internalFormat,
        width, height, border, srcFormat, srcType, pixel );
  }

  // Load images asynchronously from supplied URLs
  const images = [];
  var imagesLoaded = 0;
  for (let i = 0; i < 6; i++) {
    images[i] = new Image();
    images[i].onload = loadImagesToCubeMap;
    images[i].src = urlArray[i];
  }
  function loadImagesToCubeMap() {
    // Count calls, and confirm we have all 6 images before proceeding
    imagesLoaded++;
    if (imagesLoaded < 6) return;

    // Set up cubemap texture
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    for (let i = 0; i < 6; i++) {
      gl.texImage2D( gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, internalFormat,
          srcFormat, srcType, images[i] );
    }

    // Generate mipmaps -- watch out for seams!
    // It may be better to generate them externally. Use AMD's cubemapgen? See
    // https://www.reddit.com/r/opengl/comments/38tlww/accessing_cubemaps_mipmap_level/
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    // Set some parameters for edge handling in WebGL1, following
    // http://www.alecjacobson.com/weblog/?p=1871
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    //gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    // Check for anisotropic filtering, and use it if available
    setTextureAnisotropy(gl, gl.TEXTURE_CUBE_MAP);

    // Callback to let the calling program know everything is finally loaded
    callBack();
  }

  return texture;
}

function initFramebuffer(gl, width, height) {
  // 1. Create a texture of the desired size
  const target = gl.TEXTURE_2D;
  const level = 0;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;
  const border = 0;

  const texture = gl.createTexture();
  gl.bindTexture(target, texture);

  gl.texImage2D(target, level, format, width, height, border,
    format, type, null);

  // Set up mipmaps
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  setTextureAnisotropy(gl, target);
  gl.generateMipmap(target);

  // 2. Create a framebuffer and attach the texture
  const buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    target, texture, level);

  gl.bindTexture(target, null);

  return {
    buffer,
    // TODO: make it resizable?
    size: { width, height },
    sampler: texture,
  };
}

export { getExtendedContext, initContext, initFramebuffer, initProgram, initTexture, initView, initViewport, loadCubeMapTexture, loadTexture, resizeCanvasToDisplaySize };
