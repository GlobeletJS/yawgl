// Very similar to greggman's module:
// https://github.com/greggman/webgl-fundamentals/blob/master/webgl/resources/webgl-utils.js
function createAttributeSetters(gl, program) {
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

// Very similar to greggman's module:
// https://github.com/greggman/webgl-fundamentals/blob/master/webgl/resources/webgl-utils.js
function createUniformSetters(gl, program) {

  var uniformSetters = {};
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  // Track texture bindpoint index in case multiple textures are required
  var textureUnit = 0;

  for (let i = 0; i < numUniforms; i++) {
    var uniformInfo = gl.getActiveUniform(program, i);
    if (!uniformInfo) break;

    var name = uniformInfo.name;
    // remove the array suffix added by getActiveUniform
    if (name.substr(-3) === "[0]") {
      name = name.substr(0, name.length - 3);
    }
    var setter = createUniformSetter(program, uniformInfo);
    uniformSetters[name] = setter;
  }
  return uniformSetters;

  // This function must be nested to access the textureUnit index
  function createUniformSetter(program, uniformInfo) {
    var location = gl.getUniformLocation(program, uniformInfo.name);
    var isArray = (uniformInfo.size > 1 && uniformInfo.name.substr(-3) === "[0]");
    var type = uniformInfo.type;
    switch (type) {
      case gl.FLOAT :
        if (isArray) {
          return function(v) { gl.uniform1fv(location, v); };
        } else {
          return function(v) { gl.uniform1f(location, v); };
        }
      case gl.FLOAT_VEC2 :
        return function(v) { gl.uniform2fv(location, v); };
      case gl.FLOAT_VEC3 :
        return function(v) { gl.uniform3fv(location, v); };
      case gl.FLOAT_VEC4 :
        return function(v) { gl.uniform4fv(location, v); };
      case gl.INT :
        if (isArray) {
          return function(v) { gl.uniform1iv(location, v); };
        } else {
          return function(v) { gl.uniform1i(location, v); };
        }
      case gl.INT_VEC2 :
        return function(v) { gl.uniform2iv(location, v); };
      case gl.INT_VEC3 :
        return function(v) { gl.uniform3iv(location, v); };
      case gl.INT_VEC4 :
        return function(v) { gl.uniform4iv(location, v); };
      case gl.BOOL :
        return function(v) { gl.uniform1iv(location, v); };
      case gl.BOOL_VEC2 :
        return function(v) { gl.uniform2iv(location, v); };
      case gl.BOOL_VEC3 :
        return function(v) { gl.uniform3iv(location, v); };
      case gl.BOOL_VEC4 :
        return function(v) { gl.uniform4iv(location, v); };
      case gl.FLOAT_MAT2 :
        return function(v) { gl.uniformMatrix2fv(location, false, v); };
      case gl.FLOAT_MAT3 :
        return function(v) { gl.uniformMatrix3fv(location, false, v); };
      case gl.FLOAT_MAT4 :
        return function(v) { gl.uniformMatrix4fv(location, false, v); };
      case gl.SAMPLER_2D :
      case gl.SAMPLER_CUBE :
        if (isArray) {
          var units = [];
          for (let i = 0; i < uniformInfo.size; i++) { // greggman wrong here!
            units.push(textureUnit++);
          }
          return function(bindPoint, units) {
            return function(textures) {
              gl.uniform1iv(location, units);
              textures.forEach( function(texture, index) {
                gl.activeTexture(gl.TEXTURE0 + units[index]);
                gl.bindTexture(bindPoint, texture);
              });
            };
          }(getBindPointForSamplerType(gl, type), units);
        } else {
          return function(bindPoint, unit) {
            return function(texture) {
              //gl.uniform1i(location, units); // Typo? How did it even work?
              gl.uniform1i(location, unit);
              gl.activeTexture(gl.TEXTURE0 + unit);
              gl.bindTexture(bindPoint, texture);
            };
          }(getBindPointForSamplerType(gl, type), textureUnit++);
        }
     default:  // we should never get here
        throw("unknown type: 0x" + type.toString(16));
    }
  }
}

function getBindPointForSamplerType(gl, type) {
  if (type === gl.SAMPLER_2D)   return gl.TEXTURE_2D;
  if (type === gl.SAMPLER_CUBE) return gl.TEXTURE_CUBE_MAP;
  return undefined;
}

function setUniforms(setters, values) {
  Object.keys(values).forEach( function(name) {
    var setter = setters[name];
    if (setter) setter(values[name]);
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

function drawScene( gl, programInfo, bufferInfo, uniforms ) {
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

function drawOver( gl, programInfo, buffers, uniforms ) {
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

function initView(viewElement, fieldOfView) {
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
function resizeCanvasToDisplaySize(canvas) {
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

function initTiledTexture(gl, numTilesX, numTilesY, tileSize, callBack) {
  // Create a blank dummy image
  const width = numTilesX * tileSize;
  const height = numTilesY * tileSize;
  const dummy = new ImageData(width, height);
  // Set offsets for possible use in overwriting the texture
  dummy.xoffset = 0;
  dummy.yoffset = 0;

  // Initialize the texture using defined parameters and dummy image
  const texture = initTexture(gl, width, height);

  // Add callBack to default update routine
  function updateWithCallBack( image ) {
    texture.update( image );
    callBack();
  }

  // Add routine to clear texture with dummy image
  function clear() {
    texture.update( dummy );
  }

  return {
    sampler: texture.sampler,
    update: updateWithCallBack,
    clear: clear,
    // texture.replace() routine not used, to avoid messing up width/height
  };
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

export { clearRect, drawOver, drawScene, initQuadBuffers, initShaderProgram, initTexture, initTiledTexture, initView, loadCubeMapTexture, loadTexture, resizeCanvasToDisplaySize };
