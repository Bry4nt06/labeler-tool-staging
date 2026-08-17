# ServoForge Labeler Tool Architecture

## Overview

ServoForge is a web-based labeler tool for managing servo motor control profiles, bottle orientations, and manufacturing assembly planning (APL). The application is a single-page application (SPA) with a Node.js backend for authentication and persistence.

## Directory Structure

```
├── app.js                    # Frontend bootstrap loader (loads 22+ modules)
├── server.js                 # Node.js HTTP server, auth, API endpoints
├── index.html                # Main SPA entry point
├── admin.html                # Admin panel for user management
├── login.html                # Login form
├── service-worker.js         # Service worker for offline support
│
├── /app/                     # Frontend modules (220+ files)
│   ├── defaults.js           # Global defaults and constants
│   ├── persistence.js        # LocalStorage/data persistence layer
│   ├── simulation-engine.js  # Bottle simulation and physics
│   │
│   ├── Controllers/          # UI and state management
│   │   ├── setup-state-controller.js
│   │   ├── setup-event-controller-integration.js
│   │   └── ...
│   │
│   ├── APL/                  # Assembly Planning Logic (apl-*)
│   │   ├── apl-*-integration.js
│   │   ├── orientation-constraint-*.js
│   │   └── ...
│   │
│   ├── Bottle/               # Bottle orientation and geometry
│   │   ├── bottle-orientation-panel-integration.js
│   │   ├── bottle-selection-*.js
│   │   └── ...
│   │
│   ├── Cold Glue/            # Cold glue application logic
│   │   ├── cold-glue-*.js
│   │   ├── map-cold-glue-*.js
│   │   └── ...
│   │
│   ├── Community/            # Community library features
│   │   ├── community-library-*.js
│   │   └── community-admin-delete-v126.js
│   │
│   └── Features/             # Integration and optimization features
│       ├── map-runtime-service.js
│       ├── program-optimizer-integration.js
│       ├── servo-replay-integration.js
│       └── ...
│
├── /drivers/                 # Hardware/domain drivers
│   ├── profile/              # Profile generation and planning
│   ├── mechanical/           # Mechanical parameter drivers
│   └── ...
│
├── /tests/                   # Regression test suite (50+ tests)
│   ├── apl-*.test.js         # APL regression tests
│   ├── bottle-*.test.js      # Bottle orientation tests
│   ├── cold-glue-*.test.js   # Cold glue feature tests
│   └── bootstrap-*.test.js   # Bootstrap integration tests
│
├── /config/                  # Configuration files
├── /assets/                  # Static assets (images, icons)
├── /docs/                    # User and developer documentation
│
├── owner-recovery.js         # Owner password recovery script (runs on boot)
├── package.json              # No runtime dependencies, Node 20+
└── fault-config.json         # Machine fault limits and defaults
```

## Key Design Patterns

### 1. **Modular Script Loading** (`app.js`)
The frontend uses a custom script loader that:
- Loads 22+ modules in a specific dependency order
- Waits for async initialization promises (`ServoForgeReadyPromise`)
- Provides progress reporting to the startup progress bar
- Handles load failures gracefully with error boundaries

```javascript
// Example from app.js
await loadScript("app/bottle-orientation-panel-integration.js", version);
await window.ServoForgeBootstrapReady; // Wait for async modules
```

### 2. **Vanilla JavaScript (No Dependencies)**
All functionality is implemented without npm packages:
- **Pros**: Simple deployment, zero supply-chain risk
- **Cons**: Larger codebase, harder to maintain, no framework patterns

### 3. **State Management via Window Globals**
Modules attach to the `window` object:
```javascript
window.LabelerMapRuntimeService = { ... }
window.ServoForgeBootstrapReady = Promise.resolve()
```

### 4. **Persistence Layer** (`persistence.js`)
- Stores configuration in browser LocalStorage
- Syncs with optional server storage
- Includes audit trail logging (max 5000 rows)

