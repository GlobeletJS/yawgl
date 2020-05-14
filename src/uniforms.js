export function createUniformSetters(gl, program) {
  // Very similar to greggman's module:
  // webglfundamentals.org/docs/module-webgl-utils.html#.createUniformSetters

  // Track texture bindpoint index in case multiple textures are required
  var textureUnit = 0;

  const uniformSetters = {};
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  for (let i = 0; i < numUniforms; i++) {
    let uniformInfo = gl.getActiveUniform(program, i);
    if (!uniformInfo) break;

    let { name, type, size } = uniformInfo;
    let loc = gl.getUniformLocation(program, name);

    // getActiveUniform adds a suffix to the names of arrays
    let isArray = (name.slice(-3) === "[0]");
    let key = (isArray)
      ? name.slice(0, -3)
      : name;

    uniformSetters[key] = createUniformSetter(loc, type, isArray, size);
  }

  return uniformSetters;

  // This function must be nested to access the textureUnit index
  function createUniformSetter(loc, type, isArray, size) {
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
      case gl.SAMPLER_CUBE:
        var bindPoint = getBindPointForSamplerType(gl, type);
        if (isArray) {
          var units = Array.from(Array(size), () => textureUnit++);
          return function(textures) {
            gl.uniform1iv(loc, units);
            textures.forEach( function(texture, index) {
              gl.activeTexture(gl.TEXTURE0 + units[index]);
              gl.bindTexture(bindPoint, texture);
            });
          };
        } else {
          var unit = textureUnit++;
          return function(texture) {
            gl.uniform1i(loc, unit);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(bindPoint, texture);
          };
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

export function setUniforms(setters, values) {
  Object.entries(values).forEach(([key, val]) => {
    var setter = setters[key];
    if (setter) setter(val);
  });
}
