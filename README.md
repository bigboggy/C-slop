# C-slop

A token-minimal programming language for full-stack web applications. Write web apps in 80% fewer tokens.

## What is C-slop?

C-slop is designed for **machine efficiency** - minimizing tokens while maintaining expressiveness. It provides:

- **Backend**: Express.js API routes with database operations
- **Frontend**: Reactive UI components with signals
- **Routing**: Client-side SPA navigation

## Quick Start

```bash
# Install
cd compiler && npm install && npm link

# Create a new project
cslop create my-app
cd my-app

# Start dev server with hot reload
cslop watch
```

Visit `http://localhost:3000`

## OpenCode Skill (AI Assistant Support)

This repository includes an **OpenCode skill** for C-slop located at `.opencode/skills/c-slop/SKILL.md`. This skill helps AI assistants (like OpenCode, Claude, etc.) understand C-slop's syntax and provide better assistance.

### What is it?

The skill is a quick reference guide containing:
- Symbol glossary (`@`, `$`, `#`, `>`, etc.)
- Backend syntax for `.slop` files
- Frontend syntax for `.ui` files
- Common patterns and examples
- Command reference

### Installation

To use the skill in your own project:

```bash
# Option 1: Project-local (recommended)
cp -r .opencode/skills/c-slop /path/to/your/project/.opencode/skills/

# Option 2: Global installation
cp -r .opencode/skills/c-slop ~/.config/opencode/skills/

# Option 3: Claude-compatible
cp -r .opencode/skills/c-slop ~/.claude/skills/
```

### Why use it?

The skill provides AI assistants with context about C-slop, enabling them to:
- Understand the symbol-based syntax
- Write correct `.slop` and `.ui` files
- Suggest appropriate patterns
- Explain error messages

For complete documentation, see the skill file or read `C-SLOP.md` and `USAGE.md`.

## Project Structure

```
my-app/
├── slop.json          # Configuration
├── api.slop           # Backend API routes
├── router.slop        # Frontend routing
├── components/        # UI components
│   ├── Home.ui
│   └── Counter.ui
└── dist/              # Compiled output
```

## Backend (.slop files)

```cslop
# REST API in a few lines
*/ > #json({message: "Hello!"})

*/users > @users > #json

*/users/:id > @users[$.id] > #json

*/users + @users!$.body > #json

*/users/:id - @users[$.id]!- > #204
```

### Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| `*` | Route | `*/api/users` |
| `+` | POST | `*/users +` |
| `^` | PUT | `*/users/:id ^` |
| `-` | DELETE | `*/users/:id -` |
| `@` | Database | `@users` |
| `$` | Request | `$.body`, `$.id` |
| `#` | Response | `#json`, `#201` |
| `>` | Pipeline | `@users > #json` |

## Frontend (.ui files)

```
# Counter.ui - Reactive component
$count:0

<?

.counter
  h1["Count: @{$count}"]
  button["+" @click($count++)]
  button["-" @click($count--)]
```

### State & Effects

```
$count:0                    # Reactive state
$doubled := $count * 2      # Computed value
~ fetch("/api") > $data     # Effect (runs on mount)
```

### Events

```
button["Click" @click($count++)]      # Increment
button["Save" @click(handleSave)]     # Call function
input[@input($text:e.target.value)]   # Input handler
form[@submit(handleSubmit)]           # Form submit
```

### Attributes

```
img[src{$imageUrl} alt{"Avatar"}]     # Dynamic src, static alt
a[href{$link} target{"_blank"}]       # Mixed attributes
div[class{$activeClass}]              # Dynamic class
```

### Components

```
@@Counter                   # Use component (auto-imports)
@@UserList
```

## Routing (router.slop)

```
# Client-side SPA routing
/ > @@Home
/counter > @@Counter
/users/:id > @@UserDetail
```

### Navigation

```
# @nav sets href and click handler automatically
a["Go to Counter" @nav(/counter)]
button["Back" @nav(/)]
```

## Commands

```bash
cslop create <name>    # Create new project
cslop watch            # Dev server + hot reload
cslop start            # Production server
cslop <file.slop>      # Run a .slop file
cslop build <file>     # Compile to JS
```

## Documentation

- [Language Specification](./C-SLOP.md)
- [Frontend Status](./compiler/FRONTEND-STATUS.md)
- [Database Guide](./DATABASE-GUIDE.md)
- [Online Docs](https://c-slop.dev)

## SlopUI (CSS Library)

SlopUI is a built-in CSS library included automatically in all projects.

### Theme Support

Dark/light mode with localStorage persistence:

```
button["Toggle Theme" @click(toggleTheme)]
```

Configure colors in `slop.json`:

```json
{
  "theme": {
    "light": { "primary": "#3b82f6", "success": "#22c55e" },
    "dark": { "primary": "#60a5fa", "success": "#4ade80" }
  }
}
```

### Components

```
# Buttons
button.btn.btn-primary["Primary"]
button.btn.btn-secondary["Secondary"]
button.btn.btn-success["Success"]
button.btn.btn-ghost["Ghost"]
button.btn.btn-outline["Outline"]

# Cards
.card
  h3.card-title["Title"]
  .card-body
    p["Content"]

# Inputs
input.input["Placeholder"]
textarea.textarea["Message"]

# Alerts
.alert.alert-info["Info message"]
.alert.alert-success["Success!"]
.alert.alert-error["Error!"]

# Badges
span.badge.badge-primary["New"]
```

### Layout Utilities

```
# Flexbox
.flex .flex-col .items-center .justify-center .justify-between
.gap-2 .gap-4 .gap-6

# Spacing
.p-4 .px-4 .py-4 .m-4 .mt-4 .mx-auto

# Text
.text-center .text-primary .text-secondary .font-bold

# Containers
.container .container-sm .container-md
```

## Configuration (slop.json)

```json
{
  "name": "my-app",
  "database": {
    "type": "memory"
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
```

Database types: `memory`, `sqlite`

## Architecture

```
compiler/
├── src/
│   ├── cli.js        # CLI commands
│   ├── compiler.js   # Backend parser
│   └── runtime.js    # Express wrapper
├── frontend/
│   ├── parser.js     # .ui parser
│   ├── codegen.js    # JS generator
│   ├── router-parser.js
│   └── router-codegen.js
├── runtime/
│   ├── signals.js    # Reactive signals (~1.5KB)
│   ├── dom.js        # DOM helpers (~1KB)
│   └── router.js     # Client-side router
└── slopui/
    ├── base.css      # CSS reset & utilities
    ├── components.css # Component styles
    └── theme.js      # Theme generator
```

## License

MIT
