import { initMipMapper } from "./mipmaps.js";

export function initTextureMethods(gl) {
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
