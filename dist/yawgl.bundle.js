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
    "OES_element_index_unit",
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
  if (!ext) return null;

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

function initQuadBuffers(gl) {
  // 4 vertices at the corners of the quad
  const vertices = [ -1, -1,  0,    1, -1,  0,    1,  1,  0,   -1,  1,  0 ];
  // Store byte info and load into GPU
  const vertexPositions = {
    buffer: gl.createBuffer(),
    numComponents: 3,
    type: gl.FLOAT,
    normalize: false,
    stride: 0,
    offset: 0
  };
  // Bind to the gl context
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositions.buffer);
  // Pass the array into WebGL
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Texture coordinates assume image has 0,0 at top left
  const texCoordData = [ 0, 1,   1, 1,   1, 0,   0, 0 ];
  const texCoords = {
    buffer: gl.createBuffer(),
    numComponents: 2,
    type: gl.FLOAT,
    normalize: false,
    stride: 0,
    offset: 0
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoords.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoordData), gl.STATIC_DRAW);

  // Index into two triangles
  var indices = [ 0,  1,  2,    2,  3,  0 ];
  const vertexIndices = {
    buffer: gl.createBuffer(),
    vertexCount: indices.length,
    type: gl.UNSIGNED_SHORT,
    offset: 0
  };
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndices.buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    attributes: {
      aVertexPosition: vertexPositions,
      aTexCoord: texCoords,
    },
    indices: vertexIndices,
  };
}

function createAttributeSetters(gl, program) {
  // Very similar to greggman's module:
  // webglfundamentals.org/docs/module-webgl-utils.html#.createAttributeSetters
  var attribSetters = {};
  var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < numAttribs; i++) {
    var attribInfo = gl.getActiveAttrib(program, i);
    if (!attribInfo) break;
    var index = gl.getAttribLocation(program, attribInfo.name);
    attribSetters[attribInfo.name] = createAttribSetter(gl, index);
  }
  return attribSetters;
}

function createAttribSetter(gl, index) {
  return function(b) {
    // Enable this attribute (shader attributes are disabled by default)
    gl.enableVertexAttribArray(index);
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
    // Point the attribute in the program to this buffer,
    // and tell the program the byte layout in the buffer
    gl.vertexAttribPointer(
        index,                      // index of attribute in program
        b.numComponents || b.size,  // Number of elements to read per vertex
        b.type || gl.FLOAT,         // Type of each element
        b.normalize || false,       // Whether to normalize it
        b.stride || 0,              // Byte spacing between vertices
        b.offset || 0               // Byte # to start reading from
        );
  };
}

function setBuffersAndAttributes(gl, setters, buffers) {
  setAttributes(setters, buffers.attributes);
  if (buffers.indices) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices.buffer);
  }
}

function setAttributes(setters, attribs) {
  Object.keys(attribs).forEach( function(name) {
    var setter = setters[name];
    if (setter) setter( attribs[name] );
  });
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
    return (size > 1)
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

  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  const uniformInfo = Array.from({ length: numUniforms })
    .map((v, i) => gl.getActiveUniform(program, i))
    .filter(info => info !== undefined);

  var textureUnit = 0;

  return uniformInfo.reduce((d, info) => {
    let { name, type, size } = info;
    let isArray = name.endsWith("[0]");
    let key = isArray ? name.slice(0, -3) : name;

    //let setter = createUniformSetter(gl, program, info, textureUnit);
    //d[key] = wrapSetter(setter, isArray, type, size);
    d[key] = createUniformSetter(gl, program, info, textureUnit);

    if (type === gl.TEXTURE_2D || type === gl.TEXTURE_CUBE_MAP) {
      textureUnit += size;
    }

    return d;
  }, {});
}

function setUniforms(setters, values) {
  Object.entries(values).forEach(([key, val]) => {
    var setter = setters[key];
    if (setter) setter(val);
  });
}

// Initialize a shader program
function initShaderProgram(gl, vsSource, fsSource) {
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
  }

  return shader;
}

function getVao(gl, program, attributeState) {
  const { attributes, indices } = attributeState;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  Object.entries(attributes).forEach(([name, a]) => {
    var index = gl.getAttribLocation(program, name);
    if (index < 0) return;

    gl.enableVertexAttribArray(index);
    gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
    gl.vertexAttribPointer(
      index, // index of attribute in program
      a.numComponents || a.size, // Number of elements to read per vertex
      a.type || gl.FLOAT, // Type of each element
      a.normalize || false, // Whether to normalize it
      a.stride || 0, // Byte spacing between vertices
      a.offset || 0 // Byte # to start reading from
    );
    gl.vertexAttribDivisor(index, a.divisor || 0);
  });

  if (indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.buffer);

  gl.bindVertexArray(null);
  return vao;
}

function initProgram(gl, vertexSrc, fragmentSrc) {
  const program = gl.createProgram();
  gl.attachShader(program, loadShader$1(gl, gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, loadShader$1(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    fail("Unable to link the program", gl.getProgramInfoLog(program));
  }

  const uniformSetters = createUniformSetters(gl, program);

  function setupDraw(uniforms) {
    gl.useProgram(program);
    setUniforms(uniformSetters, uniforms);
  }

  return { gl, setupDraw,
    constructVao: (attributeState) => getVao(gl, program, attributeState),
  };
}

function loadShader$1(gl, type, source) {
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

function drawScene(gl, programInfo, bufferInfo, uniforms, viewport) {
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

function drawOver(gl, programInfo, buffers, uniforms) {
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

function clearRect(gl, x, y, width, height) {
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

export { clearRect, drawOver, drawScene, getExtendedContext, initProgram, initQuadBuffers, initShaderProgram, initTexture, initView, initViewport, loadCubeMapTexture, loadTexture, resizeCanvasToDisplaySize };
