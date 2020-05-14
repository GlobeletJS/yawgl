export function getExtendedContext(canvas) {
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
