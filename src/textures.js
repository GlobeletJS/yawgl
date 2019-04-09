export function initTexture(gl, width, height) { // data) {
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

  //gl.texImage2D(target, level, internalFormat, srcFormat, srcType, data);
  gl.texImage2D(target, level, internalFormat, width, height,
      srcFormat, srcType, null);

  // Set up mipmapping and anisotropic filtering, if appropriate
  //setupMipMaps(gl, target, data.width, data.height);
  setupMipMaps(gl, target, width, height);
  setTextureAnisotropy(gl, target);

  return {
    sampler: texture,
    updatePartial,
    replace,
    update,
  }

  function updatePartial( image ) {
    // Updates a portion of the texture with the supplied image data.
    gl.bindTexture(target, texture);
    
    // Image will be written starting from the pixel (xoffset, yoffset).
    // If these values are not set on the input, use (0,0)
    var xoff = image.xoffset || 0;
    var yoff = image.yoffset || 0;
    gl.texSubImage2D(target, level, xoff, yoff, srcFormat, srcType, image);

    // TODO: don't we need to update the mipmaps??
    return;
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
    // Re-fills the texture with the supplied image data,
    // ASSUMING the image and texture are the same size
    gl.bindTexture(target, texture);
    gl.texSubImage2D(target, level, 0, 0, srcFormat, srcType, image);

    setupMipMaps(gl, target, image.width, image.height);
    return;
  }
}

export function initTiledTexture(gl, numTilesX, numTilesY, tileSize, callBack) {
  // Create a blank dummy image
  const width = numTilesX * tileSize;
  const height = numTilesY * tileSize;
  const dummy = new ImageData(width, height);
  // Set offsets for possible use in overwriting the texture
  dummy.xoffset = 0;
  dummy.yoffset = 0;

  // Initialize the texture using defined parameters and dummy image
  const texture = initTexture(gl, width, height); //initTexture(gl, dummy);

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

export function loadTexture(gl, url, callBack) {
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

export function loadCubeMapTexture(gl, urlArray, callBack) {
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
