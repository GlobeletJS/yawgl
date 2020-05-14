export function getVao(gl, program, attributeState) {
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
