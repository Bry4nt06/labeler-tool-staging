"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const cart = fs.readFileSync(path.join(root, "app/community-library-cart-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

assert.ok(cart.includes('data-community-cart-add'), "Community cards must expose Add to Cart controls.");
assert.ok(cart.includes('id = "communityImportCart"'), "Community must create a dedicated cart window.");
assert.ok(cart.includes('position:fixed'), "Community cart must float independently while the library scrolls.");
assert.ok(cart.includes('right:18px'), "Community cart must remain docked to the right on desktop.");
assert.ok(cart.includes('data-community-cart-import-all'), "Community cart must provide Import All.");
assert.ok(cart.includes('data-community-cart-remove'), "Community cart must allow individual removal.");
assert.ok(cart.includes('data-community-cart-clear'), "Community cart must provide Clear.");
assert.ok(cart.includes('community.importPackage(data.package, "add")'), "Batch imports must reuse the Community Library importer in safe Add as New mode.");
assert.ok(cart.includes('failed and kept in cart'), "Failed imports must remain selected for retry.");

const runtimeIndex = bootstrap.indexOf('"app/community-library-runtime-stability-integration.js"');
const cartIndex = bootstrap.indexOf('"app/community-library-cart-integration.js"');
assert.ok(runtimeIndex >= 0 && cartIndex > runtimeIndex, "Community cart must load after Community runtime stabilization.");
console.log("Community Library floating batch-import cart regression passed.");
