---
name: c-slop
description: Token-minimal programming language for full-stack web apps using symbols (@, $, #, >) instead of keywords - reduces code by 75-82% compared to JavaScript
license: MIT
compatibility: opencode
metadata:
  author: Oorosh
  original-project: C-slop
  original-author: bigboggy
  repo: https://github.com/bigboggy/C-slop
  website: https://c-slop.dev
---

# C-slop OpenCode Skill

This skill helps OpenCode agents understand and work with C-slop, a token-optimized programming language for full-stack web applications.

## What is C-slop?

C-slop is designed for **machine efficiency** - minimizing tokens while maintaining expressiveness. It provides:

- **Backend**: Express.js API routes with database operations
- **Frontend**: Reactive UI components with signals
- **Routing**: Client-side SPA navigation

**Token Savings**: 75-82% fewer tokens than JavaScript

## Quick Reference

### Symbol Glossary

| Symbol | Meaning | Example |
|--------|---------|---------|
| `*` | Route definition | `*/users` |
| `+` | POST method | `*/users +` |
| `^` | PUT method | `*/users/:id ^` |
| `-` | DELETE method | `*/users/:id -` |
| `@` | Database table | `@users` |
| `$` | Request/Input data | `$.body`, `$.id` |
| `#` | Response/Output | `#json`, `#201` |
| `>` | Pipeline operator | `@users > #json` |
| `?` | Query/Filter | `@users?{active:true}` |
| `!` | Action/Mutation | `@users!$.body` |
| `~` | PUT method (backend) / Effect (frontend) | `~ fetch("/api")` |
| `<?` | Template separator (UI) | Separates state from markup |
| `@@` | Component usage | `@@Counter` |
| `:=` | Computed value | `$doubled := $count * 2` |

## File Types

| Extension | Purpose | Example |
|-----------|---------|---------|
| `.slop` | Backend API routes | `api.slop` |
| `.ui` | Frontend components | `Counter.ui` |
| `router.slop` | Client-side routing | `router.slop` |
| `slop.json` | Configuration | Project settings |

## Backend Syntax (.slop files)

### Routes

```cslop
# GET routes - fetch data
*/ > #json({message: "Hello!"})
*/users > @users > #json
*/users/:id > @users[$.id] > #json

# POST route - create
*/users + @users!$.body > #json

# PUT route - update
*/users/:id ~ @users[$.id]!$.body > #json

# DELETE route
*/users/:id - @users[$.id]!- > #204
```

### Database Operations

```cslop
@users                      # Select all
@users[123]                 # Select by ID
@users[$.id]                # Select by request param
@users?{active:true}        # Filter
@users!{name:"Alice"}       # Insert
@users[123]!{name:"Bob"}    # Update
@users[123]!-               # Delete
```

### Request Data ($)

```cslop
$.body      # Request body
$.params    # URL parameters
$.id        # Shorthand for $.params.id
$.query     # Query string
$.headers   # Headers
```

### Response (#)

```cslop
#json(data)      # JSON response
#html(content)   # HTML response
#201             # Status code 201 Created
#204             # Status code 204 No Content
#404("Not found") # Status with message
```

### Pipeline Examples

```cslop
# Simple pipeline
@users > #json

# With filtering
@users?{active:true} > #json

# Create and return
@users!$.body > #json

# Error handling
@users[$.id] >| #404 > #json
```

## Frontend Syntax (.ui files)

### State Management

```cslop
$count:0                    # Reactive state
$doubled := $count * 2      # Computed value
~ fetch("/api") > $data     # Effect (runs on mount)
```

### Component Structure

```cslop
$count:0

<?

.counter
  h1["Count: @{$count}"]
  button["+" @click($count++)]
  button["-" @click($count--)]
```

### Template Syntax

```cslop
# Reactive interpolation
h1["Hello, @{$name}"]

# Event handlers
button["Click" @click($count++)]
input[@input($text:e.target.value)]
form[@submit(handleSubmit)]

# Dynamic attributes
img[src{$imageUrl} alt{"Avatar"}]
div[class{$activeClass}]

# Conditionals
? $loading
  p["Loading..."]
: $error
  p["Error!"]
: 
  p["Content"]

# Loops
ul
  @users >> 
    li["{@name} - {@email}"]
```

## Routing (router.slop)

```cslop
# Client-side SPA routing
/ > @@Home
/counter > @@Counter
/users/:id > @@UserDetail
```

Navigation:
```cslop
# Auto-generates href and click handler
a["Go to Counter" @nav(/counter)]
button["Back" @nav(/)]
```

## Complete CRUD Example

```cslop
# api.slop - Full REST API in 5 lines
*/users > @users > #json
*/users/:id > @users[$.id] > #json
*/users + @users!$.body > #json
*/users/:id ~ @users[$.id]!$.body > #json
*/users/:id - @users[$.id]!- > #204
```

## Commands

```bash
# Installation (from compiler/ directory)
cd compiler && npm install && npm link

# Create project
cslop create my-app

# Development server with hot reload
cslop watch

# Production server
cslop start

# Compile single file
cslop app.slop
cslop build app.slop -o out.js

# Run tests
cd compiler && npm test
```

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
      "success": "#22c55e"
    },
    "dark": {
      "primary": "#60a5fa",
      "success": "#4ade80"
    }
  }
}
```

## Common Patterns

### Authentication Middleware
```cslop
*/api/* > $.headers.auth ? {user:jwt?($.headers.auth)} : #401
```

### Validation
```cslop
*/users + {
  $.body.name ?? #400("name required")
  @users!$.body > #201
}
```

### Error Handling
```cslop
@users[$.id] >| #404 > #json
```

### Using Node Modules
```cslop
import axios from "axios"
*/github > axios.get("https://api.github.com") > #json
```

## Installation for OpenCode Users

### Method 1: Project-local (Recommended)
Copy this skill into your project:
```bash
# From C-slop repo root
cp -r .opencode/skills/c-slop /path/to/your/project/.opencode/skills/
```

### Method 2: Global installation
```bash
# Copy to global OpenCode config
cp -r .opencode/skills/c-slop ~/.config/opencode/skills/
```

### Method 3: Claude-compatible
```bash
# Copy to Claude skills directory
cp -r .opencode/skills/c-slop ~/.claude/skills/
```

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

## Resources

- **Full Language Spec**: `C-SLOP.md` in this repo
- **Usage Guide**: `USAGE.md` in this repo
- **Documentation**: https://c-slop.dev
- **Repository**: https://github.com/bigboggy/C-slop

## When to Use This Skill

Use this skill when:
- Working with `.slop` or `.ui` files
- Building CRUD APIs with minimal code
- Creating reactive web components
- Need quick reference for C-slop symbols and syntax

**Note**: This is a quick reference. For complete documentation, see `C-SLOP.md` and `USAGE.md` in this repository.
