# yawgl
Yet Another WebGL Library.
An extremely lightweight library to hide some of the verbosity of the
native WebGL API.

Most of the methods were developed while working through the excellent
[WebGL Fundamentals] lessons. Many of them closely follow greggman's module:
https://github.com/greggman/webgl-fundamentals
        /blob/master/webgl/resources/webgl-utils.js

## Why Yet Another Library?
There are already [lots of WebGL libraries], including [TWGL] from the great
greggman himself. Why release yet another one?

The main reason: they are not *lightweight* enough. Even TWGL (described as
"tiny"!) is over 6000 lines. Granted, most of those lines are helpful comments,
but 6000 lines is still a lot to scroll through.

A second reason: we want to use [rollup] to do static analysis and [tree
shaking] on modular code written in [ES6].

## How light is lightweight?
The canonical use case for yawgl is a simple [ray-casting] application.
We therefore don't include any cameras, meshes, primitives, or any of the
usual 3D tools.

All yawgl does is take care of the repetitive parts of the WebGL API for
attributes, indices, uniforms, textures, and draw calls. But please note: 
you still need to know how all these things work! If you don't understand 
them yet, your best options are to either:
- Go to [WebGL Fundamentals] and learn them, OR
- Use a more complete library like [three.js]

[WebGL Fundamentals]: https://webglfundamentals.org/
[lots of WebGL libraries]: https://gist.github.com/dmnsgn/76878ba6903cf15789b712464875cfdc
[TWGL]: https://github.com/greggman/twgl.js
[rollup]: https://rollupjs.org/guide/en
[tree shaking]: https://en.wikipedia.org/wiki/Tree_shaking
[ES6]: https://www.w3schools.com/js/js_es6.asp
[ray-casting]: https://www.cs.unc.edu/~taylorr/raycast_fragment/index.html
[three.js]: https://threejs.org/
