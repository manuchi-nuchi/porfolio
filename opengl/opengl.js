// opengl.js - minimal WebGL2 logic for a red square in the center


export async function fetchShaderSource(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch ' + url);
        return await response.text();
    } catch (e) {
        console.error('Shader fetch error:', url, e);
        throw e;
    }
}

export async function initOpenGLRedSquare(canvasId, vertUrl, fragUrl, perlinUrl = '../opengl/perlin_noise_100x500.png') {
    // Animation timing constants (from trajectory.js)
    const RECTANGLE_REVEAL_START_DELAY_MS = 0;
    const RECTANGLE_REVEAL_SPEED_PX_PER_SECOND = 500;
    const RECTANGLE_REVEAL_BAND_HEIGHT_PX = 100;
    const RECTANGLE_OULINE_WIDTH_PX = 10;
    // For a 100px square, fade in over the same band height
    let revealStartTimestamp = null;
    let globalAlpha = 0;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        alert('WebGL not supported');
        return;
    }
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ...existing code for shader/program/texture setup...
    // (All code below here should use the single canvas/gl instance)

    // Load shaders
    let vertSrc, fragSrc;
    try {
        [vertSrc, fragSrc] = await Promise.all([
            fetchShaderSource(vertUrl),
            fetchShaderSource(fragUrl)
        ]);
    } catch (e) {
        console.error('Failed to load shaders:', e);
        return;
    }

    function compileShader(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader), src);
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    let vertShader, fragShader, program;
    try {
        vertShader = compileShader(gl.VERTEX_SHADER, vertSrc);
        fragShader = compileShader(gl.FRAGMENT_SHADER, fragSrc);
        program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            throw new Error(gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
    } catch (e) {
        console.error('WebGL program error:', e);
        return;
    }

    // Load Perlin noise texture
    const perlinTex = gl.createTexture();
    const perlinImg = new window.Image();
    perlinImg.src = perlinUrl;
    await new Promise((resolve, reject) => {
        perlinImg.onload = resolve;
        perlinImg.onerror = reject;
    });
    gl.bindTexture(gl.TEXTURE_2D, perlinTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, perlinImg);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, perlinTex);
    const uPerlin = gl.getUniformLocation(program, 'u_perlin');
    gl.uniform1i(uPerlin, 0);

    // Square vertices (centered, NDC)
    // Full-screen quad (NDC from -1 to +1)
    // 100x100 pixel square centered in canvas, with UVs from 0 to 1
    const squareWidth = 100;
    const squareHeight = 100;
    // Ensure canvasWidth and canvasHeight are initialized before use
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    // Compute NDC size for 100x100 square
    const ndcW = squareWidth / canvasWidth;
    const ndcH = squareHeight / canvasHeight;
    // Centered at (0,0)
    // Each vertex: [x, y, u, v]
    const vertices = new Float32Array([
        -ndcW, -ndcH, 0, 0,
         ndcW, -ndcH, 1, 0,
        -ndcW,  ndcH, 0, 1,
        -ndcW,  ndcH, 0, 1,
         ndcW, -ndcH, 1, 0,
         ndcW,  ndcH, 1, 1
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

    // Add a_uv attribute
    const aUV = gl.getAttribLocation(program, 'a_uv');
    if (aUV !== -1) {
        gl.enableVertexAttribArray(aUV);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
    }
    const texWidth = perlinImg.width;
    const texHeight = perlinImg.height;

    // Pass texture and square size as uniforms
    const uTexSize = gl.getUniformLocation(program, 'u_texSize');
    gl.uniform2f(uTexSize, texWidth, texHeight);
    const uCanvasSize = gl.getUniformLocation(program, 'u_canvasSize');
    gl.uniform2f(uCanvasSize, canvasWidth, canvasHeight);
    // Pass square size as uniform (for future use if needed)
    const uSquareSize = gl.getUniformLocation(program, 'u_squareSize');
    if (uSquareSize) gl.uniform2f(uSquareSize, squareWidth, squareHeight);

    // Pass outline width as uniform
    const uOutlineWidth = gl.getUniformLocation(program, 'u_outlineWidth');
    if (uOutlineWidth) gl.uniform1f(uOutlineWidth, RECTANGLE_OULINE_WIDTH_PX / 100.0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    // Initial draw (fully transparent)
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Animation loop for fade-in
    const uA = gl.getUniformLocation(program, 'u_A');
    const uB = gl.getUniformLocation(program, 'u_B');
    function animateFadeIn(timestamp) {
        if (!revealStartTimestamp) revealStartTimestamp = timestamp;
        const elapsed = Math.max(0, timestamp - revealStartTimestamp - RECTANGLE_REVEAL_START_DELAY_MS) / 1000;
        // A = speed * elapsed, B = A - band_height
        const A = RECTANGLE_REVEAL_SPEED_PX_PER_SECOND * elapsed;
        const B = A - RECTANGLE_REVEAL_BAND_HEIGHT_PX;
        gl.useProgram(program);
        gl.uniform1f(uA, A);
        gl.uniform1f(uB, B);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (B < 100) {
            requestAnimationFrame(animateFadeIn);
        }
    }
    // Start animation after all setup is complete
    requestAnimationFrame(animateFadeIn);
}

// To use: call initOpenGLRedSquare('opengl-canvas', 'opengl/shader.vert', 'opengl/shader.frag') after DOM is ready.
