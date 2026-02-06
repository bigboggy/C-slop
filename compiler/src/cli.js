#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { compile } = require('./compiler');
const { createRuntime } = require('./runtime');
const { spawn } = require('child_process');
const http = require('http');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('C-slop - Token-minimal web framework');
  console.log('');
  console.log('Usage:');
  console.log('  cslop create <name>      Create a new project');
  console.log('  cslop start              Start app (compile frontend + run backend)');
  console.log('  cslop watch              Start with hot reload (like Vite)');
  console.log('  cslop <file.slop>        Run a .slop file');
  console.log('  cslop build <file.slop>  Compile to JavaScript');
  console.log('');
  console.log('Project structure:');
  console.log('  slop.json                Config file');
  console.log('  api.slop                 Backend API');
  console.log('  components/*.ui          Frontend components');
  console.log('  dist/                    Static files output');
  process.exit(1);
}

const command = args[0];

// Helper: Compile frontend components
function compileFrontend(componentsDir, outputDir, projectRoot) {
  const frontendDir = path.join(__dirname, '..', 'frontend');
  const parserPath = path.join(frontendDir, 'parser.js');
  const codegenPath = path.join(frontendDir, 'codegen.js');
  const routerParserPath = path.join(frontendDir, 'router-parser.js');
  const routerCodegenPath = path.join(frontendDir, 'router-codegen.js');

  // Dynamic import for ES modules
  return import(parserPath).then(({ parseComponent }) => {
    return import(codegenPath).then(({ generateCode }) => {
      return import(routerParserPath).then(({ parseRouter }) => {
        return import(routerCodegenPath).then(({ generateRouterCode }) => {
          // Ensure output directories
          const jsDir = path.join(outputDir, 'js');
          const cssDir = path.join(outputDir, 'css');
          fs.mkdirSync(jsDir, { recursive: true });
          fs.mkdirSync(cssDir, { recursive: true });

          const compiled = [];

          // Copy SlopUI CSS files
          const slopuiDir = path.join(__dirname, '..', 'slopui');
          const baseCSS = path.join(slopuiDir, 'base.css');
          const componentsCSS = path.join(slopuiDir, 'components.css');

          if (fs.existsSync(baseCSS) && fs.existsSync(componentsCSS)) {
            const baseCSSContent = fs.readFileSync(baseCSS, 'utf8');
            const componentsCSSContent = fs.readFileSync(componentsCSS, 'utf8');

            // Combine into single slopui.css
            const slopuiCSS = `${baseCSSContent}\n\n${componentsCSSContent}`;
            fs.writeFileSync(path.join(cssDir, 'slopui.css'), slopuiCSS);
            compiled.push('slopui');
          }

          // Generate theme CSS from slop.json config
          const configRoot = projectRoot || componentsDir.replace('/components', '');
          const configPath = path.join(configRoot, 'slop.json');
          if (fs.existsSync(configPath)) {
            try {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              if (config.theme) {
                const { generateThemeCSS } = require(path.join(slopuiDir, 'theme.js'));
                const themeCSS = generateThemeCSS(config.theme);
                fs.writeFileSync(path.join(cssDir, 'theme.css'), themeCSS);
                compiled.push('theme');
              }
            } catch (err) {
              console.warn('  Warning: Could not generate theme CSS:', err.message);
            }
          }

          // Get .ui files
          if (fs.existsSync(componentsDir)) {
            const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.ui'));

            for (const file of files) {
              const source = fs.readFileSync(path.join(componentsDir, file), 'utf8');
              const name = path.basename(file, '.ui');

              const ast = parseComponent(source);
              const { js, css } = generateCode(ast, name);

              // Write files
              fs.writeFileSync(path.join(jsDir, `${name}.js`), js);
              fs.writeFileSync(path.join(cssDir, `${name}.css`), css);

              compiled.push(name);
            }
          }

          // Check for router.slop and compile it
          const routerPath = path.join(projectRoot || componentsDir.replace('/components', ''), 'router.slop');
          if (fs.existsSync(routerPath)) {
            const routerSource = fs.readFileSync(routerPath, 'utf8');
            const routes = parseRouter(routerSource);
            const routerJs = generateRouterCode(routes);
            fs.writeFileSync(path.join(jsDir, 'router-config.js'), routerJs);
            compiled.push('router-config');
          }

          // Copy runtime files (including router.js)
          const runtimeDir = path.join(__dirname, '..', 'runtime');
          const runtimeFiles = ['signals.js', 'dom.js', 'router.js'];
          for (const file of runtimeFiles) {
            const src = path.join(runtimeDir, file);
            const dest = path.join(outputDir, 'js', file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          }

          return compiled;
        });
      });
    });
  });
}

if (command === 'start') {
  // Start mode: cslop start
  // 1. Read slop.json for config
  // 2. Compile frontend components
  // 3. Run backend API

  const cwd = process.cwd();
  const configPath = path.join(cwd, 'slop.json');

  if (!fs.existsSync(configPath)) {
    console.error('Error: slop.json not found in current directory');
    console.log('Create a slop.json with your project configuration');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log('C-slop Starting...');
  console.log('');

  // Find API file
  const apiFile = fs.readdirSync(cwd).find(f => f.endsWith('.slop'));
  if (!apiFile) {
    console.error('Error: No .slop file found in current directory');
    process.exit(1);
  }

  // Compile frontend if components directory exists
  const componentsDir = path.join(cwd, 'components');
  const publicDir = path.join(cwd, config.server?.static || 'dist');

  if (fs.existsSync(componentsDir)) {
    console.log('Compiling frontend components...');
    compileFrontend(componentsDir, publicDir, cwd)
      .then(compiled => {
        if (compiled.length > 0) {
          compiled.forEach(name => console.log(`  ✓ ${name}.ui`));
        }
        console.log('');
        runBackend(path.join(cwd, apiFile));
      })
      .catch(err => {
        console.error('Frontend compilation error:', err.message);
        process.exit(1);
      });
  } else {
    runBackend(path.join(cwd, apiFile));
  }

  function runBackend(fullPath) {
    const code = fs.readFileSync(fullPath, 'utf8');

    try {
      const compiled = compile(code, {
        filename: path.basename(fullPath),
        basePath: path.dirname(fullPath)
      });

      const runtime = createRuntime({
        basePath: path.dirname(fullPath)
      });

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('runtime', 'require', '__dirname', '__filename', compiled);

      fn(runtime, require, path.dirname(fullPath), fullPath).catch(err => {
        console.error('Runtime error:', err);
        process.exit(1);
      });

    } catch (error) {
      console.error('Backend compilation error:', error.message);
      process.exit(1);
    }
  }

} else if (command === 'watch') {
  // Watch mode: cslop watch
  // Like Vite - hot reload for .ui files, server restart for .slop files

  const cwd = process.cwd();
  const configPath = path.join(cwd, 'slop.json');

  if (!fs.existsSync(configPath)) {
    console.error('Error: slop.json not found in current directory');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const componentsDir = path.join(cwd, 'components');
  const publicDir = path.join(cwd, config.server?.static || 'dist');
  const wsPort = 35729; // Live reload WebSocket port

  // Find API file
  const apiFile = fs.readdirSync(cwd).find(f => f.endsWith('.slop'));
  if (!apiFile) {
    console.error('Error: No .slop file found in current directory');
    process.exit(1);
  }

  console.log('\x1b[36m');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║         C-slop Watch Mode             ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('\x1b[0m');

  // WebSocket server for live reload
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ port: wsPort });
  let wsClients = [];

  wss.on('connection', (ws) => {
    wsClients.push(ws);
    ws.on('close', () => {
      wsClients = wsClients.filter(c => c !== ws);
    });
  });

  function notifyClients(type, file) {
    const message = JSON.stringify({ type, file });
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Inject live reload script into HTML files
  function injectLiveReload(publicDir) {
    const liveReloadScript = `
<script>
(function() {
  const ws = new WebSocket('ws://localhost:${wsPort}');
  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'reload') {
      console.log('[C-slop] Reloading...', data.file);
      location.reload();
    } else if (data.type === 'css') {
      console.log('[C-slop] CSS updated:', data.file);
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        link.href = link.href.split('?')[0] + '?t=' + Date.now();
      });
    }
  };
  ws.onopen = () => console.log('[C-slop] Hot reload connected');
  ws.onclose = () => console.log('[C-slop] Hot reload disconnected, retrying...');
})();
</script>
</head>`;

    // Find and modify index.html
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      if (!html.includes('ws://localhost:' + wsPort)) {
        html = html.replace('</head>', liveReloadScript);
        fs.writeFileSync(indexPath, html);
        console.log('  \x1b[32m✓\x1b[0m Injected live reload script');
      }
    }
  }

  // Compile a single .ui file
  async function compileUIFile(filePath) {
    const frontendDir = path.join(__dirname, '..', 'frontend');
    const { parseComponent } = await import(path.join(frontendDir, 'parser.js'));
    const { generateCode } = await import(path.join(frontendDir, 'codegen.js'));

    const source = fs.readFileSync(filePath, 'utf8');
    const name = path.basename(filePath, '.ui');

    const ast = parseComponent(source);
    const { js, css } = generateCode(ast, name);

    const jsDir = path.join(publicDir, 'js');
    const cssDir = path.join(publicDir, 'css');
    fs.mkdirSync(jsDir, { recursive: true });
    fs.mkdirSync(cssDir, { recursive: true });

    fs.writeFileSync(path.join(jsDir, `${name}.js`), js);
    fs.writeFileSync(path.join(cssDir, `${name}.css`), css);

    return name;
  }

  // Backend server process
  let serverProcess = null;

  function startServer() {
    const apiPath = path.join(cwd, apiFile);

    // Create a temporary runner script
    const runnerCode = `
const { compile } = require('./compiler');
const { createRuntime } = require('./runtime');
const fs = require('fs');
const path = require('path');

const fullPath = '${apiPath.replace(/\\/g, '\\\\')}';
const code = fs.readFileSync(fullPath, 'utf8');

try {
  const compiled = compile(code, {
    filename: path.basename(fullPath),
    basePath: path.dirname(fullPath)
  });

  const runtime = createRuntime({
    basePath: path.dirname(fullPath)
  });

  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction('runtime', 'require', '__dirname', '__filename', compiled);

  fn(runtime, require, path.dirname(fullPath), fullPath).catch(err => {
    console.error('Runtime error:', err);
    process.exit(1);
  });

} catch (error) {
  console.error('Backend compilation error:', error.message);
  process.exit(1);
}
`;

    const runnerPath = path.join(__dirname, '.runner.tmp.js');
    fs.writeFileSync(runnerPath, runnerCode);

    serverProcess = spawn('node', [runnerPath], {
      stdio: 'inherit',
      cwd: __dirname
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log('  \x1b[31m✗\x1b[0m Server crashed, waiting for changes...');
      }
    });
  }

  function restartServer() {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    setTimeout(() => {
      console.log('  \x1b[33m↻\x1b[0m Restarting server...');
      startServer();
    }, 100);
  }

  // Watch .ui files
  function watchComponents() {
    if (!fs.existsSync(componentsDir)) return;

    console.log(`  \x1b[34m◉\x1b[0m Watching: components/*.ui`);

    fs.watch(componentsDir, { persistent: true }, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.ui')) return;

      const filePath = path.join(componentsDir, filename);
      if (!fs.existsSync(filePath)) return;

      console.log(`  \x1b[33m↻\x1b[0m ${filename} changed`);

      try {
        const name = await compileUIFile(filePath);
        console.log(`  \x1b[32m✓\x1b[0m Compiled ${name}.ui`);
        notifyClients('reload', filename);
      } catch (err) {
        console.log(`  \x1b[31m✗\x1b[0m Error: ${err.message}`);
      }
    });
  }

  // Watch .slop files
  function watchBackend() {
    console.log(`  \x1b[34m◉\x1b[0m Watching: *.slop`);

    const slopFiles = fs.readdirSync(cwd).filter(f => f.endsWith('.slop'));

    slopFiles.forEach(file => {
      const filePath = path.join(cwd, file);
      fs.watch(filePath, { persistent: true }, async (eventType) => {
        if (eventType === 'change') {
          console.log(`  \x1b[33m↻\x1b[0m ${file} changed`);

          // If router.slop changed, recompile it
          if (file === 'router.slop') {
            try {
              await compileRouter();
              console.log(`  \x1b[32m✓\x1b[0m Compiled router.slop`);
              notifyClients('reload', file);
            } catch (err) {
              console.log(`  \x1b[31m✗\x1b[0m router.slop: ${err.message}`);
            }
          } else {
            // Backend API file changed - restart server
            restartServer();
            // Also notify clients to reload (API might have changed)
            setTimeout(() => notifyClients('reload', file), 500);
          }
        }
      });
    });
  }

  // Compile router.slop if it exists
  async function compileRouter() {
    const routerPath = path.join(cwd, 'router.slop');
    if (!fs.existsSync(routerPath)) return null;

    const frontendDir = path.join(__dirname, '..', 'frontend');
    const { parseRouter } = await import(path.join(frontendDir, 'router-parser.js'));
    const { generateRouterCode } = await import(path.join(frontendDir, 'router-codegen.js'));

    const routerSource = fs.readFileSync(routerPath, 'utf8');
    const routes = parseRouter(routerSource);
    const routerJs = generateRouterCode(routes);

    const jsDir = path.join(publicDir, 'js');
    fs.mkdirSync(jsDir, { recursive: true });
    fs.writeFileSync(path.join(jsDir, 'router-config.js'), routerJs);

    return 'router-config';
  }

  // Initial compile
  async function initialCompile() {
    // Ensure CSS directory exists
    const cssDir = path.join(publicDir, 'css');
    fs.mkdirSync(cssDir, { recursive: true });

    // Copy SlopUI CSS files
    const slopuiDir = path.join(__dirname, '..', 'slopui');
    const baseCSS = path.join(slopuiDir, 'base.css');
    const componentsCSS = path.join(slopuiDir, 'components.css');

    if (fs.existsSync(baseCSS) && fs.existsSync(componentsCSS)) {
      const baseCSSContent = fs.readFileSync(baseCSS, 'utf8');
      const componentsCSSContent = fs.readFileSync(componentsCSS, 'utf8');
      const slopuiCSS = `${baseCSSContent}\n\n${componentsCSSContent}`;
      fs.writeFileSync(path.join(cssDir, 'slopui.css'), slopuiCSS);
      console.log('  \x1b[32m✓\x1b[0m slopui.css');
    }

    // Generate theme CSS from slop.json config
    const configPath = path.join(cwd, 'slop.json');
    if (fs.existsSync(configPath)) {
      try {
        const projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (projectConfig.theme) {
          const { generateThemeCSS } = require(path.join(slopuiDir, 'theme.js'));
          const themeCSS = generateThemeCSS(projectConfig.theme);
          fs.writeFileSync(path.join(cssDir, 'theme.css'), themeCSS);
          console.log('  \x1b[32m✓\x1b[0m theme.css');
        }
      } catch (err) {
        console.log(`  \x1b[33m⚠\x1b[0m theme.css: ${err.message}`);
      }
    }

    if (fs.existsSync(componentsDir)) {
      console.log('  Compiling frontend components...');
      const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.ui'));

      for (const file of files) {
        try {
          const name = await compileUIFile(path.join(componentsDir, file));
          console.log(`  \x1b[32m✓\x1b[0m ${name}.ui`);
        } catch (err) {
          console.log(`  \x1b[31m✗\x1b[0m ${file}: ${err.message}`);
        }
      }

      // Copy runtime files (including router.js)
      const runtimeDir = path.join(__dirname, '..', 'runtime');
      const runtimeFiles = ['signals.js', 'dom.js', 'router.js'];
      for (const file of runtimeFiles) {
        const src = path.join(runtimeDir, file);
        const dest = path.join(publicDir, 'js', file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Compile router.slop if it exists
    try {
      const routerName = await compileRouter();
      if (routerName) {
        console.log(`  \x1b[32m✓\x1b[0m router.slop`);
      }
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m router.slop: ${err.message}`);
    }

    // Inject live reload script
    injectLiveReload(publicDir);

    console.log('');
    console.log(`  \x1b[32m✓\x1b[0m Live reload on ws://localhost:${wsPort}`);
  }

  // Start everything
  initialCompile().then(() => {
    watchComponents();
    watchBackend();
    console.log('');
    startServer();
  }).catch(err => {
    console.error('Error during initial compile:', err);
    process.exit(1);
  });

  // Cleanup function
  let isCleaningUp = false;
  function cleanup() {
    if (isCleaningUp) return;
    isCleaningUp = true;

    console.log('\n  Shutting down...');

    // Kill server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }

    // Close WebSocket server
    try {
      wss.close();
    } catch (e) {}

    // Clean up temp runner
    const runnerPath = path.join(__dirname, '.runner.tmp.js');
    if (fs.existsSync(runnerPath)) {
      try {
        fs.unlinkSync(runnerPath);
      } catch (e) {}
    }

    process.exit(0);
  }

  // Handle all exit scenarios
  process.on('SIGINT', cleanup);   // Ctrl+C
  process.on('SIGTERM', cleanup);  // kill command
  process.on('SIGHUP', cleanup);   // terminal closed
  process.stdin.on('end', cleanup); // Ctrl+D (EOF)
  process.on('exit', () => {
    // Last resort cleanup (sync only)
    if (serverProcess) serverProcess.kill('SIGTERM');
  });

} else if (command === 'create') {
  // Create mode: cslop create <project-name>
  const projectName = args[1];

  if (!projectName) {
    console.error('Usage: cslop create <project-name>');
    console.error('Example: cslop create my-app');
    process.exit(1);
  }

  // Validate project name (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(projectName)) {
    console.error('Error: Project name must start with a letter and contain only letters, numbers, hyphens, and underscores');
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`Error: Directory '${projectName}' already exists`);
    process.exit(1);
  }

  console.log('\x1b[36m');
  console.log('  Creating new C-slop project...');
  console.log('\x1b[0m');

  // Create directory structure
  fs.mkdirSync(projectPath);
  fs.mkdirSync(path.join(projectPath, 'components'));
  fs.mkdirSync(path.join(projectPath, 'dist'));
  fs.mkdirSync(path.join(projectPath, 'dist', 'js'));
  fs.mkdirSync(path.join(projectPath, 'dist', 'css'));

  // Template: slop.json
  const slopJson = {
    name: projectName,
    database: {
      type: 'memory'
    },
    server: {
      port: 3000,
      static: './dist'
    },
    theme: {
      light: {
        primary: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      dark: {
        primary: '#60a5fa',
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#f87171'
      }
    }
  };
  fs.writeFileSync(
    path.join(projectPath, 'slop.json'),
    JSON.stringify(slopJson, null, 2)
  );
  console.log('  \x1b[32m✓\x1b[0m slop.json');

  // Template: api.slop
  const apiSlop = `// API Routes

// Health check
*/api/health > #json({status: "ok"})

// Example: Get all items
*/api/items > @items > #json

// Example: Create item
*/api/items + @items!$.body > #json
`;
  fs.writeFileSync(path.join(projectPath, 'api.slop'), apiSlop);
  console.log('  \x1b[32m✓\x1b[0m api.slop');

  // Template: router.slop
  const routerSlop = `// Router Configuration
// Syntax: /path > @@Component

/ > @@Home
/counter > @@Counter
`;
  fs.writeFileSync(path.join(projectPath, 'router.slop'), routerSlop);
  console.log('  \x1b[32m✓\x1b[0m router.slop');

  // Template: components/Home.ui
  const homeUi = `// Home - Landing Page

<?

.container.text-center.py-8
  h1["Welcome to ${projectName}"]
  p.text-secondary["A C-slop application with SlopUI"]
  .flex.gap-4.justify-center.mt-6
    a.btn.btn-primary["Go to Counter" @nav(/counter)]
    button.btn.btn-secondary["Toggle Theme" @click(toggleTheme)]
`;
  fs.writeFileSync(path.join(projectPath, 'components', 'Home.ui'), homeUi);
  console.log('  \x1b[32m✓\x1b[0m components/Home.ui');

  // Template: components/Counter.ui
  const counterUi = `// Counter - Example Component

$count:0

<?

.container.text-center.py-8
  .card.mx-auto
    h1["Count: @{$count}"]
    .flex.gap-2.justify-center.mt-4
      button.btn.btn-secondary["-" @click($count--)]
      button.btn.btn-outline["Reset" @click($count:0)]
      button.btn.btn-primary["+" @click($count++)]
  .mt-6
    a.btn.btn-ghost["Back to Home" @nav(/)]
`;
  fs.writeFileSync(path.join(projectPath, 'components', 'Counter.ui'), counterUi);
  console.log('  \x1b[32m✓\x1b[0m components/Counter.ui');

  // Template: dist/index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <!-- SlopUI CSS -->
  <link rel="stylesheet" href="/css/slopui.css">
  <link rel="stylesheet" href="/css/theme.css">
  <!-- Component CSS -->
  <link rel="stylesheet" href="/css/Home.css">
  <link rel="stylesheet" href="/css/Counter.css">
</head>
<body>
  <div id="app"></div>
  <script>
    // Theme toggle function (available globally)
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
      localStorage.setItem('theme', html.getAttribute('data-theme'));
    }

    // Apply saved theme on load
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  </script>
  <script type="module">
    import { createRouter } from '/js/router-config.js';
    createRouter(document.getElementById('app'));
  </script>
</body>
</html>
`;
  fs.writeFileSync(path.join(projectPath, 'dist', 'index.html'), indexHtml);
  console.log('  \x1b[32m✓\x1b[0m dist/index.html');

  // Copy runtime files (including router.js)
  const runtimeDir = path.join(__dirname, '..', 'runtime');
  const runtimeFiles = ['signals.js', 'dom.js', 'router.js'];
  for (const file of runtimeFiles) {
    const src = path.join(runtimeDir, file);
    const dest = path.join(projectPath, 'dist', 'js', file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  \x1b[32m✓\x1b[0m dist/js/${file}`);
    }
  }

  // Copy SlopUI CSS files
  const slopuiDir = path.join(__dirname, '..', 'slopui');
  const baseCSS = path.join(slopuiDir, 'base.css');
  const componentsCSS = path.join(slopuiDir, 'components.css');

  if (fs.existsSync(baseCSS) && fs.existsSync(componentsCSS)) {
    const baseCSSContent = fs.readFileSync(baseCSS, 'utf8');
    const componentsCSSContent = fs.readFileSync(componentsCSS, 'utf8');
    const slopuiCSS = `${baseCSSContent}\n\n${componentsCSSContent}`;
    fs.writeFileSync(path.join(projectPath, 'dist', 'css', 'slopui.css'), slopuiCSS);
    console.log('  \x1b[32m✓\x1b[0m dist/css/slopui.css');
  }

  // Generate theme CSS from config
  const { generateThemeCSS } = require(path.join(slopuiDir, 'theme.js'));
  const themeCSS = generateThemeCSS(slopJson.theme);
  fs.writeFileSync(path.join(projectPath, 'dist', 'css', 'theme.css'), themeCSS);
  console.log('  \x1b[32m✓\x1b[0m dist/css/theme.css');

  // Create reference.md
  const referenceMd = `# C-slop Reference

## Project Structure

\`\`\`
project/
├── slop.json          # Configuration
├── api.slop           # Backend API routes
├── router.slop        # Frontend routing config
├── components/        # Frontend UI components
│   ├── Home.ui        # Home page component
│   └── *.ui           # Other components
└── dist/              # Compiled output
    ├── index.html     # Entry HTML
    ├── js/            # Compiled JS + runtime
    └── css/           # Compiled CSS
\`\`\`

## Commands

\`\`\`bash
cslop create <name>    # Create new project
cslop watch            # Dev server with hot reload
cslop start            # Production server
cslop build <file>     # Compile .slop to JS
\`\`\`

---

## Backend (.slop files)

### Routes

\`\`\`
*/ > #json({status:"ok"})              // GET /
*/users > @users > #json               // GET /users
*/users/:id > @users[$.id] > #json     // GET /users/:id with param
*/users + @users!$.body > #json        // POST /users
*/users/:id ^ @users[$.id]!$.body > #json  // PUT /users/:id
*/users/:id - @users[$.id]!- > #204    // DELETE /users/:id
\`\`\`

### Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| \`*\` | Route | \`*/api/users\` |
| \`+\` | POST method | \`*/users +\` |
| \`^\` | PUT method | \`*/users/:id ^\` |
| \`-\` | DELETE method | \`*/users/:id -\` |
| \`@\` | Database table | \`@users\` |
| \`$\` | Request data | \`$.body\`, \`$.id\`, \`$.query\` |
| \`#\` | Response | \`#json\`, \`#html\`, \`#201\` |
| \`>\` | Pipeline | \`@users > #json\` |
| \`?\` | Filter | \`@users?{active:true}\` |
| \`!\` | Mutation | \`@users!$.body\` (insert) |

### Request Data (\`$\`)

\`\`\`
$.id              // URL param :id
$.body            // Request body (POST/PUT)
$.query.search    // Query string ?search=...
$.headers.auth    // Request headers
\`\`\`

### Database Operations (\`@\`)

\`\`\`
@users                    // Get all
@users[123]               // Get by ID
@users[$.id]              // Get by param
@users?{active:true}      // Filter
@users!$.body             // Insert
@users[$.id]!$.body       // Update
@users[$.id]!-            // Delete
\`\`\`

### Responses (\`#\`)

\`\`\`
#json(data)       // JSON response
#json             // Pipe data as JSON
#html(content)    // HTML response
#201              // Status code
#404              // Not found
#400("message")   // Status with message
\`\`\`

---

## Frontend (.ui files)

### File Structure

\`\`\`
// Comment

$state:0             // State declaration
$computed := expr    // Computed state
~ effect             // Side effect

<?                   // Template separator

div.class#id         // Markup (# here is ID selector)
  @@ChildComponent   // Use component (auto-imports)
\`\`\`

### Component References

\`\`\`
@@Counter            // Use Counter component (auto-imports)
@@UserList           // Use UserList component (auto-imports)
\`\`\`

### State

\`\`\`
$count:0             // Number
$name:""             // String
$items:[]            // Array
$user:{}             // Object
$active:true         // Boolean

$doubled := $count * 2    // Computed (reactive)
\`\`\`

### Effects

\`\`\`
~ fetch("/api/users") > $users              // Fetch and store
~ fetch("/api") > $data > $loading:false    // Chain assignments
~ $condition > doSomething                  // Conditional effect
\`\`\`

### Markup

\`\`\`
div                      // Element
.class                   // div with class
div.foo.bar              // Multiple classes
div#id                   // With ID
div.class#id             // Combined

div["text"]              // With text content
div["Count: @{$count}"]  // Reactive interpolation
h1["Hello"]              // Any HTML tag
\`\`\`

### Nesting (indentation-based)

\`\`\`
div.container
  h1["Title"]
  p["Paragraph"]
  div.nested
    span["Deep"]
\`\`\`

### Events

\`\`\`
button["Click" @click($count++)]         // Increment state
button["Click" @click($count--)]         // Decrement state
button["Reset" @click($count:0)]         // Assignment
button["Save" @click(saveData)]          // Call function
input[@input($text:e.target.value)]      // Input handler
form[@submit(handleSubmit)]              // Form submit
div[@mouseenter(show) @mouseleave(hide)] // Multiple events
\`\`\`

### Attributes

\`\`\`
// Static attribute (quoted string)
img[alt{"Profile picture"}]

// Dynamic attribute (from state)
img[src{$imageUrl}]

// Mixed static and dynamic
img[src{$imageUrl} alt{"User avatar"}]
a[href{$link} target{"_blank"}]
div[class{$activeClass} id{"main"}]
\`\`\`

### Navigation

\`\`\`
// @nav sets href and click handler automatically
a["Go to Counter" @nav(/counter)]
a["Home" @nav(/)]
button["Back" @nav(/)]
\`\`\`

### Conditionals

\`\`\`
? $loading
  p["Loading..."]

? $count > 10
  p["Big number!"]
\`\`\`

### Loops

\`\`\`
$users                   // Iterate over array
  .card
    h3[:name]            // Access item.name
    p[:email]            // Access item.email
\`\`\`

### Input Binding

\`\`\`
input[$name "Enter name"]     // Two-way bind to $name, placeholder text
input[$email "Email"]
\`\`\`

### API Actions in Events

\`\`\`
// POST and add to array
button["Add" @click(post:/api/users {name:$name} > $users + clear)]

// DELETE and remove from array
button["Delete" @click(delete:/api/users/:id > $users - :id)]
\`\`\`

---

## Routing (router.slop)

\`\`\`
// Syntax: /path > @@Component

/ > @@Home
/about > @@About
/users/:id > @@UserDetail
\`\`\`

Access route params in components:
\`\`\`
// UserDetail.ui - $route.params.id contains the :id value
h1["User: @{$route.params.id}"]
\`\`\`

---

## Configuration (slop.json)

\`\`\`json
{
  "name": "my-app",
  "database": {
    "type": "memory",
    "connection": "./app.db"
  },
  "server": {
    "port": 3000,
    "static": "./dist"
  },
  "theme": {
    "light": {
      "primary": "#3b82f6",
      "success": "#22c55e",
      "warning": "#f59e0b",
      "error": "#ef4444"
    },
    "dark": {
      "primary": "#60a5fa",
      "success": "#4ade80",
      "warning": "#fbbf24",
      "error": "#f87171"
    }
  }
}
\`\`\`

---

## SlopUI (CSS Library)

SlopUI is included automatically. Just use the classes in your components.

### Theme Toggle

\`\`\`javascript
// Built-in toggleTheme() function
button["Toggle Theme" @click(toggleTheme)]
\`\`\`

Theme is stored in localStorage and persists across page loads.

### Buttons

\`\`\`
button.btn["Default"]
button.btn.btn-primary["Primary"]
button.btn.btn-secondary["Secondary"]
button.btn.btn-success["Success"]
button.btn.btn-warning["Warning"]
button.btn.btn-error["Error"]
button.btn.btn-ghost["Ghost"]
button.btn.btn-outline["Outline"]
button.btn.btn-sm["Small"]
button.btn.btn-lg["Large"]
\`\`\`

### Cards

\`\`\`
.card
  .card-header
    h3.card-title["Title"]
  .card-body
    p["Content"]
  .card-footer
    button.btn["Action"]
\`\`\`

### Inputs

\`\`\`
input.input["placeholder"]
input.input.input-error["with error"]
textarea.textarea["message"]
select.select
  option["Option 1"]
\`\`\`

### Badges & Alerts

\`\`\`
span.badge["Default"]
span.badge.badge-primary["Primary"]
span.badge.badge-success["Success"]

.alert.alert-info["Information message"]
.alert.alert-success["Success message"]
.alert.alert-warning["Warning message"]
.alert.alert-error["Error message"]
\`\`\`

### Layout Utilities

\`\`\`
// Containers
.container              // Max 1200px centered
.container-sm           // Max 640px
.container-md           // Max 768px

// Flexbox
.flex                   // display: flex
.flex-col               // flex-direction: column
.items-center           // align-items: center
.justify-center         // justify-content: center
.justify-between        // justify-content: space-between
.gap-2                  // gap: 0.5rem
.gap-4                  // gap: 1rem

// Spacing
.p-4                    // padding: 1rem
.px-4                   // padding-left/right: 1rem
.py-4                   // padding-top/bottom: 1rem
.m-4                    // margin: 1rem
.mt-4                   // margin-top: 1rem
.mx-auto                // margin-left/right: auto

// Text
.text-center            // text-align: center
.text-primary           // color: var(--primary)
.text-secondary         // color: var(--text-secondary)
.text-sm                // font-size: 0.875rem
.font-bold              // font-weight: 700
\`\`\`

### Tables

\`\`\`
table.table
  thead
    tr
      th["Name"]
      th["Email"]
  tbody
    tr
      td["John"]
      td["john@example.com"]
\`\`\`

### Navbar

\`\`\`
nav.navbar
  .navbar-brand
    a["My App"]
  .navbar-menu
    a.navbar-item["Home" @nav(/)]
    a.navbar-item["About" @nav(/about)]
\`\`\`

---

## Quick Examples

### Simple Counter (Counter.ui)

\`\`\`
$count:0

<?

.counter
  h1["Count: @{$count}"]
  button["-" @click($count--)]
  button["+" @click($count++)]
\`\`\`

### User List with API (UserList.ui)

\`\`\`
$users:[]
$name:""
$loading:true

~ fetch("/api/users") > $users > $loading:false

<?

.container
  input[$name "Name"]
  button["Add" @click(post:/api/users {name:$name} > $users + clear)]

  ? $loading
    p["Loading..."]

  $users
    .card
      span[:name]
      button["X" @click(delete:/api/users/:id > $users - :id)]
\`\`\`

### API Routes (api.slop)

\`\`\`
// Health check
*/ > #json({status:"ok"})

// CRUD for users
*/api/users > @users > #json
*/api/users + @users!$.body > #json
*/api/users/:id - @users[$.id]!- > #json
\`\`\`
`;
  fs.writeFileSync(path.join(projectPath, 'reference.md'), referenceMd);
  console.log('  \x1b[32m✓\x1b[0m reference.md');

  // Create .gitignore
  const gitignore = `node_modules/
dist/
*.db
.DS_Store
`;
  fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);
  console.log('  \x1b[32m✓\x1b[0m .gitignore');

  // Copy C-slop skill for AI assistants (Claude Code, OpenCode)
  const skillSrcDir = path.join(__dirname, '..', '..', '.opencode', 'skills', 'c-slop');
  if (fs.existsSync(skillSrcDir)) {
    // Create .claude/skills/c-slop directory
    const claudeSkillDir = path.join(projectPath, '.claude', 'skills', 'c-slop');
    fs.mkdirSync(claudeSkillDir, { recursive: true });

    // Copy SKILL.md
    const skillFile = path.join(skillSrcDir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      fs.copyFileSync(skillFile, path.join(claudeSkillDir, 'SKILL.md'));
      console.log('  \x1b[32m✓\x1b[0m .claude/skills/c-slop/SKILL.md');
    }
  }

  console.log('');
  console.log('\x1b[32m  ✓ Project created successfully!\x1b[0m');
  console.log('');
  console.log('  Next steps:');
  console.log(`    cd ${projectName}`);
  console.log('    cslop watch');
  console.log('');
  console.log('  Then open http://localhost:3000 in your browser');
  console.log('');

} else if (command === 'build') {
  // Build mode: cslop build file.slop -o output.js
  const filePath = args[1];
  const outputPath = args[3] || filePath.replace('.slop', '.js');

  if (!filePath) {
    console.error('Error: Please provide a .slop file');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const code = fs.readFileSync(fullPath, 'utf8');

  try {
    const compiled = compile(code, {
      filename: filePath,
      basePath: path.dirname(fullPath)
    });

    fs.writeFileSync(outputPath, compiled);
    console.log(`Compiled ${filePath} -> ${outputPath}`);

  } catch (error) {
    console.error('Compilation error:', error.message);
    process.exit(1);
  }

} else if (command === 'run' || command.endsWith('.slop')) {
  // Run mode: cslop run file.slop or cslop file.slop
  const filePath = command.endsWith('.slop') ? command : args[1];

  if (!filePath) {
    console.error('Error: Please provide a .slop file');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const code = fs.readFileSync(fullPath, 'utf8');

  try {
    const compiled = compile(code, {
      filename: filePath,
      basePath: path.dirname(fullPath)
    });

    // Execute the compiled code with runtime
    const runtime = createRuntime({
      basePath: path.dirname(fullPath)
    });

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('runtime', 'require', '__dirname', '__filename', compiled);

    fn(runtime, require, path.dirname(fullPath), fullPath).catch(err => {
      console.error('Runtime error:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('Compilation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
