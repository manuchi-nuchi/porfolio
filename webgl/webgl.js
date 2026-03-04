// webgl.js - minimal WebGL2 logic for a red square in the center

async function fetchShaderSource(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch ' + url);
        return await response.text();
    } catch (e) {
        console.error('Shader fetch error:', url, e);
        throw e;
    }
}

async function initWebGLRedSquare(canvasId, vertUrl, fragUrl, perlinUrl = '../webgl/perlin_noise_100x500.png') {
    // Animation timing constants (from trajectory.js)
    const RECTANGLE_REVEAL_START_DELAY_MS = 0;
    const RECTANGLE_REVEAL_SPEED_PX_PER_SECOND = 100;
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

    // Two square structs: red (right), blue (left)
    // Build one square for each trajectory rectangle, each with a random color
        // Helper to generate a random RGB color (full saturation)
        function randomColor() {
            // Generate a random hue and convert to RGB
            const h = Math.random();
            const s = 1.0;
            const v = 1.0;
            const i = Math.floor(h * 6);
            const f = h * 6 - i;
            const p = v * (1 - s);
            const q = v * (1 - f * s);
            const t = v * (1 - (1 - f) * s);
            let r, g, b;
            switch (i % 6) {
                case 0: r = v, g = t, b = p; break;
                case 1: r = q, g = v, b = p; break;
                case 2: r = p, g = v, b = t; break;
                case 3: r = p, g = q, b = v; break;
                case 4: r = t, g = p, b = v; break;
                case 5: r = v, g = p, b = q; break;
            }
            return [r, g, b];
        }
    if (!window.TRAJECTORY_RECTANGLE_DEFINITIONS) {
        console.warn('webgl.js: window.TRAJECTORY_RECTANGLE_DEFINITIONS is not defined at WebGL init');
    } else {
        console.log('webgl.js: window.TRAJECTORY_RECTANGLE_DEFINITIONS', window.TRAJECTORY_RECTANGLE_DEFINITIONS);
    }
        const squares = (window.TRAJECTORY_RECTANGLE_DEFINITIONS || []).map(rect => ({
            color: randomColor(),
            width: 100,
            height: 100 * (rect.endYear - rect.startYear),
            xOffsetPx: rect.side === 'left' ? -Math.abs(rect.xOffsetPx) : Math.abs(rect.xOffsetPx),
            endYear: rect.endYear,
            startYear: rect.startYear,
            side: rect.side
        }));
    console.log('webgl.js: squares', squares);

    // Square vertices (centered, NDC)
    // Full-screen quad (NDC from -1 to +1)
    // 100x100 pixel square centered in canvas, with UVs from 0 to 1
    const squareWidth = 100;
    const squareHeight = 100;
    let canvasWidth = 0;
    let canvasHeight = 0;
    // Ensure canvas is sized to device pixels
    function resizeCanvasToDisplaySize() {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(canvas.clientWidth * dpr);
        const displayHeight = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }
    resizeCanvasToDisplaySize();
    window.addEventListener('resize', resizeCanvasToDisplaySize);
    // Compute NDC size for 100x100 square
    const ndcW = squareWidth / canvas.width;
    const ndcH = squareHeight / canvas.height;
    const rightOffsetPx = 100;
    const rightOffsetNDC = rightOffsetPx / canvas.width;
    // Compute Y position for year 2024
    const year2024Y = getYear2024Y();
    // Convert to NDC (WebGL: -1 at bottom, +1 at top)
    // Canvas Y=0 is top, so NDC_Y = 1 - 2*(year2024Y/canvasHeight)
    const ndcY = 1 - 2 * (year2024Y / canvas.height);
    // Use this ndcY for all square vertices
    let squareVertices = null;
    function updateSquareVertices(square, year) {
        resizeCanvasToDisplaySize();
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
            const ndcW = square.width / canvasWidth;
            const ndcH = square.height / canvasHeight;
        // Compute the canvas center in page coordinates
        const canvasRect = canvas.getBoundingClientRect();
        const canvasCenterPageX = canvasRect.left + window.scrollX + canvas.width / 2;
        // Get the DOM center (linePageX) from the global window object
        let linePageX = window.linePageX;
        if (typeof linePageX !== 'number') {
            // Try to get it from trajectory.js if available
            linePageX = window.innerWidth / 2;
        }
        // Debug log for alignment
        if (window.DEBUG_WEBGL_ALIGNMENT) {
            console.log('updateSquareVertices:', {canvasCenterPageX, linePageX, xOffsetPx: square.xOffsetPx});
        }
        // Offset from canvas center by the same amount as DOM rectangles
        // (canvas center) + (xOffsetPx) + (linePageX - canvasCenterPageX)
        const centerX = canvas.width / 2 + square.xOffsetPx + (linePageX - canvasCenterPageX);
        const positionXNDC = (2 * centerX / canvasWidth) - 1;
        // Y logic unchanged
            // Adjust Y so the top stays at the same position as a 100x100 square
            const heightAdjustment = (square.height - 100) / 2;
            square.positionY = getYearCenterY(year) - square.height / 2 + 50 + heightAdjustment;
        const canvasTopY = canvasRect.top + window.scrollY;
        const localY = square.positionY - canvasTopY + square.height / 2; // center of square
        const ndcY = 1 - 2 * (localY / canvasHeight);
        return new Float32Array([
            -ndcW + positionXNDC, ndcY - ndcH, 0, 0,
             ndcW + positionXNDC, ndcY - ndcH, 1, 0,
            -ndcW + positionXNDC, ndcY + ndcH, 0, 1,
            -ndcW + positionXNDC, ndcY + ndcH, 0, 1,
             ndcW + positionXNDC, ndcY - ndcH, 1, 0,
             ndcW + positionXNDC, ndcY + ndcH, 1, 1
        ]);
    }
    // After program setup and before animation loop:
    // Initialize squareVertices with a default 100x100 square at center if not already set
    if (!squareVertices) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const hw = 100 / 2;
        const hh = 100 / 2;
        squareVertices = new Float32Array([
            // Triangle 1
            ((cx - hw) - canvas.width / 2) / (canvas.width / 2), ((cy - hh) - canvas.height / 2) / (canvas.height / 2), 0, 0,
            ((cx + hw) - canvas.width / 2) / (canvas.width / 2), ((cy - hh) - canvas.height / 2) / (canvas.height / 2), 1, 0,
            ((cx - hw) - canvas.width / 2) / (canvas.width / 2), ((cy + hh) - canvas.height / 2) / (canvas.height / 2), 0, 1,
            // Triangle 2
            ((cx - hw) - canvas.width / 2) / (canvas.width / 2), ((cy + hh) - canvas.height / 2) / (canvas.height / 2), 0, 1,
            ((cx + hw) - canvas.width / 2) / (canvas.width / 2), ((cy - hh) - canvas.height / 2) / (canvas.height / 2), 1, 0,
            ((cx + hw) - canvas.width / 2) / (canvas.width / 2), ((cy + hh) - canvas.height / 2) / (canvas.height / 2), 1, 1
        ]);
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.DYNAMIC_DRAW);

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

    // Add u_color uniform
    const uColor = gl.getUniformLocation(program, 'u_color');
    if (squares && squares.length > 0 && squares[0].color) {
        gl.uniform3fv(uColor, squares[0].color);
    }

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
        redrawSquare();
        if (B < 100) {
            requestAnimationFrame(animateFadeIn);
        }
    }
    function redrawSquare() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (let i = 0; i < squares.length; ++i) {
            // Use the endYear property from the square for correct Y position
            const year = squares[i].endYear || 2024;
            const squareVertices = updateSquareVertices(squares[i], year);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.DYNAMIC_DRAW);
            gl.uniform3fv(uColor, squares[i].color);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
    // Start animation after all setup is complete
    requestAnimationFrame(animateFadeIn);

    // After all setup, ensure redraw on scroll/resize
    window.addEventListener('scroll', redrawSquare);
    window.addEventListener('resize', redrawSquare);
}