### 5. **Server Authentication** (`server.js`)
- Session-based auth with 12-hour TTL
- Owner account (admin) created on first boot via `owner-recovery.js`
- Rate limiting on login (6 failures per 15 min)
- Role-based access: User vs. Admin

## Module Naming Conventions

Files follow a pattern that describes their function:

```
[domain]-[feature]-[type](-v[number])?(-[identifier])?.js
```

Examples:
- `apl-neck-final-post-wipe-continuity-integration.js` → APL feature integration
- `cold-glue-parameter-editor-integration.js` → UI integration
- `bottle-orientation-panel-integration.js` → UI panel
- `physical-wipe-direction-v125.js` → Versioned fix/feature
- `wipe-inner-bottle-spin-hotfix-v117.js` → Versioned hotfix

### Common Suffixes
- `*-integration.js` → Feature/module integration
- `*-driver.js` → Hardware or domain-specific driver
- `*-service.js` → Reusable service/utility
- `*-controller.js` → UI state or event controller
- `*-renderer.js` → Rendering logic
- `-v[N]` → Versioned feature or hotfix
- `-hotfix-v[N]` → Bug fix

## Feature Areas

### APL (Assembly Planning Logic)
Handles servo motor control profiles for bottle labeling. Manages:
- Wipe direction and orientation
- Sensor positioning
- Label centerline and datum
- Section handoffs and continuity

### Bottle Orientation
UI panel for visualizing and configuring bottle placement. Includes:
- 3D visualization (top-view mount)
- Physical wipe direction tracking (v125+)
- Orientation recovery

### Cold Glue
Application method for labels. Manages:
- Gripper channel and sequence planning
- Geometry generation and optimization
- Label application parameters

### Community Library
User-submitted label configurations. Features:
- Upload/download community maps
- Metadata management
- Admin moderation and deletion

## Testing Strategy

The test suite includes **50+ regression tests** covering:
- **APL logic** (orientation, datum flow, sensor placement)
- **Bootstrap integration** (module loading, initialization order)
- **Bottle orientation** (3D view, physical parameters)
- **Cold glue** (channel authority, map object authority)
- **Community features** (library v103 → v104 migration)

Tests are run via `node --test` and use `node:assert/strict` with inline validation.

## Server API Endpoints

### Authentication
- `POST /api/auth/setup` → Create owner account (once only)
- `POST /api/auth/login` → Authenticate user
- `POST /api/auth/logout` → End session
- `GET /api/auth/status` → Check session status

### Admin Endpoints (require admin role)
- `GET /api/admin/users` → List all users
- `POST /api/admin/users` → Create new user
- `DELETE /api/admin/users/:username` → Remove user
- `GET /api/admin/audit` → Audit log

### Data Endpoints
- `GET /api/data/:key` → Read persisted data
- `POST /api/data/:key` → Save data
- `DELETE /api/data/:key` → Delete data

## Deployment & Environment

- **Runtime**: Node.js 20+
- **Port**: Configurable via `PORT` env var (default: 3000)
- **Data**: Persisted to `/app/data` volume
- **Auth**: Optional owner recovery via `SERVOFORGE_OWNER_RESET_PASSWORD` env var
- **Start**: `npm start` runs `owner-recovery.js && node server.js`

## Known Limitations

1. **No bundler**: 22+ script tags load synchronously; consider bundling for faster page loads
2. **Global state**: Heavy use of `window` globals makes testing harder
3. **Monolithic**: 220 files with weak module boundaries; refactoring risks are high
4. **No types**: Vanilla JS with no TypeScript or JSDoc coverage
5. **Tests require full runtime**: Regression tests load all modules; slower than unit tests

## Future Improvements

- [ ] Bundle frontend with Rollup/esbuild
- [ ] Migrate to modular architecture (e.g., Web Components + ES modules)
- [ ] Add TypeScript for type safety
- [ ] Create comprehensive CHANGELOG for v-numbered features
- [ ] Consolidate duplicate versioned modules (v116→v125 timeline)
- [ ] Document which features are experimental vs. stable

