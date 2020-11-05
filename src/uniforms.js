import { createUniformSetter } from "./uniform-setter.js";

export function createUniformSetters(gl, program) {
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
    let key = name.endsWith("[0]") ? name.slice(0, -3) : name;

    d[key] = createUniformSetter(gl, program, info, textureUnit);

    if (type === gl.TEXTURE_2D || type === gl.TEXTURE_CUBE_MAP) {
      textureUnit += size;
    }

    return d;
  }, {});
}

export function setUniforms(setters, values) {
  Object.entries(values).forEach(([key, val]) => {
    var setter = setters[key];
    if (setter) setter(val);
  });
}