// Helper to get year 2024 Y position from trajectory.js
function getYear2024Y() {
    // These must match trajectory.js
    const YEAR_TOP = 2026;
    const YEAR_SPACING_PX = 100;
    const YEAR_START_OFFSET_PX = 100;
    const siteNav = document.querySelector('.site-nav');
    if (!siteNav) return 0;
    const navRect = siteNav.getBoundingClientRect();
    // firstYearY logic: navRect.bottom + YEAR_START_OFFSET_PX
    const firstYearY = navRect.bottom + YEAR_START_OFFSET_PX;
    // getYearCenterY(2024):
    return firstYearY + (YEAR_TOP - 2024) * YEAR_SPACING_PX;
}

// Helper to get year center Y position
function getYearCenterY(year) {
    const YEAR_TOP = 2026;
    const YEAR_SPACING_PX = 100;
    const YEAR_START_OFFSET_PX = 100;
    const siteNav = document.querySelector('.site-nav');
    if (!siteNav) return 0;
    const navRect = siteNav.getBoundingClientRect();
    const firstYearY = navRect.bottom + YEAR_START_OFFSET_PX;
    return firstYearY + (YEAR_TOP - year) * YEAR_SPACING_PX;
}

// To use: call initWebGLRedSquare('webgl-canvas', 'webgl/shader.vert', 'webgl/shader.frag') after DOM is ready.

// Attach to window for global access
window.initWebGLRedSquare = initWebGLRedSquare;
