const {test} = require("node:test");
const {strict: assert} = require("node:assert");

// NB: Not using JS modules...
eval(require("fs").readFileSync(__dirname + "/base.js")+"");
